#!/usr/bin/env bash
# Exports the app's spoken-line list (built by the app's own code, via a unit test) and renders it
# with ElevenLabs into Echo/Resources/Voice/ (git-ignored). Run from anywhere; then rebuild and
# reinstall the app. Needs Config/ElevenLabs.xcconfig (git-ignored, see the .example file).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
cd "$here"
export DEVELOPER_DIR="${DEVELOPER_DIR:-$HOME/Downloads/Xcode-beta.app/Contents/Developer}"
out="$(mktemp -d)/phrases.json"
sim="${VOICE_SIMULATOR:-iPhone 18 Pro}"

echo "Exporting the phrase list from the app's code…"
TEST_RUNNER_VOICE_PHRASES_OUT="$out" xcodebuild -project Echo.xcodeproj -scheme Echo \
  -destination "platform=iOS Simulator,name=$sim" -derivedDataPath build/DerivedData \
  -only-testing:EchoTests/VoicePhraseExport test >/dev/null
[[ -s "$out" ]] || { echo "error: phrase export did not run (see the VoicePhraseExport test)" >&2; exit 1; }
echo "$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))))" "$out") lines to render."

swift scripts/render-voice.swift "$out"
echo "Now rebuild and reinstall the app."
