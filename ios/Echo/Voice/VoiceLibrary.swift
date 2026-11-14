import Foundation

/// Pre-rendered ElevenLabs lines bundled with the app (`Resources/Voice/`), written by
/// `scripts/render-voice.swift`. The manifest maps a lookup key (see `key(_:)`) to an audio file.
/// An empty library is normal (nothing rendered on this machine): the app then uses iOS speech.
struct VoiceLibrary: Sendable {
    struct Manifest: Codable, Equatable, Sendable {
        var voiceID: String?
        var modelID: String?
        var outputFormat: String?
        var renderedAt: String?
        /// Lookup key → file name inside the Voice folder.
        var lines: [String: String]
    }

    static let folder = "Voice"

    let directory: URL?
    let manifest: Manifest

    static let empty = VoiceLibrary(directory: nil, manifest: Manifest(lines: [:]))

    init(directory: URL?, manifest: Manifest) {
        self.directory = directory
        self.manifest = manifest
    }

    /// Loads `Voice/manifest.json` from the bundle; `.empty` when missing or unreadable.
    static func load(bundle: Bundle = .main) -> VoiceLibrary {
        guard let dir = bundle.resourceURL?.appendingPathComponent(folder, isDirectory: true) else { return .empty }
        let file = dir.appendingPathComponent("manifest.json")
        guard let data = try? Data(contentsOf: file),
            let manifest = try? JSONDecoder().decode(Manifest.self, from: data)
        else { return .empty }
        return VoiceLibrary(directory: dir, manifest: manifest)
    }

    var count: Int { manifest.lines.count }
    var isEmpty: Bool { manifest.lines.isEmpty }

    /// The audio file for `text`, if one was rendered and is present in the bundle.
    func fileURL(for text: String) -> URL? {
        guard let directory, let name = manifest.lines[Self.key(text)] else { return nil }
        let url = directory.appendingPathComponent(name)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    /// Case-, spacing- and punctuation-style-insensitive key, so "Can’t tell." and "can't tell."
    /// find the same recording. Words and their order must still match.
    static func key(_ text: String) -> String {
        var s = text.lowercased()
        for (from, to) in [("’", "'"), ("‘", "'"), ("“", "\""), ("”", "\""), ("—", "-"), ("–", "-"), ("…", "...")] {
            s = s.replacingOccurrences(of: from, with: to)
        }
        return s.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
