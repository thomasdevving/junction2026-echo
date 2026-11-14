// Phase 0 of the ElevenLabs voice plan: how much later would an answer start if Gemini Live's
// output transcription were re-voiced by ElevenLabs instead of playing Live's own audio?
//
// Usage (from ios/):  swift scripts/voice-latency.swift [runs]
// Reads API_BASE_URL + DEMO_API_KEY from Config/Secrets.xcconfig (backend, for /live-token) and the
// ElevenLabs key/voice/model from Config/ElevenLabs.xcconfig. Prints timings only, never secrets.
// No session is created on the backend (session_id is optional on /live-token).

import Foundation

func fail(_ m: String) -> Never { FileHandle.standardError.write(Data("error: \(m)\n".utf8)); exit(1) }

func readConfig(_ path: String) -> [String: String] {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { fail("\(path) not found") }
    var v: [String: String] = [:]
    for line in text.split(separator: "\n") {
        let t = line.trimmingCharacters(in: .whitespaces)
        guard !t.hasPrefix("//"), let eq = t.firstIndex(of: "=") else { continue }
        v[t[..<eq].trimmingCharacters(in: .whitespaces)] = t[t.index(after: eq)...].trimmingCharacters(in: .whitespaces)
    }
    return v
}

let secrets = readConfig("Config/Secrets.xcconfig")
let eleven = readConfig("Config/ElevenLabs.xcconfig")
let base = (secrets["API_BASE_URL"] ?? "").replacingOccurrences(of: "$()", with: "")
let demoKey = secrets["DEMO_API_KEY"] ?? ""
let elKey = eleven["ELEVENLABS_API_KEY"] ?? ""
let voice = eleven["ELEVENLABS_VOICE_ID"] ?? ""
let model = (eleven["ELEVENLABS_MODEL"]?.isEmpty == false) ? eleven["ELEVENLABS_MODEL"]! : "eleven_flash_v2_5"
guard !base.isEmpty, !demoKey.isEmpty, !elKey.isEmpty, !voice.isEmpty else { fail("missing config values") }
let runs = CommandLine.arguments.count > 1 ? Int(CommandLine.arguments[1]) ?? 3 : 3
let recipeID = "00000000-0000-4000-8000-000000000001"
let flushByWords = ProcessInfo.processInfo.environment["FLUSH"] == "words"
let questions = ["Where should the cheese go?", "How much mayo should I put on?", "How many lettuce leaves do I need?"]

func ms(_ from: Date, _ to: Date?) -> String { to.map { String(Int($0.timeIntervalSince(from) * 1000)) } ?? "—" }

func receiveJSON(_ ws: URLSessionWebSocketTask) async throws -> [String: Any] {
    let message = try await ws.receive()
    let data: Data
    switch message {
    case .data(let d): data = d
    case .string(let s): data = Data(s.utf8)
    @unknown default: data = Data()
    }
    return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
}

func send(_ ws: URLSessionWebSocketTask, _ object: [String: Any]) async throws {
    let data = try JSONSerialization.data(withJSONObject: object)
    try await ws.send(.string(String(decoding: data, as: UTF8.self)))
}

func elevenSocket() -> URLSessionWebSocketTask {
    var request = URLRequest(url: URL(string:
        "wss://api.elevenlabs.io/v1/text-to-speech/\(voice)/stream-input?model_id=\(model)&output_format=pcm_24000")!)
    request.setValue(elKey, forHTTPHeaderField: "xi-api-key")
    let ws = URLSession.shared.webSocketTask(with: request)
    ws.resume()
    return ws
}

// MARK: 1. ElevenLabs alone: sentence sent with flush → first audio

print("== ElevenLabs stream-input alone (\(model), pcm_24000) ==")
var standalone: [Int] = []
for i in 1...5 {
    let ws = elevenSocket()
    let opened = Date()
    try await send(ws, ["text": " "])
    let sent = Date()
    try await send(ws, ["text": "There's a bit too much filling. Spread it to the edges. ", "flush": true])
    var first: Date?
    while first == nil {
        let m = try await receiveJSON(ws)
        if let a = m["audio"] as? String, !a.isEmpty { first = Date() }
        if m["isFinal"] as? Bool == true { break }
        if let err = m["error"] ?? m["message"] { fail("ElevenLabs: \(err)") }
    }
    try? await send(ws, ["text": ""])
    ws.cancel(with: .normalClosure, reason: nil)
    let value = first.map { Int($0.timeIntervalSince(sent) * 1000) } ?? -1
    standalone.append(value)
    print("run \(i): first audio \(value) ms after the text (socket opened \(ms(opened, sent)) ms before)")
}

// MARK: 2. Gemini Live: own audio vs transcript, and the ElevenLabs re-voice pipeline

struct LiveToken { let token: String; let model: String }

