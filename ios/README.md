# `ios/`: the Echo app for iPhone and Meta glasses

A SwiftUI app for iPhone that drives Meta AI glasses through Meta's **Device Access Toolkit (DAT)**. It has two modes:

- **Chef** records a recipe through the glasses camera.
- **Cook** guides someone through that recipe hands-free. Step cards appear in the lens, the glasses camera checks the work against the chef's footage, and you can ask questions out loud.

## What it does

**Chef mode** (`Echo/Chef/`, `Echo/UI/ChefRecordView.swift`)
1. Asks for consent, then records video and audio from the glasses camera. The phone camera exists only as a labelled development fallback.
2. Records a step mark each time the chef pinches (glasses *select*), taps a lens button, or taps "New step".
3. Names the take, re-encodes it on the phone if it is over 45 MB (`TakeShrinker`), and uploads it straight to Supabase Storage through a signed URL (TUS or a single `PUT`).
4. Hands off to the web review page (`<API base>/app/review/`), where Gemini's extracted steps are checked and published.

**Cook mode** (`Echo/Session/`, `Echo/Watcher/`, `Echo/UI/CookView.swift`)
1. Pick a published recipe. Every reference image and clip downloads before cooking starts, so only the checks need the network.
2. Each step shows a lens card: icon, heading, up to two lines of text, the chef's reference still and a meta line.
3. **Check:** pinch, say "check", or tap. One frame goes to `POST /check`, and the answer is *pass*, *fix* (with one instruction) or *unsure* (with how to get a better view).
4. **Watcher:** about every 2.5 s, a low-resolution frame goes to `POST /watch`. A warning appears only after two consecutive hits for the same known mistake. A "● watching" indicator is shown whenever frames are being sent.
5. **Voice:** hold to ask a question. Gemini Live answers from the chef's transcript, and voice commands (`check_my_work`, `next_step`, `previous_step`, `show_me`, `repeat_instruction`) run the same code paths as gestures.
6. A Done screen summarises how many steps passed first try and how many fixes were caught.

**Glasses input** (`Glasses/GlassesInputAdapter.swift`): select = Check, right = Next, left = Back, back = Dismiss, up = Show me. The lens also has Check / Next / Dismiss buttons.

**Accessibility:** every lens state has a spoken form, and an audio-only mode serves glasses without a display. The DAT display only offers primary and secondary text colours, so pass and fix are told apart by icon and wording, never by colour alone.

## How it is built

| Piece | Where | Role |
|---|---|---|
| `FrameSource` | `Frames/` | One protocol, three implementations: glasses (`DATFrameSource`), phone camera, still image (tests). Switchable at runtime |
| `LensScreen` | `Session/LensScreen.swift` | One enum describes exactly what the lens shows. Renderers only draw it, so the phone preview and the glasses can never disagree |
| `CookSession` | `Session/` | `@MainActor @Observable` state machine with injected API, frame source, speech and clock. Unit-tested without a device |
| `WatchDebouncer`, `WatcherLoop` | `Watcher/` | Debounce, pause rules, stale-answer rejection |
| `GlassesManager`, `GlassesCards` | `Glasses/` | DAT session, camera stream, display cards, inputs |
| `LiveClient` | `Voice/` | Raw WebSocket to Gemini Live (`BidiGenerateContentConstrained`) using an ephemeral token from the backend. 16 kHz up, 24 kHz down |
| Speech | `Voice/` | On-device speech for results. Pre-rendered ElevenLabs lines are used when they are bundled |

**SDK:** `meta-wearables-dat-ios` pinned to **exactly 1.0.1** (`project.yml`). The app uses MWDATCore, MWDATCamera, MWDATDisplay, MWDATInputs, and MWDATMockDevice (for development without hardware).

**Keys:** the phone holds no Gemini or Supabase key. It sends the shared `X-Demo-Key` to the backend, receives a short-lived Live token, and gets a single signed upload URL for a Chef take. The Live model is chosen by the backend's token response, not hard-coded.

## What has been verified

From [STATUS.md](STATUS.md), which has dates and details:

- **On real Meta glasses (borrowed pair, 14 Nov):** one Chef-mode take, 2 min 14 s at 720×1280. The phone upload failed with HTTP 413 (above Supabase's 50 MiB limit). A shrunk copy was then processed by the backend into a 5-step recipe and published. The demo recipe is built from that take.
- **On the iPhone, with the backend in fake-AI mode:** the full cook-along loop (warning, fix, re-check, pass) and offline behaviour in airplane mode.
- **On MockDeviceKit (simulator):** registration, camera stream (720×1280, 24 fps mock feed), image plus text in one lens card, stream and display running together for 60 s, and glasses inputs arriving in the app.
- **Not yet verified on real glasses:** the Cook-mode loop end to end, audio routing through the glasses, and the recovery tests. Real-Gemini verdicts on the device have not been measured.

## Run it

You need:
- a Mac with Xcode
- an iPhone on iOS 17.2+ (a real device is needed for the camera and the glasses)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- the Meta AI app with **Developer Mode** turned on, to pair the glasses

```bash
cd ios
cp Config/Secrets.example.xcconfig Config/Secrets.xcconfig   # API_BASE_URL, DEMO_API_KEY, signing team
swift scripts/make-mock-feed.swift                           # MockDeviceKit camera feed (git-ignored)
scripts/render-voice.sh                                      # optional: ElevenLabs voice lines
xcodegen generate
open Echo.xcodeproj
```

The backend URL and key can also be changed at runtime in Settings. The data source can be the backend or the bundled fixture recipe. Tests use Swift Testing and run on the `Echo` scheme (`xcodebuild … test` with a simulator destination).

## Layout

```
ios/
  project.yml            XcodeGen spec (targets, DAT package, Info.plist keys)
  Config/                Config.xcconfig, *.example.xcconfig templates (secrets untracked)
  Echo/
    App/ Models/ Networking/      app shell, contract types, API client
    Frames/ Glasses/              frame sources, DAT session, lens cards, input mapping
    Session/ Watcher/ Lens/       cook state machine, lens model, watcher, phone preview
    Voice/ Chef/ UI/ Resources/   Live client, speech, recording + upload, screens, fixtures
  EchoTests/             unit tests (Swift Testing)
  scripts/               mock feed, voice rendering, take shrinker, fixture sync
  STATUS.md  tasks/      build log and the team's task batches
```

The interfaces this app calls are in [../docs/API-CONTRACT.md](../docs/API-CONTRACT.md).
