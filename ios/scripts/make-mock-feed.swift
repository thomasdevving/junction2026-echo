// Builds the MockDeviceKit camera feed used on the simulator (which has no camera) from the team's
// real chef take: 20 s of the sandwich lesson, re-encoded as HEVC (MockDeviceKit accepts h.265
// video files as a mock camera feed, SDK 1.0.1 docs).
//
// Usage (from ios/):  swift scripts/make-mock-feed.swift
// Input:              $ECHO_REAL_TAKE, else ../ai/footage/chef-take-sandwich.mp4
//                     (not in git: the repository is public; get the take privately)
// Output:             Echo/Resources/MockFeed/mock-feed.mp4 (git-ignored, like all mp4s)

import AVFoundation
import Foundation

func fail(_ m: String) -> Never { FileHandle.standardError.write(Data("error: \(m)\n".utf8)); exit(1) }

let env = ProcessInfo.processInfo.environment
let input = URL(fileURLWithPath: env["ECHO_REAL_TAKE"] ?? "../ai/footage/chef-take-sandwich.mp4")
guard FileManager.default.fileExists(atPath: input.path) else {
    fail("Real chef take missing: \(input.path) (not in git; set ECHO_REAL_TAKE or copy it there)")
}
let outDir = URL(fileURLWithPath: "Echo/Resources/MockFeed", isDirectory: true)
let output = outDir.appendingPathComponent("mock-feed.mp4")
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
try? FileManager.default.removeItem(at: output)

/// 60–80 s: lettuce, ham and cheese going on; hands and food change every few seconds.
let start = CMTime(seconds: 60, preferredTimescale: 600)
let length = CMTime(seconds: 20, preferredTimescale: 600)

let asset = AVURLAsset(url: input)
let duration = try await asset.load(.duration)
guard duration >= CMTimeAdd(start, length) else { fail("the take is shorter than 80 s") }
guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHEVCHighestQuality) else {
    fail("this Mac cannot export HEVC")
}
export.timeRange = CMTimeRange(start: start, duration: length)
export.shouldOptimizeForNetworkUse = true
try await export.export(to: output, as: .mp4)

let size = (try? FileManager.default.attributesOfItem(atPath: output.path)[.size] as? Int) ?? 0
print("Wrote \(output.path) (\(size / 1024) KB, 20 s of the real take from 60 s, HEVC)")
