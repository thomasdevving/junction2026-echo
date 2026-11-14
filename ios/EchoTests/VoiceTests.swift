import Foundation
import Testing

@testable import Echo

// ElevenLabs phase 1: pre-rendered lines, lookup, playback rules, phrase list.

@MainActor
final class FakeLinePlayer: LinePlayer {
    private(set) var played: [URL] = []
    private(set) var stops = 0
    var isPlaying = false
    var onFinish: (@MainActor () -> Void)?

    func play(_ url: URL, delay: TimeInterval) -> Bool {
        played.append(url)
        isPlaying = true
        return true
    }

    func stop() {
        stops += 1
        isPlaying = false
    }

    /// Simulates the current line ending on its own.
    func finish() {
        isPlaying = false
        onFinish?()
    }
}

@MainActor
@Suite("ElevenLabs voice")
struct VoiceTests {
    /// A library in a temp folder with real (empty) files for the given lines.
    static func library(_ lines: [String]) throws -> VoiceLibrary {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("voice-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var map: [String: String] = [:]
        for (i, line) in lines.enumerated() {
            let name = "\(i).mp3"
            try Data([0]).write(to: dir.appendingPathComponent(name))
            map[VoiceLibrary.key(line)] = name
        }
        return VoiceLibrary(directory: dir, manifest: .init(voiceID: "v", modelID: "m", lines: map))
    }

    func make(_ lines: [String], provider: VoiceProvider = .elevenLabs, muted: Bool = false) throws
        -> (VoicedSpeechOutput, FakeLinePlayer, FakeSpeech)
    {
        let player = FakeLinePlayer()
        let fallback = FakeSpeech()
        let speech = VoicedSpeechOutput(
            fallback: fallback, library: try Self.library(lines), player: player,
            provider: { provider }, isMuted: { muted })
        return (speech, player, fallback)
    }

    @Test func keyIgnoresCaseSpacingAndQuoteStyle() {
        #expect(VoiceLibrary.key("Can’t  tell.\n Look at the board.") == VoiceLibrary.key("can't tell. look at the board."))
        #expect(VoiceLibrary.key("Step 4 of 6.") != VoiceLibrary.key("Step 5 of 6."))
    }

    @Test func emptyLibraryWhenNothingRendered() {
        let lib = VoiceLibrary.load(bundle: Bundle(for: FakeLinePlayer.self))
        #expect(lib.fileURL(for: "Checking.") == nil || !lib.isEmpty)
        #expect(VoiceLibrary.empty.fileURL(for: "Checking.") == nil)
    }

    @Test func recordedLinePlaysTheRecording() throws {
        let (speech, player, fallback) = try make(["Checking."])
        speech.speak("Checking.", priority: .result)
        #expect(player.played.count == 1)
        #expect(fallback.texts.isEmpty)
    }

    @Test func unrecordedLineUsesIOSSpeech() throws {
        let (speech, player, fallback) = try make(["Checking."])
        speech.speak("Something Gemini wrote.", priority: .result)
        #expect(player.played.isEmpty)
        #expect(fallback.texts == ["Something Gemini wrote."])
    }

    @Test func iOSVoiceSettingSkipsRecordings() throws {
        let (speech, player, fallback) = try make(["Checking."], provider: .system)
        speech.speak("Checking.", priority: .result)
        #expect(player.played.isEmpty)
        #expect(fallback.texts == ["Checking."])
    }

    @Test func mutedSaysNothing() throws {
        let (speech, player, fallback) = try make(["Checking."], muted: true)
        speech.speak("Checking.", priority: .result)
        #expect(player.played.isEmpty && fallback.texts.isEmpty)
    }

    @Test func infoLinesQueueAndPlayInOrder() throws {
        let (speech, player, _) = try make(["One.", "Two.", "Three."])
        speech.speak("One.", priority: .info)
        speech.speak("Two.", priority: .info)
        speech.speak("Three.", priority: .info)
        #expect(player.played.count == 1)
        player.finish()
        player.finish()
        #expect(player.played.map(\.lastPathComponent) == ["0.mp3", "1.mp3", "2.mp3"])
        #expect(speech.isSpeaking)
        player.finish()
        #expect(!speech.isSpeaking)
    }

    @Test func resultInterruptsAndDropsQueuedInfo() throws {
        let (speech, player, fallback) = try make(["Step one.", "Step two.", "Filling piled up."])
        speech.speak("Step one.", priority: .info)
        speech.speak("Step two.", priority: .info)
        speech.speak("Filling piled up.", priority: .result)
        #expect(player.stops >= 1)
        #expect(fallback.stops >= 1, "an iOS-speech line in progress is cut too")
        #expect(player.played.last?.lastPathComponent == "2.mp3")
        player.finish()
        #expect(player.played.count == 2, "the dropped info line never plays")
    }

    @Test func unrecordedResultStillSilencesARecording() throws {
        let (speech, player, fallback) = try make(["Step one."])
        speech.speak("Step one.", priority: .info)
        speech.speak("A sentence Gemini wrote.", priority: .result)
        #expect(player.stops >= 1)
        #expect(fallback.texts == ["A sentence Gemini wrote."])
    }

    @Test func chimeGoesToTheSystemChime() throws {
        let (speech, _, fallback) = try make([])
        speech.playChime()
        #expect(fallback.chimes == 1)
    }

    // MARK: Phrase list

    @Test func phraseListCoversWhatTheCookAlongSays() throws {
        let recipe = try FixtureRecipe.load()
        let keys = Set(VoicePhrases.lines(for: recipe).map(VoiceLibrary.key))
        for step in recipe.steps {
            let card = StepCard(
                idx: step.idx, total: recipe.steps.count, title: step.title, keyLine: step.keyLine, refImage: nil,
                watching: .active)
            let readOut = try #require(LensScreen.step(card).spokenText)
            #expect(keys.contains(VoiceLibrary.key(readOut)), "step read-out: \(readOut)")
            for mistake in step.watchFors {
                #expect(keys.contains(VoiceLibrary.key(mistake.spoken)), "warning: \(mistake.spoken)")
            }
        }
        #expect(keys.contains(VoiceLibrary.key("Checking.")))
        #expect(keys.contains(VoiceLibrary.key("Looks right.")))
        let lines = VoicePhrases.lines(for: recipe)
        #expect(lines.count == Set(lines.map(VoiceLibrary.key)).count, "no duplicates")
    }
}

/// Writes the phrase list for `scripts/render-voice.sh` (env VOICE_PHRASES_OUT, passed to the test
/// runner as TEST_RUNNER_VOICE_PHRASES_OUT). A no-op in normal test runs.
@Suite("Voice phrase export")
struct VoicePhraseExport {
    @Test func export() throws {
        guard let path = ProcessInfo.processInfo.environment["VOICE_PHRASES_OUT"], !path.isEmpty else { return }
        let lines = VoicePhrases.lines(for: try FixtureRecipe.load())
        let data = try JSONEncoder().encode(lines)
        try data.write(to: URL(fileURLWithPath: path))
    }
}
