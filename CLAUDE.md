# AvieBaby — orientation for Claude

A toddler-safe Expo app built by **Ryan (uncle, Android)** for his 18-month-old niece **Ava**. Used on Ryan's phone and (planned) on **Kristen's iPhone** (Ava's mom, Ryan's sister).

The app has two modes:
- **Play mode** — single-screen play surface. Tap to spawn custom characters, drag to leave sparkle trails, press the **"Magic Button"** in the bottom-right to cycle three custom themed worlds.
- **Book mode** — adult picks a title + reader from the hidden adult panel; app rotates landscape; tap right half → next page, tap left half → previous; Grandma's (or whoever's) voice plays per page.

Long-press the top-left corner for 2 seconds to open the adult panel (also bottom-left in landscape — same physical corner).

**Primary docs to read first** (do this before making changes):
- `README.md` — comprehensive ops manual (setup, daily workflows, scripts, troubleshooting)
- `docs/asset-prompts.md` — Suno / Veo / Nano Banana prompts + workflows
- Specs: `docs/superpowers/specs/2026-06-13-library-and-readings-design.md` (current data model) and `docs/superpowers/specs/2026-06-13-ota-and-distribution-design.md` (OTA distribution)
- Recent git log — every conversation turn maps to a commit, the messages are dense context

## Status

**Everything below merged on `main` and pushed to `origin`** (`https://github.com/thewanderer313/AvieBaby`).

