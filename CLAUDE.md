# AvieBaby — orientation for Claude

A toddler-safe Expo app built by **Ryan (uncle, Android)** for his 18-month-old niece **Ava**. Used on his phone and on **Kristen's iPhone** (Ava's mom).

The app is a single-screen play surface: tap to spawn custom characters, drag to leave sparkle trails, press the **"Magic Button"** in the bottom-right to cycle three custom themed worlds. Long-press the top-left corner for 2 seconds to open an adult settings panel.

**Primary docs to read first** (do this before making changes):
- `docs/superpowers/specs/2026-06-11-aviebaby-design.md` — the design spec
- `docs/superpowers/plans/2026-06-11-aviebaby.md` — the original 17-task plan
- `docs/asset-prompts.md` — Suno / Veo / Nano Banana prompts + workflows
- Recent git log — every conversation turn maps to a commit, the messages are dense context

## Status

**v1 features are merged on `main` and pushed to `origin`** (`https://github.com/thewanderer313/AvieBaby`).

Done and tested on device:
- Expo SDK 56, TypeScript, three themes (Sleepy Ocean / Sparkle Space / Disco Jungle) with real Veo backgrounds, Suno music (2 tracks per theme, no-back-to-back rotation), Nano Banana characters, family-recorded voice labels and launch greeting
- Magic button with squish-pop scale + 360° spin + glow halo + shockwave ring + Suno SFX
- Hidden long-press adult panel with: 4-mode audio toggle, theme jump, in-app pinning/Guided-Access tutorial, two-tap exit
- Android back-button intercepted, no permissions requested, no network calls
- "Hi Ava!" launch greeting (text + Ryan's voice) on app open

In flight: **iOS TestFlight build for Mom to review** (see "Next" below).

## Audio modes

`AudioMode = 'silent' | 'gentle' | 'music' | 'full'`

| Mode | Music | SFX | Voice labels + launch greeting |
|---|---|---|---|
| silent | — | — | — |
| gentle | — | yes | yes |
| music | yes | yes | — *(for guests who don't want to hear Ryan's voice on repeat)* |
| full | yes | yes | yes |

`shouldPlayMusic` is true for `full` and `music`. `shouldPlayVoice` is true for `gentle` and `full`. Persisted via `AsyncStorage`. See `src/audio/AudioController.ts`.

## Repo layout

```
App.tsx                              Root, mounts providers + back-intercept
eas.json                             EAS Build config (preview + production profiles)
app.json                             Expo config; bundle id com.thewanderer.aviebaby
src/
  themes/{types,ThemeRegistry,ThemeProvider}
  audio/{AudioController,AudioProvider}
  storage/settings                   AsyncStorage wrapper for audio mode
  components/
    BackgroundVideo                  expo-video, wrapped in pointerEvents="none"
                                     so the native VideoView doesn't swallow taps
    PlaySurface                      gesture-handler: tap spawns, pan emits sparkles
    SparkleParticles                 JS-thread rAF loop + Skia circles
                                     (NOT a Reanimated worklet — see "gotchas")
    SpawnedCharacter                 Reanimated bounce-in + fade-out
    MagicButton                      Multi-layer: squish-pop, spin, ring, glow
    AdultPanel                       Long-press hotspot + Modal with two views
                                     (settings + lockdown tutorial)
    Greeting                         "Hi Ava!" overlay + audio on launch
assets/
  greeting.mp3                       Launch greeting in Ryan's voice
  sfx/{sparkle,spawn}.mp3            Still placeholders — never recorded
  themes/<theme>/{background.mp4,music/track-{1,2}.mp3,characters/<id>.png,voices/<id>.mp3}
  android-icon-*.png, icon.png, splash-icon.png
scripts/
  make-placeholders.sh               ffmpeg-based stub generator
  boomerang.sh                       Veo .mp4 -> seamless loop background.mp4
  voice.sh                           Phone recording -> normalized voice label
  greeting.sh                        Same, for the launch greeting
  icon.sh                            1024x1024 source -> all icon variants
docs/
  superpowers/specs/2026-06-11-aviebaby-design.md
  superpowers/plans/2026-06-11-aviebaby.md
  asset-prompts.md                   Suno / Veo / Nano Banana prompts + recipes
```

## Asset pipeline at a glance

All scripts validate inputs and write into the right paths under `assets/`. All require `ffmpeg` on PATH.

| Script | Input | Output |
|---|---|---|
| `boomerang.sh <input.mp4> <theme>` | raw Veo 8s clip | seamless-loop `assets/themes/<theme>/background.mp4` |
| `boomerang.sh <theme>` | (already in place) | in-place boomerang with `.raw.mp4` backup |
| `voice.sh [--keep-tail] <input> <theme> <char>` | phone recording (m4a/wav/etc) | normalized `assets/themes/<theme>/voices/<char>.mp3` |
| `greeting.sh [--keep-tail] <input>` | phone recording | `assets/greeting.mp3` |
| `icon.sh <input.png> [bg-hex]` | 1024×1024 master icon | `assets/icon.png`, `splash-icon.png`, `android-icon-{foreground,background}.png` |

`--keep-tail` skips end-of-clip silence trim — use it when soft trailing consonants ("-sh", "-th", quiet "...you") get clipped.

## Common commands

```bash
npm run start            # Expo dev server
npm run typecheck        # tsc --noEmit
npm test                 # jest (20 tests pass currently)
scripts/make-placeholders.sh        # regenerate stub assets (ffmpeg required)
```

## Next

**iOS TestFlight build for Mom's review** is the next concrete task. Status: `eas.json` is committed with `preview` and `production` profiles. Ryan **has an Apple Developer account**. The steps remaining:

1. `npx eas-cli login` (interactive — Ryan's Expo account)
2. `npx eas-cli init` (writes project ID into `app.json`, links to Expo project)
3. `npx eas-cli build --platform ios --profile preview --auto-submit`
4. Once it lands in App Store Connect, add Mom as a TestFlight tester (her Apple ID email)
5. She gets the invite, installs TestFlight, then the app

After Mom approves, switch to the `production` profile, then `eas-cli submit` to publish for real distribution. Until then, OS-level lockdown lives in the in-app tutorial (long-press top-left, "Lock the phone for Ava").

## Gotchas worth knowing

- **`BackgroundVideo` wraps `VideoView` in a `pointerEvents="none"` View.** Don't remove that wrapper — a real playing Veo loop activates the native VideoView's touch handling, which previously swallowed the AdultPanel long-press. See commit `c47aa30`.
- **`SparkleParticles` runs on the JS thread via `requestAnimationFrame`**, NOT inside a Reanimated worklet. The original plan tried `useClock.value` + a JS-thread `Date.now()` `bornAt`, which mixed time domains, AND read/wrote a JS ref from a UI-thread worklet (cross-thread, unsafe). The rewrite (`da25542`) fixed both. Don't put particle physics back into a worklet.
- **`AdultPanel` uses gesture-handler's `Gesture.LongPress`, not `Pressable.onLongPress`.** Pressable was getting starved of touches by `PlaySurface`'s Pan gesture sitting in BEGAN state waiting for movement. Stay on gesture-handler for that hotspot.
- **`scripts/voice.sh` defaults are intentionally forgiving on the tail trim** (-55 dB, 500 ms) so soft endings like "-fish" don't get clipped. If a clip still cuts off, re-run with `--keep-tail`.
- **The duck-restore timer in `AudioProvider` is cancellable** via `duckTimerRef`. Rapid voice labels (which a toddler will produce) re-cancel and re-schedule the music restore, so the music stays ducked for the union of overlapping voice clips.
- **`asset-prompts.md` is the source of truth for Suno/Veo/Nano Banana prompts.** Update it whenever you find a prompt that works better.

## Workflow conventions

- Branch per change, descriptive name (`feat/...`, `fix/...`). Merge to `main` with `--no-ff` so the merge commit captures the intent.
- Co-authored-by trailer on every commit Claude touched.
- Run `npm run typecheck && npm test` before every commit.
- Use the existing scripts; don't add new ffmpeg invocations elsewhere unless there's a real reason.

## Expo SDK version pin

@AGENTS.md
