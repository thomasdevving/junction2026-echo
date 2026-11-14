@preconcurrency import AVFoundation
import Foundation

/// Re-encodes a take on the phone so it fits the storage upload limit (HTTP 413 otherwise; the
/// Supabase free plan takes ~50 MB per file). Same picture size; the video bitrate is chosen
/// from the take's length, at most Echo's normal 1.3 Mbit/s at 720×1280, at least `floorBitRate`.
/// The smaller file replaces the original only when it is complete.
final class AVTakeShrinker: TakeShrinking {
    static let floorBitRate = 450_000
    static let audioBitRate = 96_000

    /// Video bitrate that makes `seconds` of video fit in `limitBytes` (5 % margin for the
    /// container), capped at the size-scaled normal rate and floored at `floorBitRate`.
    static func videoBitRate(seconds: Double, limitBytes: Int64, width: Int, height: Int) -> Int {
        let normal = TakeWriter.bitRate(width: width, height: height)
        guard seconds > 0 else { return normal }
        let budget = Double(limitBytes) * 8 * 0.95 / seconds - Double(audioBitRate)
        return max(floorBitRate, min(normal, Int(budget)))
    }

    func shrink(_ file: URL, toFit limitBytes: Int64, progress: @escaping @Sendable (Double) -> Void) async throws {
        let asset = AVURLAsset(url: file)
        guard let videoTrack = try await asset.loadTracks(withMediaType: .video).first else {
            throw ShrinkError.noVideo
        }
        let audioTrack = try await asset.loadTracks(withMediaType: .audio).first
        let size = try await videoTrack.load(.naturalSize)
        let transform = try await videoTrack.load(.preferredTransform)
        let duration = try await asset.load(.duration).seconds
        let width = Int(size.width)
        let height = Int(size.height)
        let bitRate = Self.videoBitRate(seconds: duration, limitBytes: limitBytes, width: width, height: height)

        let output = file.deletingPathExtension().appendingPathExtension("shrinking.mp4")
        try? FileManager.default.removeItem(at: output)

        let reader = try AVAssetReader(asset: asset)
        let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
        let videoOut = AVAssetReaderTrackOutput(
            track: videoTrack,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange])
        reader.add(videoOut)
        let videoIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: bitRate, AVVideoMaxKeyFrameIntervalKey: TakeWriter.frameRate * 2,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            ],
        ])
        videoIn.transform = transform
        videoIn.expectsMediaDataInRealTime = false
        writer.add(videoIn)

        var audio: Pump?
        if let audioTrack {
            let out = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
            reader.add(out)
            let inp = AVAssetWriterInput(mediaType: .audio, outputSettings: [
                AVFormatIDKey: kAudioFormatMPEG4AAC, AVNumberOfChannelsKey: 1, AVSampleRateKey: 44_100,
                AVEncoderBitRateKey: Self.audioBitRate,
            ])
            inp.expectsMediaDataInRealTime = false
            writer.add(inp)
            audio = Pump(output: out, input: inp, label: "audio", duration: 0, progress: nil)
        }
        let video = Pump(output: videoOut, input: videoIn, label: "video", duration: duration, progress: progress)

        guard reader.startReading() else { throw ShrinkError.failed(reader.error?.localizedDescription ?? "reader") }
        guard writer.startWriting() else { throw ShrinkError.failed(writer.error?.localizedDescription ?? "writer") }
        writer.startSession(atSourceTime: .zero)

        async let videoDone: Void = video.run()
        if let audio { await audio.run() }
        await videoDone

        if reader.status == .failed {
            writer.cancelWriting()
            try? FileManager.default.removeItem(at: output)
            throw ShrinkError.failed(reader.error?.localizedDescription ?? "reading the take failed")
        }
        await writer.finishWriting()
        guard writer.status == .completed else {
            try? FileManager.default.removeItem(at: output)
            throw ShrinkError.failed(writer.error?.localizedDescription ?? "writing the smaller video failed")
        }
        _ = try FileManager.default.replaceItemAt(file, withItemAt: output)
        progress(1)
    }

    enum ShrinkError: LocalizedError {
        case noVideo
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .noVideo: "The take has no video track."
            case .failed(let detail): "Shrinking the video failed: \(detail)"
            }
        }
    }

    /// Copies one track from reader to writer on its own queue. AVFoundation's reader outputs and
    /// writer inputs are used from that queue only, hence `@unchecked Sendable`.
    private final class Pump: @unchecked Sendable {
        let output: AVAssetReaderTrackOutput
        let input: AVAssetWriterInput
        let queue: DispatchQueue
        let duration: Double
        let progress: (@Sendable (Double) -> Void)?
        private var lastReported = -1.0

        init(
            output: AVAssetReaderTrackOutput, input: AVAssetWriterInput, label: String, duration: Double,
            progress: (@Sendable (Double) -> Void)?
        ) {
            self.output = output
            self.input = input
            self.queue = DispatchQueue(label: "echo.shrink.\(label)")
            self.duration = duration
            self.progress = progress
        }

        func run() async {
            await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
                input.requestMediaDataWhenReady(on: queue) { [self] in
                    while input.isReadyForMoreMediaData {
                        guard let buffer = output.copyNextSampleBuffer() else {
                            input.markAsFinished()
                            done.resume()
                            return
                        }
                        report(CMSampleBufferGetPresentationTimeStamp(buffer).seconds)
                        input.append(buffer)
                    }
                }
            }
        }

        private func report(_ seconds: Double) {
            guard let progress, duration > 0, seconds.isFinite else { return }
            let fraction = min(0.99, max(0, seconds / duration))
            // At most ~100 updates.
            if fraction - lastReported >= 0.01 {
                lastReported = fraction
                progress(fraction)
            }
        }
    }
}
