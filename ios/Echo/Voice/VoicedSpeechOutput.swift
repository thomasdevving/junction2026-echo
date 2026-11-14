@preconcurrency import AVFoundation
import Foundation

/// Which voice speaks results and step read-outs (Settings → Voice).
enum VoiceProvider: String, CaseIterable, Identifiable, Sendable {
    case elevenLabs
    case system

    var id: String { rawValue }
    var label: String {
        switch self {
        case .elevenLabs: "ElevenLabs"
        case .system: "iOS"
        }
    }
}

/// Plays one recorded line. `AVLinePlayer` is the device implementation; tests use a fake.
@MainActor
protocol LinePlayer: AnyObject {
    var isPlaying: Bool { get }
    /// Called when a line finishes on its own (not after `stop()`).
    var onFinish: (@MainActor () -> Void)? { get set }
    func play(_ url: URL, delay: TimeInterval) -> Bool
    func stop()
}

/// The app's speech: pre-rendered ElevenLabs lines when available, iOS speech for everything else
/// and whenever the ElevenLabs voice is switched off. Same rules as `SystemSpeechOutput`:
/// a `.result` cuts whatever is playing and drops queued `.info` lines; `.info` waits its turn.
@MainActor
final class VoicedSpeechOutput: SpeechOutput {
    let fallback: SpeechOutput
    let library: VoiceLibrary
    private let player: LinePlayer
    private let provider: @MainActor () -> VoiceProvider
    private let isMuted: @MainActor () -> Bool
    private let prepareAudio: @MainActor () -> Void
    private var queue: [URL] = []
    private var waitTask: Task<Void, Never>?
    private var lastChimeAt: Date?

    init(
        fallback: SpeechOutput, library: VoiceLibrary, player: LinePlayer,
        provider: @escaping @MainActor () -> VoiceProvider,
        isMuted: @escaping @MainActor () -> Bool = { false },
        prepareAudio: @escaping @MainActor () -> Void = {}
    ) {
        self.fallback = fallback
        self.library = library
        self.player = player
        self.provider = provider
        self.isMuted = isMuted
        self.prepareAudio = prepareAudio
        player.onFinish = { [weak self] in self?.playNext() }
    }

    var isSpeaking: Bool { player.isPlaying || fallback.isSpeaking || !queue.isEmpty }

    /// True when this line will use the ElevenLabs recording.
    func hasRecording(for text: String) -> Bool {
        provider() == .elevenLabs && library.fileURL(for: text) != nil
    }

    func speak(_ text: String, priority: SpeechPriority) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isMuted() else { return }
        guard provider() == .elevenLabs, let url = library.fileURL(for: text) else {
            // Not recorded: iOS speech. A result still silences any recording first.
            if priority == .result { stopRecordings() }
            fallback.speak(text, priority: priority)
            return
        }
        prepareAudio()
        switch priority {
        case .result:
            stopRecordings()
            fallback.stop()
            start(url)
        case .info:
            queue.append(url)
            if !player.isPlaying { playNext() }
        }
    }

    func stop() {
        stopRecordings()
        fallback.stop()
    }

    func playChime() {
        lastChimeAt = .now
        fallback.playChime()
    }

    // MARK: Queue

    private func start(_ url: URL) {
        // Let a chime that just started ring before the voice comes in (same as iOS speech).
        let delay: TimeInterval = (lastChimeAt.map { Date.now.timeIntervalSince($0) < 0.3 } ?? false) ? 0.3 : 0
        if !player.play(url, delay: delay) {
            playNext()
        }
    }

    /// Plays the next queued line once nothing else is speaking.
    private func playNext() {
        guard !queue.isEmpty else { return }
        if fallback.isSpeaking {
            // An iOS-speech line is still playing: check again shortly.
            guard waitTask == nil else { return }
            waitTask = Task { [weak self] in
                while let self, self.fallback.isSpeaking, !Task.isCancelled {
                    try? await Task.sleep(for: .milliseconds(150))
                }
                self?.waitTask = nil
                self?.playNext()
            }
            return
        }
        start(queue.removeFirst())
    }

    private func stopRecordings() {
        queue.removeAll()
        waitTask?.cancel()
        waitTask = nil
        player.stop()
    }
}

/// `AVAudioPlayer` on whatever audio session is active (`.playback`, or `.playAndRecord` while
/// Gemini Live runs), so recorded lines play with the ring switch on silent, like iOS speech.
@MainActor
final class AVLinePlayer: NSObject, LinePlayer, AVAudioPlayerDelegate {
    private var current: AVAudioPlayer?
    var onFinish: (@MainActor () -> Void)?

    var isPlaying: Bool { current?.isPlaying ?? false }

    func play(_ url: URL, delay: TimeInterval) -> Bool {
        current?.stop()
        guard let player = try? AVAudioPlayer(contentsOf: url) else { return false }
        player.delegate = self
        player.prepareToPlay()
        current = player
        return delay > 0 ? player.play(atTime: player.deviceCurrentTime + delay) : player.play()
    }

    func stop() {
        current?.stop()
        current = nil
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        let id = ObjectIdentifier(player)
        Task { @MainActor in
            guard let current = self.current, ObjectIdentifier(current) == id else { return }
            self.current = nil
            self.onFinish?()
        }
    }
}
