# AvieBaby

A toddler-safe Expo app built by Ryan for his niece Ava (18 months old). Two modes — Play and Book — with custom themes, family voice recordings, and a hidden adult control panel. Distributed to family via TestFlight (iOS) and signed APK (Android). New books ship over the air; no re-install needed.

This README is the operations manual: how to set up, how to add a book, how to record themes, how to ship updates, and where everything lives.

---

## Contents

- [Quick start](#quick-start)
- [What's in this app](#whats-in-this-app)
- [Adding a book — the easy way](#adding-a-book--the-easy-way-book-tool)
- [Adding a theme — Suno + Veo + Nano Banana](#adding-a-theme--suno--veo--nano-banana)
- [Publishing updates to family (OTA)](#publishing-updates-to-family-ota)
- [Adult control panel](#adult-control-panel)
- [Audio modes](#audio-modes)
- [Asset pipeline scripts](#asset-pipeline-scripts)
- [Project structure](#project-structure)
- [Pre-handoff smoke tests](#pre-handoff-smoke-tests)
- [Locking down the phone for Ava](#locking-down-the-phone-for-ava)
- [Distribution to family (binary builds)](#distribution-to-family-binary-builds)
- [Troubleshooting](#troubleshooting)
- [Design documents](#design-documents)
- [What's NOT in this app](#whats-not-in-this-app)

---

## Quick start

Prerequisites:
- **Node.js** (whatever `npm run start` needs — currently Expo SDK 56 supports Node 18+)
- **ffmpeg** on PATH. On Windows: `winget install --id Gyan.FFmpeg --scope user`, then open a fresh Git Bash. Test with `ffmpeg -version`.
- **Git Bash** (or any Bash shell) for the asset scripts. PowerShell works for npm commands.

Clone and run:

```bash
git clone https://github.com/thewanderer313/AvieBaby
cd AvieBaby
npm install
cd tools/book-import && npm install && cd ../..
npm run start
```

Two dev commands you'll use a lot:

```bash
npm run start         # Expo dev server (run app on phone via Expo Go)
npm run book-tool     # Local web GUI for adding books — opens at 127.0.0.1:5175
```

Verification:

```bash
npm run typecheck     # main app TypeScript check
npm test              # main app jest (small suite — runtime behavior)
cd tools/book-import && npm test     # book-tool server tests
```

---

## What's in this app

Two modes, switched by the hidden adult panel:

1. **Play mode** (default). Single-screen play surface. Tap to spawn themed characters, drag for sparkle trails, press the **Magic Button** in the bottom-right to cycle three themed worlds (Sleepy Ocean / Sparkle Space / Disco Jungle). Each theme has its own background video, music, characters, and family-recorded voice labels.
2. **Book mode**. Adult picks a book title and a reader. App rotates to landscape. Ava taps to advance pages, long-presses to go back. Voice plays per page. Loops at the end.

**The "Hi Ava!" greeting** plays once on cold launch (Ryan's voice, recorded in `assets/greeting.mp3`).

**Data model:** books are stored as three independent concepts on disk:
- `assets/library/` — flat library of image and audio files with metadata
- `assets/titles/<id>/` — title-group records (display name, optional cover)
- `assets/readings/<id>/` — per-reader independent page sequences

Each reading is fully independent. Mom's version of "Goodnight Moon" can have different pages, ordering, or page count from Dad's. They show up grouped under the same title because they share a `titleId`.

---

## Adding a book — the easy way (book-tool)

The book-tool is a local web GUI for assembling books from scanned pages + audio. No shell commands needed for the common path.

```bash
npm run book-tool
```

Opens browser at `127.0.0.1:5175`. Three tabs:

### 1. Library

Upload pools of images and audio with metadata.

**Upload images:**
- Tap "Upload images" → pick 1..N page photos → enter a `source` name (typically the book title, e.g. `Goodnight Moon`) → upload.
- Each image runs through `book-page.sh` (1920×1080 letterboxed PNG) and gets an id like `img-0001`.

**Upload audio:**
- Tap "Upload audio" → pick 1..N voice clips → enter `source` and `reader` (e.g. `Goodnight Moon` + `Uncle Ryan`) → toggle "Keep tail" if a clip has a soft trailing word that might be clipped → upload.
- Each clip runs through `book-voice.sh` (trim silence, normalize, mono mp3 96 kbps) and gets an id like `aud-0001`.

Filters at the top let you narrow the view by source / reader / type.

### 2. Titles

Title-groups are real-world book titles. One per book.

- "+ New title" → display name + optional cover image. Slug id is derived automatically (`Goodnight Moon` → `goodnight-moon`).
- Edit lets you rename (display name only — the slug id is locked at creation) and replace the cover.
- Delete is blocked if any reading still references the title.

### 3. Readings

A reading is one reader's version of a title. Multiple readings can share the same title — they're shown grouped.

- "+ New reading" opens the editor:
  - Pick a title from the dropdown
  - Type the reader's display name (`Uncle Ryan`, `Mommy`, etc.)
  - Add page rows. Each row has an image picker and an audio picker, both filtered by default to assets whose `source` matches the title's display name (and for audio, whose `reader` matches the reader name).
  - **Drag the handle on the left of each row to reorder pages.** Keyboard arrows work too when the handle is focused.
  - "+ Add page" appends a blank row. The `×` button removes a row.
  - Save validates that every row has both an image and an audio asset.
- Preview button on each reading card opens an inline player that walks the pages.

### Typical workflow for a new book

1. Photograph or scan all pages of the book, transfer to your computer.
2. Record yourself reading each page (or have whoever's reading it do so) — one clip per page. Phone voice recorder is fine.
3. `npm run book-tool` → Library tab → batch-upload the page images with `source = <Book Title>`.
4. Library tab → batch-upload the audio with `source = <Book Title>` and `reader = <Your Display Name>`.
5. Titles tab → "+ New title" with the same display name + cover.
6. Readings tab → "+ New reading" → pick the title, type your name, add pages and assign each row's image + audio, reorder if needed, save.
7. Preview the reading. Confirm pages and audio line up.
8. Cold-launch the Expo app on your phone (or hit `r` in the dev server). The book appears in the adult panel's book picker.

### Adding a second reader to an existing book

1. Library tab → upload that reader's audio with the same `source` (matching the title's display name) and the new reader name.
2. Readings tab → "+ New reading" → pick the same title, type the new reader's name, build their independent page sequence.

The original reader's reading is untouched. Both show up grouped under the same book title.

### When to use the underlying scripts directly

The book-tool handles the common path. The shell scripts under `scripts/` are still there if you need to batch-process from the command line or scriptify something custom. See the [Asset pipeline scripts](#asset-pipeline-scripts) section.

---

## Adding a theme — Suno + Veo + Nano Banana

Each theme has these slots under `assets/themes/<theme-name>/`:

```
background.mp4              5–10s seamless loop, H.264, ≤2 MB
music/track-1.mp3           30–60s loopable
music/track-2.mp3           30–60s loopable
characters/<id>.png         transparent background, ~512px
voices/<id>.mp3             single word, ~1.5s, family voice
```

### The prompts

**`docs/asset-prompts.md` is the source of truth** for the Suno, Veo, and Nano Banana prompts. Update it whenever you find a prompt that works better than the previous one.

Quick reference:

| Tool | What it makes | Output |
|---|---|---|
| **Suno** | Theme music (2 tracks per theme) | mp3, 30–60s, loopable |
| **Veo 3** | Themed background loop | mp4, 5–10s, seamless loop |
| **Nano Banana** (Gemini 2.5 Flash Image) | Characters | PNG, transparent background, centered |

### Pipeline per theme

1. **Music (Suno)**. Generate two tracks per theme. Trim to a clean 30–60 second loop point in any audio editor. Export as mp3. Save as `assets/themes/<theme>/music/track-1.mp3` and `track-2.mp3`.

2. **Background (Veo)**. Generate a 5–10 second clip. The prompt must include "seamless loop, final frame matches first frame." Re-encode + boomerang for clean looping:

   ```bash
   # Either: bake your own H.264 mp4
   ffmpeg -i input.mp4 -vf "scale=720:-2" -c:v libx264 -crf 26 -preset slow \
     -pix_fmt yuv420p -movflags +faststart -an background.mp4

   # Or: use the boomerang helper to make it seamless
   scripts/boomerang.sh <input.mp4> <theme>           # writes assets/themes/<theme>/background.mp4
   scripts/boomerang.sh <theme>                       # in-place boomerang with .raw.mp4 backup
   ```

3. **Characters (Nano Banana)**. For each character, prompt for "transparent background, centered, no shadow, friendly toddler-safe character." Export PNG. Save as `assets/themes/<theme>/characters/<id>.png`.

4. **Voices for character labels**. Family member records the character name in their phone's voice recorder (one word per clip). Then:

   ```bash
   scripts/voice.sh [--keep-tail] <recording.m4a> <theme> <character-id>
   ```

   `--keep-tail` skips the end-of-clip silence trim. Use it when soft trailing consonants ("-sh", "-th") get clipped.

5. **Register the new character** in `src/themes/ThemeRegistry.ts`. Add an entry to that theme's `characters` array. The PNG and voice clip filenames must match the `id` you give it.

### Greeting

`assets/greeting.mp3` is the "Hi Ava!" cold-launch greeting in Ryan's voice. To re-record:

```bash
scripts/greeting.sh [--keep-tail] <input.m4a>     # writes assets/greeting.mp3
```

### App icons

To swap the icon, source a 1024×1024 PNG, then:

```bash
scripts/icon.sh <input.png> [bg-hex]              # writes all icon variants
```

Produces `assets/icon.png`, `assets/splash-icon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`.

---

## Publishing updates to family (OTA)

> **Status:** Designed in `docs/superpowers/specs/2026-06-13-ota-and-distribution-design.md`. Implementation pending.

Once OTA is wired up, adding a book on your machine will land on Kristen's phone (and any other family member's) without a re-install:

```bash
node scripts/book-register.js
eas update --channel preview --message "Added Goodnight Moon (Mom)"
```

(Wrapped into one npm script: `npm run publish-update -- --message "..."`)

How it works at runtime:

1. Cold launch on Kristen's phone fires an update check against the Expo CDN.
2. If a newer bundle exists, it downloads in the background. The cached (older) bundle keeps serving the current session.
3. On the **next** cold launch, the new bundle applies. Books appear.

Worst case from publish to visible: two cold launches (one to detect + download, one to apply). For a toddler-driven device, that's usually within hours.

See the [Distribution to family (binary builds)](#distribution-to-family-binary-builds) section for how the initial install happens and the TestFlight 90-day maintenance loop.

---

## Adult control panel

Hidden hotspot, two-second long-press required.

**Play mode:** top-left corner of the screen.
**Book mode:** bottom-left corner of the screen (which is the same physical corner of the device after the landscape rotation).

Panel contents:

- **Audio mode** — Silent / Gentle / Music / Full (see table below)
- **Jump to theme** — directly pick Sleepy Ocean / Sparkle Space / Disco Jungle
- **Read a book to Ava** — opens the book picker (title → reader → enter book mode)
- **Lock the phone for Ava** — opens an in-app tutorial for OS-level lockdown (Android App Pinning / iOS Guided Access)
- **Exit book** (book mode only) — returns to play mode, rotates back to portrait
- **Exit app** — requires a second confirm tap

The panel auto-dismisses after 5 seconds of inactivity. The Android hardware back button is intercepted — it does nothing.

---

## Audio modes

| Mode | Music | SFX (magic button, spawn, sparkle) | Voice labels + greeting |
|---|---|---|---|
| **Silent** | — | — | — |
| **Gentle** | — | yes | yes |
| **Music** | yes | yes | — *(for guests who don't want Ryan's voice on repeat)* |
| **Full** | yes | yes | yes |

Persisted via `AsyncStorage`. The setting carries across launches.

In book mode, the music gate is `appMode === 'play' && shouldPlayMusic()` — so theme music never plays *under* a book. Voice labels and book audio still play if the mode allows.

---

## Asset pipeline scripts

All scripts validate inputs and need `ffmpeg` on PATH. All paths are repo-root relative; run them from the repo root or use absolute paths.

| Script | Input | Output | Used for |
|---|---|---|---|
| `scripts/book-page.sh <input> <output-path>` | Page photo (jpg/png/heic) | 1920×1080 letterboxed PNG | Book pages (called by the book-tool's library upload route) |
| `scripts/book-voice.sh [--keep-tail] <input> <output-path>` | Phone recording (m4a/wav/etc) | Trimmed, normalized mono mp3 96 kbps | Book audio (called by the book-tool's library upload route) |
| `scripts/book-cover.sh <input> <output-path>` | Cover photo | 512×512 cropped PNG | Title-group covers (called by the title cover upload route) |
| `scripts/voice.sh [--keep-tail] <input> <theme> <character-id>` | Phone recording | `assets/themes/<theme>/voices/<id>.mp3` | Character voice labels |
| `scripts/greeting.sh [--keep-tail] <input>` | Phone recording | `assets/greeting.mp3` | Launch greeting |
| `scripts/boomerang.sh <input.mp4> <theme>` | Raw Veo clip | Seamless-loop `assets/themes/<theme>/background.mp4` | Theme background |
| `scripts/boomerang.sh <theme>` | (in-place) | Backs up `.raw.mp4`, replaces with boomerang | Re-boomerang an existing background |
| `scripts/icon.sh <input.png> [bg-hex]` | 1024×1024 PNG | All icon variants | App icons |
| `scripts/make-placeholders.sh` | — | Stub assets across the asset tree | Regenerate placeholders after a clean checkout |
| `node scripts/book-register.js` | — | Regenerates `src/books/BookRegistry.ts` | Run after any library / title / reading change (the book-tool does this automatically, but you can run it manually if you ever edit JSON by hand) |

`--keep-tail` (on `book-voice.sh`, `voice.sh`, `greeting.sh`): skips the end-of-clip silence trim. Use when soft trailing consonants ("-sh", "-th", "...you") get clipped.

---

## Project structure

```
App.tsx                              Root, mounts providers + back-intercept
app.json                             Expo config; bundle id com.thewanderer.aviebaby
eas.json                             EAS Build config (preview + production)

src/
  themes/{types,ThemeRegistry,ThemeProvider}
  audio/{AudioController,AudioProvider}
  books/{types,BookRegistry,BookProvider}     Auto-generated registry + runtime provider
  mode/AppModeProvider                        play | book mode state + orientation lock
  storage/settings                            AsyncStorage wrapper for audio mode
  components/
    BackgroundVideo                  expo-video, wrapped in pointerEvents="none"
    PlaySurface                      gesture-handler: tap spawns, pan emits sparkles
    SparkleParticles                 JS-thread rAF loop + Skia
    SpawnedCharacter                 Reanimated bounce-in + fade-out
    MagicButton                      Multi-layer: squish-pop, spin, ring, glow
    AdultPanel                       Long-press hotspot + Modal with picker + tutorial
    Greeting                         "Hi Ava!" overlay + audio on cold launch
    BookScreen / BookPage / BookGestureSurface     Book mode

assets/
  greeting.mp3                       Launch greeting in Ryan's voice
  sfx/{sparkle,spawn}.mp3            Placeholders
  themes/<theme>/{background.mp4,music/,characters/,voices/}
  library/{images/,audio/,library.json}        Flat asset library
  titles/<title-id>/{title.json,cover.png}     One folder per book title
  readings/<reading-id>/reading.json           Per-reader page sequences
  android-icon-*.png, icon.png, splash-icon.png

scripts/
  book-page.sh / book-voice.sh / book-cover.sh      Asset pipelines
  voice.sh / greeting.sh                            Theme voice + greeting
  boomerang.sh                                      Veo .mp4 → seamless loop
  icon.sh                                           Icon variants
  make-placeholders.sh                              Stub generator
  book-register.js                                  Registry generator (book-tool runs it on writes)

tools/book-import/
  server/                            Express + multer (port 5174)
  client/                            Vite + React 18 (port 5175)
  scripts/dev.mjs                    npm run book-tool entry point

docs/
  asset-prompts.md                   Suno / Veo / Nano Banana prompts
  superpowers/specs/                 Design docs per feature
  superpowers/plans/                 Implementation plans per feature
```

---

## Pre-handoff smoke tests

Run these before handing the phone to Ava (especially after an OTA update or a new build).

### Play mode

1. Cold-launch the app. **Silent mode (default)** — tap and drag. Animations work, no audio at all.
2. Long-press top-left for 2 s → adult panel opens.
3. Switch to **Full** audio. Close panel. Tap once → spawn animation + voice label + music playing.
4. Press magic button → music swaps to the next theme, video swaps, button color changes.
5. Long-press top-left → audio still Full. Press Exit → confirm → app closes.
6. Reopen → audio is still Full (persisted).
7. Press magic button rapidly several times → no crashes.
8. Android only: press the hardware back button → nothing happens.

### Book mode

1. Long-press top-left for 2 s → adult panel.
2. Tap "Read a book to Ava" → pick a book → pick a reader.
3. App rotates to landscape, page 1 appears, audio starts.
4. Tap → page 2, audio cuts over.
5. Hold (~1 s) on the page → page 1 returns.
6. Tap through to the last page, tap once more → loops to page 1.
7. Long-press top-left of the device (= bottom-left of the screen in landscape) for 2 s → adult panel with "Exit book" at top.
8. Tap "Exit book" → returns to portrait + play mode.
9. Set audio to **Silent** in the panel, re-enter the book → pages advance on tap but no audio plays.

---

## Locking down the phone for Ava

The app handles its own exit gate, but the strongest lock is the OS-level one. Set it up once per phone. The adult panel has an in-app tutorial under "Lock the phone for Ava."

### Android (App Pinning)

1. Settings → Security & privacy → Other security settings → **App pinning** → ON.
2. Toggle **"Ask for PIN before unpinning"** ON.
3. Open the AvieBaby app, then open the Recents view.
4. Tap the AvieBaby icon at the top of its card → **Pin**.
5. To unpin: swipe up from the bottom and hold; phone asks for the PIN.

### iOS (Guided Access)

1. Settings → Accessibility → **Guided Access** → ON.
2. Set a Guided Access passcode (enable Touch ID / Face ID if you want).
3. Open AvieBaby.
4. Triple-click the side button → **Start**.
5. To exit: triple-click side button → enter passcode → **End**.

---

## Distribution to family (binary builds)

> **Status:** Designed in `docs/superpowers/specs/2026-06-13-ota-and-distribution-design.md`. Implementation pending.

### iOS — TestFlight

One-time per family member:

1. You: `eas build --platform ios --profile preview --auto-submit`
2. Wait ~10 minutes for Apple to process the upload.
3. App Store Connect web UI → TestFlight → External Testing → "Family" group → add the tester's Apple ID email.
4. Tester: receives email invite → installs the **TestFlight** app from the App Store → taps the invite link → AvieBaby installs.

First-build only: Apple does a one-time Beta App Review (~24 hours, sometimes faster). Subsequent builds within the same major version flow through without review.

**TestFlight builds expire after 90 days.** Calendar reminder every ~85 days: rerun `eas build --platform ios --profile preview --auto-submit`. Cached OTA books survive the binary refresh.

### Android — direct APK

One-time per family member:

1. You: `eas build --platform android --profile preview`
2. EAS produces a download URL.
3. Share the URL with the tester.
4. Tester: taps the URL on their phone → Android prompts "Allow install from this source" → accept → APK installs.

When you ship a new binary (Expo SDK bump or new native module), share the new URL. They install on top of the existing app.

### Adding a tester

| Recipient | iOS | Android |
|---|---|---|
| Wife | Add her Apple ID to the "Family" group in App Store Connect | Share latest APK link |
| Mom / Dad | Same | Same |
| Kristen | Same | Same |

The app itself has no accounts. There's no "user" concept; everyone runs the same app pulling from the same OTA channel.

---

## Troubleshooting

### The book doesn't appear in the adult panel after I added it

You forgot to run the registry generator. The book-tool runs `node scripts/book-register.js` automatically after every write — but if you edited a JSON file by hand, run it yourself:

```bash
node scripts/book-register.js
```

Then reload Expo (hit `r` in the dev server, or restart with `npx expo start --clear`).

### Pages advance but no audio plays

Check your audio mode (long-press → adult panel). In **Silent** mode, book audio is silenced. Switch to **Gentle**, **Music**, or **Full**.

### A specific page's word is being cut off at the end

Re-upload that one audio clip via the Library tab with the "Keep tail" checkbox toggled. Or from the command line:

```bash
scripts/book-voice.sh --keep-tail <input> <output-path>
```

Then re-run `node scripts/book-register.js`.

### The book-tool browser page is blank

Open browser dev tools (F12) → Console tab → reload. The first time, this was a Vite proxy bug intercepting the React app's own `/api.ts` module. Fixed in `vite.config.ts`. If it ever happens again, look for any new route prefix the proxy might be eating.

### `npm test` fails with "Reader has N audio pages but the book has M image pages"

Mismatch between a reading's page count and the assets it references. Open the reading in the book-tool's Readings tab → "Edit" → ensure every row has both an image and an audio selected.

### Asset disk usage is growing

Each book is ~2–5 MB. After ~50 books, you'll be at ~250 MB of bundled assets. EAS Update's CDN handles this fine; iOS bundle size starts to matter for App Store builds (which is a future concern, not preview).

### "Hi Ava!" plays every time the magic button is pressed

This was a bug fixed by `playedRef` in `src/components/Greeting.tsx`. If you see this regression, check that the `playedRef.current` guard is intact.

### TestFlight build disappeared from Kristen's phone

That's the 90-day expiry. Run `eas build --platform ios --profile preview --auto-submit` again and the build re-appears on her TestFlight automatically.

---

## Design documents

Every major feature has a spec and a plan. If you're picking the project back up after a long break, these are the fastest way to remember why something works the way it does.

| Feature | Spec | Plan |
|---|---|---|
| v1 play mode | `docs/superpowers/specs/2026-06-11-aviebaby-design.md` | `docs/superpowers/plans/2026-06-11-aviebaby.md` |
| Book mode v1 (the shared-page model) | `docs/superpowers/specs/2026-06-12-book-mode-design.md` | `docs/superpowers/plans/2026-06-12-book-mode.md` |
| Book import tool (web GUI) | `docs/superpowers/specs/2026-06-12-book-import-tool-design.md` | `docs/superpowers/plans/2026-06-12-book-import-tool.md` |
| Library + readings model (current) | `docs/superpowers/specs/2026-06-13-library-and-readings-design.md` | `docs/superpowers/plans/2026-06-13-library-and-readings.md` |
| OTA + distribution | `docs/superpowers/specs/2026-06-13-ota-and-distribution-design.md` | (implementation plan pending) |

Asset prompt reference: `docs/asset-prompts.md` — source of truth for Suno / Veo / Nano Banana prompts. Update it whenever you find a prompt that works better.

Working notes for Claude: `CLAUDE.md` (project orientation) and `AGENTS.md` (Expo SDK pin reminder).

---

## What's NOT in this app

By design:
- No internet calls at runtime (the only network traffic post-install is `expo-updates`' cold-launch check; nothing else)
- No analytics, no telemetry
- No ads, no in-app purchases
- No sign-in, no accounts, no profiles
- No camera, microphone, or location permissions
- No notifications
- No progress tracking, no learning quizzes
- No recordings of Ava — ever. The microphone permission is not requested.
- No photos of Ava — ever.

Data on third-party infrastructure is limited to:
- **Apple (TestFlight)**: the iOS binary, including whatever assets were bundled at build time. Stored for the duration of the 90-day TestFlight window.
- **Expo (EAS Update CDN)**: OTA bundles — JS code + asset diffs published via `eas update`. Stored as long as the channel is active.

Both contain page photos of books, theme assets, and adult voice recordings of bedtime stories. Neither contains any data captured from Ava's device at runtime.