func liveToken() async throws -> LiveToken {
    var request = URLRequest(url: URL(string: "\(base)/live-token?recipe_id=\(recipeID)")!)
    request.setValue(demoKey, forHTTPHeaderField: "X-Demo-Key")
    let (data, response) = try await URLSession.shared.data(for: request)
    guard (response as? HTTPURLResponse)?.statusCode == 200,
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        let token = json["token"] as? String, let model = json["model"] as? String
    else { fail("/live-token failed: HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0)") }
    return LiveToken(token: token, model: model)
}

print("\n== Gemini Live question → Gemini audio vs ElevenLabs re-voice of the transcript ==")
var rows: [(gemini: Int, transcript: Int, eleven: Int)] = []
for i in 0..<runs {
    let token = try await liveToken()
    var request = URLRequest(url: URL(string:
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained")!)
    request.setValue("Token \(token.token)", forHTTPHeaderField: "Authorization")
    let live = URLSession.shared.webSocketTask(with: request)
    live.resume()
    let modelPath = token.model.hasPrefix("models/") ? token.model : "models/\(token.model)"
    try await send(live, ["setup": ["model": modelPath, "sessionResumption": [:] as [String: Any]]])
    while true {
        let m = try await receiveJSON(live)
        if m["setupComplete"] != nil { break }
    }
    // ElevenLabs socket opened before the question, as the app would keep one ready.
    let el = elevenSocket()
    try await send(el, ["text": " "])
    let elFirst = Task { () -> Date? in
        while true {
            guard let m = try? await receiveJSON(el) else { return nil }
            if let a = m["audio"] as? String, !a.isEmpty { return Date() }
            if m["isFinal"] as? Bool == true { return nil }
        }
    }

    let question = questions[i % questions.count]
    let asked = Date()
    try await send(live, ["clientContent": ["turns": [["role": "user", "parts": [["text": question]]]], "turnComplete": true]])
    var geminiAudio: Date?
    var firstText: Date?
    var pending = ""
    var transcript = ""
    while true {
        let m = try await receiveJSON(live)
        guard let content = m["serverContent"] as? [String: Any] else { continue }
        if let turn = content["modelTurn"] as? [String: Any], let parts = turn["parts"] as? [[String: Any]],
            parts.contains(where: { $0["inlineData"] != nil }), geminiAudio == nil
        {
            geminiAudio = Date()
        }
        if let t = content["outputTranscription"] as? [String: Any], let text = t["text"] as? String, !text.isEmpty {
            if firstText == nil { firstText = Date() }
            transcript += text
            pending += text
            // Flush to ElevenLabs at each sentence end (default), or every few words with
            // FLUSH=words (lower latency, slightly less natural phrasing).
            let words = pending.split(whereSeparator: \.isWhitespace).count
            let sentenceEnd = pending.trimmingCharacters(in: .whitespaces).last.map { ".!?".contains($0) } ?? false
            if sentenceEnd || (flushByWords && words >= 4) {
                try await send(el, ["text": pending + " ", "flush": true])
                pending = ""
            }
        }
        if content["turnComplete"] as? Bool == true { break }
    }
    if !pending.isEmpty { try await send(el, ["text": pending + " ", "flush": true]) }
    let elevenAudio = await withTaskGroup(of: Date?.self) { group in
        group.addTask { await elFirst.value }
        group.addTask { try? await Task.sleep(for: .seconds(8)); return nil }
        let first = await group.next() ?? nil
        group.cancelAll()
        return first
    }
    try? await send(el, ["text": ""])
    el.cancel(with: .normalClosure, reason: nil)
    live.cancel(with: .normalClosure, reason: nil)
    let g = geminiAudio.map { Int($0.timeIntervalSince(asked) * 1000) } ?? -1
    let tx = firstText.map { Int($0.timeIntervalSince(asked) * 1000) } ?? -1
    let e = elevenAudio.map { Int($0.timeIntervalSince(asked) * 1000) } ?? -1
    rows.append((g, tx, e))
    print("run \(i + 1) \"\(question)\": Gemini audio \(g) ms · first transcript \(tx) ms · ElevenLabs audio \(e) ms · extra \(e >= 0 && g >= 0 ? e - g : 0) ms")
    print("        answer: \(transcript.trimmingCharacters(in: .whitespacesAndNewlines).prefix(140))")
}

func median(_ v: [Int]) -> Int { let s = v.filter { $0 >= 0 }.sorted(); return s.isEmpty ? -1 : s[s.count / 2] }
print("\nmedians: ElevenLabs alone \(median(standalone)) ms; Gemini audio \(median(rows.map(\.gemini))) ms; transcript \(median(rows.map(\.transcript))) ms; ElevenLabs re-voice \(median(rows.map(\.eleven))) ms; extra \(median(rows.map { $0.eleven - $0.gemini })) ms")
