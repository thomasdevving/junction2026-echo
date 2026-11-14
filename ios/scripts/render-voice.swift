// Renders Echo's spoken lines with ElevenLabs into Echo/Resources/Voice/ (git-ignored).
//
// Usage (from ios/):  scripts/render-voice.sh        (exports the phrase list, then runs this)
//          or:        swift scripts/render-voice.swift <phrases.json>
//
// Reads ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL from Config/ElevenLabs.xcconfig
// (git-ignored). The key is only used here, on the Mac; it is never put in the app.
// Lines already rendered with the same voice and model are kept, so re-runs only pay for new text.
// API: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream (header xi-api-key).

import CryptoKit
import Foundation

struct Manifest: Codable {
    var voiceID: String?
    var modelID: String?
    var outputFormat: String?
    var renderedAt: String?
    var lines: [String: String]
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("error: \(message)\n".utf8))
    exit(1)
}

/// Same rule as `VoiceLibrary.key` in the app.
func key(_ text: String) -> String {
    var s = text.lowercased()
    for (from, to) in [("’", "'"), ("‘", "'"), ("“", "\""), ("”", "\""), ("—", "-"), ("–", "-"), ("…", "...")] {
        s = s.replacingOccurrences(of: from, with: to)
    }
    return s.split(whereSeparator: \.isWhitespace).joined(separator: " ")
}

func readConfig(_ path: String) -> [String: String] {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else {
        fail("\(path) not found. Copy Config/ElevenLabs.example.xcconfig to it and fill it in.")
    }
    var values: [String: String] = [:]
    for line in text.split(separator: "\n") {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard !trimmed.hasPrefix("//"), let eq = trimmed.firstIndex(of: "=") else { continue }
        let name = trimmed[..<eq].trimmingCharacters(in: .whitespaces)
        let value = trimmed[trimmed.index(after: eq)...].trimmingCharacters(in: .whitespaces)
        values[name] = value
    }
    return values
}

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage: swift scripts/render-voice.swift <phrases.json>") }
let config = readConfig("Config/ElevenLabs.xcconfig")
guard let apiKey = config["ELEVENLABS_API_KEY"], !apiKey.isEmpty else { fail("ELEVENLABS_API_KEY is empty") }
guard let voiceID = config["ELEVENLABS_VOICE_ID"], !voiceID.isEmpty else { fail("ELEVENLABS_VOICE_ID is empty") }
let modelID = (config["ELEVENLABS_MODEL"]?.isEmpty == false) ? config["ELEVENLABS_MODEL"]! : "eleven_flash_v2_5"
let outputFormat = "mp3_44100_64"

guard let phrasesData = FileManager.default.contents(atPath: args[1]),
    let phrases = try? JSONDecoder().decode([String].self, from: phrasesData)
else { fail("cannot read phrase list \(args[1])") }

let outDir = URL(fileURLWithPath: "Echo/Resources/Voice", isDirectory: true)
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
let manifestURL = outDir.appendingPathComponent("manifest.json")
let old = (try? JSONDecoder().decode(Manifest.self, from: Data(contentsOf: manifestURL)))
let reusable = (old?.voiceID == voiceID && old?.modelID == modelID && old?.outputFormat == outputFormat)
    ? (old?.lines ?? [:]) : [:]

var lines: [String: String] = [:]
var rendered = 0
var reused = 0
var characters = 0
for phrase in phrases {
    let k = key(phrase)
    let digest = SHA256.hash(data: Data(k.utf8)).map { String(format: "%02x", $0) }.joined()
    let name = "\(digest.prefix(16)).mp3"
    let file = outDir.appendingPathComponent(name)
    if reusable[k] == name, FileManager.default.fileExists(atPath: file.path) {
        lines[k] = name
        reused += 1
        continue
    }
    var request = URLRequest(
        url: URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voiceID)/stream?output_format=\(outputFormat)")!)
    request.httpMethod = "POST"
    request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("audio/mpeg", forHTTPHeaderField: "Accept")
    request.timeoutInterval = 30
    let body: [String: Any] = ["text": phrase, "model_id": modelID, "apply_text_normalization": "on"]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard status == 200, data.count > 1000 else {
        let detail = String(data: data.prefix(300), encoding: .utf8) ?? ""
        fail("ElevenLabs answered HTTP \(status) for \"\(phrase)\": \(detail)")
    }
    try data.write(to: file)
    lines[k] = name
    rendered += 1
    characters += phrase.count
    print("rendered \(rendered + reused)/\(phrases.count): \(phrase)")
}

// Remove recordings no longer referenced (changed wording).
let keep = Set(lines.values)
for file in (try? FileManager.default.contentsOfDirectory(atPath: outDir.path)) ?? []
where file.hasSuffix(".mp3") && !keep.contains(file) {
    try? FileManager.default.removeItem(at: outDir.appendingPathComponent(file))
}

let stamp = ISO8601DateFormatter().string(from: Date())
let manifest = Manifest(voiceID: voiceID, modelID: modelID, outputFormat: outputFormat, renderedAt: stamp, lines: lines)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
try encoder.encode(manifest).write(to: manifestURL)
let bytes = keep.reduce(0) { total, name in
    total + ((try? FileManager.default.attributesOfItem(atPath: outDir.appendingPathComponent(name).path)[.size] as? Int) ?? 0)
}
print("Done: \(lines.count) lines (\(rendered) rendered, \(reused) reused), \(characters) characters billed, \(bytes / 1024) KB on disk, model \(modelID).")
