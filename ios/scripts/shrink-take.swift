// Re-encodes a Chef-mode take at the bitrate Echo now records with (H.264 1.3 Mbit/s at
// 720×1280, audio passed through as AAC 96 kbit/s), so an older, larger take fits the storage
// upload limit (~50 MB per file on the Supabase free plan).
//
// Usage:  swift scripts/shrink-take.swift <in.mp4> <out.mp4>

import AVFoundation
import Foundation

func fail(_ m: String) -> Never { FileHandle.standardError.write(Data("error: \(m)\n".utf8)); exit(1) }

let args = CommandLine.arguments
guard args.count == 3 else { fail("usage: swift scripts/shrink-take.swift <in.mp4> <out.mp4>") }
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
try? FileManager.default.removeItem(at: output)

let asset = AVURLAsset(url: input)
guard let videoTrack = try await asset.loadTracks(withMediaType: .video).first else { fail("no video track") }
let audioTrack = try await asset.loadTracks(withMediaType: .audio).first
let size = try await videoTrack.load(.naturalSize)
let transform = try await videoTrack.load(.preferredTransform)
let duration = try await asset.load(.duration)
let width = Int(size.width), height = Int(size.height)
let bitRate = max(800_000, Int(Double(width * height) / Double(720 * 1280) * 1_300_000))

let reader = try AVAssetReader(asset: asset)
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)

let videoOut = AVAssetReaderTrackOutput(
    track: videoTrack, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange])
reader.add(videoOut)
let videoIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitRate, AVVideoMaxKeyFrameIntervalKey: 48,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
])
videoIn.transform = transform
videoIn.expectsMediaDataInRealTime = false
writer.add(videoIn)

var audioOut: AVAssetReaderTrackOutput?
var audioIn: AVAssetWriterInput?
if let audioTrack {
    let out = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
    reader.add(out)
    let inp = AVAssetWriterInput(mediaType: .audio, outputSettings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC, AVNumberOfChannelsKey: 1, AVSampleRateKey: 44_100, AVEncoderBitRateKey: 96_000,
    ])
    inp.expectsMediaDataInRealTime = false
    writer.add(inp)
    audioOut = out
    audioIn = inp
}

guard reader.startReading() else { fail("reader: \(String(describing: reader.error))") }
guard writer.startWriting() else { fail("writer: \(String(describing: writer.error))") }
writer.startSession(atSourceTime: .zero)

func pump(_ out: AVAssetReaderTrackOutput, _ inp: AVAssetWriterInput, label: String) async {
    await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
        let queue = DispatchQueue(label: "shrink.\(label)")
        inp.requestMediaDataWhenReady(on: queue) {
            while inp.isReadyForMoreMediaData {
                if let buffer = out.copyNextSampleBuffer() {
                    inp.append(buffer)
                } else {
                    inp.markAsFinished()
                    done.resume()
                    return
                }
            }
        }
    }
}

async let video: Void = pump(videoOut, videoIn, label: "video")
if let audioOut, let audioIn { await pump(audioOut, audioIn, label: "audio") }
await video
await writer.finishWriting()
guard writer.status == .completed else { fail("writer failed: \(String(describing: writer.error))") }
let bytes = (try? FileManager.default.attributesOfItem(atPath: output.path)[.size] as? Int) ?? 0
print("Wrote \(output.lastPathComponent): \(String(format: "%.1f", Double(bytes) / 1_000_000)) MB, \(width)x\(height), \(String(format: "%.1f", duration.seconds)) s, video \(bitRate / 1000) kbit/s")