Done and verified on device (Ryan's Android via installed preview APK):
- Expo SDK 56, TypeScript
- Three themes (Sleepy Ocean / Sparkle Space / Disco Jungle) with real Veo backgrounds, Suno music, Nano Banana characters, family-recorded voice labels
- Magic button with squish-pop scale + 360° spin + glow halo + shockwave ring + Suno SFX
- Hidden adult panel: 4-mode audio toggle, theme jump, book picker, in-app pinning/Guided-Access tutorial, two-tap exit
- "Hi Ava!" launch greeting (Ryan's voice + text overlay) on cold launch — fires once per launch, not per magic-button press
- Library / titles / readings data model fully replaces the old shared-page book model
- Book-tool web GUI (`npm run book-tool`) with three tabs: Library (batch upload + filters + rename + archive), Titles (CRUD + cover), Readings (drag-and-drop page editor with @dnd-kit, click-to-enlarge thumbnails, audio cards drag onto page rows)
- First real book shipped: **Chicka Chicka Peep Peep, read by Grandma** (17 pages, in `assets/readings/rdg-0001/`)
- Book mode runtime: left-half tap → previous page, right-half tap → next page, bottom-left 120×120 excluded for the adult-panel hotspot; audio cleanly cuts when paging fast (pause-then-remove)
- OTA preview channel via EAS Update — `npm run publish-update -- --message "..."` pushes JS bundle + asset diff; family-installed binary picks it up on next cold launch
- Signed Android preview APK installed on Ryan's phone, OTA loop verified end-to-end with `runtimeVersion: { policy: "appVersion" }`

In flight: **iOS TestFlight build + family rollout** (see "Next" below).

## Audio modes

`AudioMode = 'silent' | 'gentle' | 'music' | 'full'`

| Mode | Music | SFX | Voice labels + greeting + book audio |
|---|---|---|---|
| silent | — | — | — |
| gentle | — | yes | yes |
| music | yes | yes | — *(for guests who don't want family voices on repeat)* |
| full | yes | yes | yes |

`shouldPlayMusic` is true for `full` and `music`. `shouldPlayVoice` is true for `gentle` and `full`. Persisted via `AsyncStorage`. See `src/audio/AudioController.ts`. Book mode mutes theme music unconditionally (the gate is `appMode === 'play' && shouldPlayMusic()`).

## Repo layout

```
App.tsx                              Root, mounts providers + back-intercept
eas.json                             EAS Build config (preview + production profiles)
app.json                             Expo config; bundle id com.thewanderer.aviebaby
                                     runtimeVersion policy is appVersion ("0.1.0")
                                     updates.url points at Expo's CDN
src/
  themes/{types,ThemeRegistry,ThemeProvider}
  audio/{AudioController,AudioProvider}
  books/{types,BookRegistry,BookProvider}     Auto-generated registry + runtime provider
  mode/AppModeProvider                        play | book mode state + orientation lock
  storage/settings                            AsyncStorage wrapper for audio mode
  components/
    BackgroundVideo                  expo-video, wrapped in pointerEvents="none"
    PlaySurface                      gesture-handler: tap spawns, pan emits sparkles
    SparkleParticles                 JS-thread rAF loop + Skia (NOT a Reanimated worklet)
    SpawnedCharacter                 Reanimated bounce-in + fade-out
    MagicButton                      Multi-layer: squish-pop, spin, ring, glow
    AdultPanel                       Long-press hotspot + Modal (settings + book picker
                                     + lockdown tutorial)
    Greeting                         "Hi Ava!" overlay + audio on cold launch
    BookScreen / BookPage / BookGestureSurface     Book mode runtime
    PlayScreen                       Wrapper for play-mode children

assets/
  greeting.mp3                       Launch greeting in Ryan's voice
  sfx/{sparkle,spawn}.mp3            Placeholders
  themes/<theme>/{background.mp4,music/,characters/,voices/}
  library/{images/,audio/,library.json}        Flat asset library
  titles/<title-id>/{title.json,cover.png}     One folder per book title
  readings/<reading-id>/reading.json           Per-reader page sequences
  android-icon-*.png, icon.png, splash-icon.png

scripts/
  book-page.sh / book-voice.sh / book-cover.sh      Asset pipelines (output-path args)
  voice.sh / greeting.sh                            Theme voice + greeting recordings
  boomerang.sh                                      Veo .mp4 → seamless loop
  icon.sh                                           1024×1024 source → all icon variants
  make-placeholders.sh                              ffmpeg-based stub generator
  book-register.js                                  (Re)generates src/books/BookRegistry.ts

tools/book-import/
  server/                            Express + multer (port 5174)
    routes/{library,titles,readings}.ts
    {library,titles,readings,locks,jobs,pipeline,validation,types}.ts
    __tests__/                       jest suite, 45 tests
  client/                            Vite + React 18 (port 5175)
    App.tsx + screens/{Library,Titles,Readings,ReadingEditor,PreviewOverlay}.tsx
    components/UploadDialog.tsx
    api.ts                           Client-side API surface
  scripts/dev.mjs                    `npm run book-tool` entry point

docs/
  asset-prompts.md                   Suno / Veo / Nano Banana prompts
  distributing.md                    EAS Build + TestFlight + APK runbook
  superpowers/specs/                 Per-feature design docs
  superpowers/plans/                 Per-feature implementation plans
```

## Asset pipeline at a glance

All scripts validate inputs and need `ffmpeg` on PATH. All take input + explicit output path (no more `<book-id> <page>` arg shape). Called by the book-tool's upload routes for the common path; usable directly from the shell for batch / custom work.

| Script | Input | Output | Used for |
|---|---|---|---|
| `book-page.sh <input> <output-path>` | page photo | 1920×1080 letterboxed PNG | Book pages |
| `book-voice.sh [--keep-tail] <input> <output-path>` | phone recording | Trimmed, normalized mono mp3 96k | Book audio |
| `book-cover.sh <input> <output-path>` | cover photo | 512×512 cropped PNG | Title-group covers |
| `voice.sh [--keep-tail] <input> <theme> <character-id>` | phone recording | `assets/themes/<theme>/voices/<id>.mp3` | Character voice labels |
| `greeting.sh [--keep-tail] <input>` | phone recording | `assets/greeting.mp3` | Launch greeting |
| `boomerang.sh <input.mp4> <theme>` | raw Veo clip | seamless-loop `background.mp4` | Theme background |
| `icon.sh <input.png> [bg-hex]` | 1024×1024 PNG | all icon variants | App icons |
| `node scripts/book-register.js` | (no args) | regenerates `src/books/BookRegistry.ts` | After any library/title/reading change (book-tool runs this automatically) |

`--keep-tail` skips end-of-clip silence trim — use when soft trailing consonants get clipped.

## Common commands

```bash
npm run start            # Expo dev server (for Expo Go testing)
npm run book-tool        # Local web GUI for managing books — 127.0.0.1:5175
npm run publish-update -- --message "..."   # Regenerate registry + push OTA update
npm run typecheck        # tsc --noEmit
npm test                 # jest (34 tests pass for main app)

cd tools/book-import && npm test            # 45 tests pass for the book-tool server
cd tools/book-import && npm run typecheck

# OTA / EAS
npx eas-cli build --platform android --profile preview         # rebuild Android APK
npx eas-cli build --platform ios --profile preview --auto-submit   # iOS to TestFlight
npx eas-cli update:list --branch preview --limit 5             # see recent OTA publishes
npx eas-cli build:list --platform android --limit 1            # see latest Android build's runtime version
```

## Next

**iOS TestFlight build for family review** is the next concrete task. The OTA + Android path is fully working; iOS just needs the binary built and submitted, then testers invited.

The remaining work (from `docs/superpowers/plans/2026-06-13-ota-and-distribution.md`, all MANUAL):

1. **Task 11** — `npx eas-cli build --platform ios --profile preview --auto-submit`. ~30-45 min build + ~10-15 min Apple processing. First build triggers a one-time Beta App Review (~24h Apple side).
2. **Task 12** — App Store Connect web UI → create "Family" external tester group, add Ryan's own Apple ID as smoke test.
3. **Task 13** — Add Wife as the first external tester; walk her through TestFlight install; verify she can use the app; publish a small OTA test from your machine and confirm two-cold-launch propagation works on her phone.
4. **Task 14** — Roll out to Mom, Dad, and Kristen the same way.
5. **Task 15** — After rollout, flip README's OTA + Distribution status from "Designed" to "Live" and fold real-world rollout learnings into `docs/distributing.md`.

After family rollout, future per-book workflow is just:
1. Open book-tool, upload pages + audio, assemble reading, save
2. `npm run publish-update -- --message "Added <Book> (<Reader>)"`
3. Family sees it on next cold launch

## Gotchas worth knowing

- **`runtimeVersion: { policy: "appVersion" }` is intentional.** Earlier we tried `fingerprint` policy, and even a one-line edit to `src/components/Greeting.tsx` shifted the Android fingerprint and broke OTA on installed binaries. With `appVersion`, the runtime version is just the literal `"0.1.0"` from `app.json` — every binary and every update at that version are mutually compatible. **To force everyone to need a new binary, bump `app.json`'s `version` field deliberately.** (Reasoning is in `docs/superpowers/specs/2026-06-13-ota-and-distribution-design.md` and the troubleshooting section of `docs/distributing.md`.)

- **`BackgroundVideo` wraps `VideoView` in a `pointerEvents="none"` View.** Don't remove that wrapper — a real playing Veo loop activates the native VideoView's touch handling, which previously swallowed the AdultPanel long-press. See commit `c47aa30`.

- **`SparkleParticles` runs on the JS thread via `requestAnimationFrame`**, NOT inside a Reanimated worklet. The original plan tried `useClock.value` + a JS-thread `Date.now()` `bornAt`, which mixed time domains AND read/wrote a JS ref from a UI-thread worklet (cross-thread, unsafe). The rewrite (`da25542`) fixed both. Don't put particle physics back into a worklet.

- **`AdultPanel` uses gesture-handler's `Gesture.LongPress`, not `Pressable.onLongPress`.** Pressable was getting starved of touches by `PlaySurface`'s Pan gesture sitting in BEGAN state waiting for movement. Stay on gesture-handler for that hotspot.

- **`BookGestureSurface` splits left/right halves** for prev/next (e-reader convention). The bottom-left 120×120 corner is excluded so the AdultPanel's 2 s long-press hotspot still fires from the same physical corner (= top-left of portrait device).

- **`playBookPage` calls `.pause()` before `.remove()`** on the previous audio player. `remove()` alone is async on Android's expo-audio runtime and lets the previous clip bleed into the next page's audio when pages advance fast.

- **`Greeting` audio uses a `playedRef` guard** so it fires AT MOST ONCE per app launch, even though the `playGreeting` callback identity changes whenever AudioProvider rebuilds (e.g., on theme switch). Without the guard, the greeting played every magic-button press.

- **`scripts/voice.sh` defaults are intentionally forgiving on the tail trim** (-55 dB, 500 ms) so soft endings like "-fish" don't get clipped. If a clip still cuts off, re-run with `--keep-tail`.

- **The duck-restore timer in `AudioProvider` is cancellable** via `duckTimerRef`. Rapid voice labels re-cancel and re-schedule the music restore, so the music stays ducked for the union of overlapping voice clips.

- **`asset-prompts.md` is the source of truth for Suno/Veo/Nano Banana prompts.** Update it whenever you find a prompt that works better.

- **`AppModeProvider` locks orientation via `expo-screen-orientation`.** Play mode is PORTRAIT_UP; book mode is LANDSCAPE_LEFT (counterclockwise so the same physical corner stays usable for the adult-panel hotspot). Don't add other orientation calls elsewhere.

- **`AudioProvider`'s music gate is `appMode === 'play' && shouldPlayMusic()`.** Music does NOT play in book mode regardless of audio mode. If you ever wanted background music *under* a book, that's a deliberate change to this gate.

- **`AdultPanel` hotspot position is mode-aware.** Portrait: top-left. Landscape (book mode): bottom-left of the screen, which is the same physical corner of the device.

- **Book-tool servers bind to `127.0.0.1` only** (localhost). To access from another device on the LAN you'd need to change both `tools/book-import/server/index.ts` and `tools/book-import/vite.config.ts` to bind `0.0.0.0`. Currently this is deliberate — keeps the tool local-only.

- **Vite proxy config in `tools/book-import/vite.config.ts` uses `^/api/` and `^/assets/`** (regex with trailing slash) instead of `/api` and `/assets` prefixes. The earlier prefix form intercepted `/api.ts` (the React app's own module) and forwarded it to the backend, breaking the React bundle. See commit `c4847c8`.

- **Root jest excludes `tools/book-import/`** via `testPathIgnorePatterns` in `jest.config.js`. The book-tool's server tests use ESM-style `.js` import extensions that the root jest config can't resolve. Run `cd tools/book-import && npm test` for that suite (45 tests). The main app's jest run gives 34 tests.

- **OTA publish-update uses `npx eas-cli`, not `eas`.** The script in `package.json` is `node scripts/book-register.js && npx eas-cli update --channel preview`. If you ever install `eas-cli` globally you can drop the `npx`, but the script needs to work on machines without the global install too.

- **App distribution doesn't show your custom icon in Expo Go.** Expo Go always shows its own purple icon on the home screen — your magic-wand creature only appears in real binary builds (TestFlight installs, signed APK installs).

## Workflow conventions

- Branch per non-trivial change (`feat/...`, `fix/...`). Merge to `main` with `--no-ff` so the merge commit captures intent. (Small fixes can land directly on main while the project is in flight.)
- Co-authored-by trailer on every commit Claude touched.
- Run `npm run typecheck && npm test` before every commit. For book-tool changes, also `cd tools/book-import && npm run typecheck && npm test`.
- Use the existing scripts; don't add new ffmpeg invocations elsewhere unless there's a real reason.
- `assets/` directories that need to stay tracked in git keep a `.gitkeep` — restore them with `git restore <path>` if they get accidentally removed by tooling.

## Expo SDK version pin

@AGENTS.md
