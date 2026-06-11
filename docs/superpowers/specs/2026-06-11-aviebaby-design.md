# AvieBaby — Design Spec

**Date**: 2026-06-11
**Owner**: Ryan (uncle)
**Primary user**: Ava, 18 months old
**Adult operators**: Ryan (Android), Kristen (iPhone)

## Purpose

A single-purpose phone app that an adult can hand to an 18-month-old for safe, entertaining, mildly educational play. Optimized for three things, in this order:

1. **Safe** — she cannot escape the app, see anything inappropriate, make purchases, or affect anything else on the device.
2. **Adult-friendly** — does not annoy the adults in the room (controllable audio, no jingles on loop, no flashing ads).
3. **Delightful for Ava** — taps it, drags fingers across it, and the world responds with custom characters, colors, music made by her family.

Secondary goal: passive language exposure through familiar-voice labeling of characters she taps.

## Core experience

A single full-screen play surface. Three interactions, no menus, no decisions for Ava:

- **Tap** — spawns a custom character at the touch point with a bounce-in animation; a soft family-voice label says the character's name once (e.g., "Whale!").
- **Drag** — leaves a trail of colorful sparkly particles behind the finger; particles fade after ~1 second.
- **Magic button** — one large colored button fixed in a bottom corner. Each press advances to the next themed world (cycles through three, then loops). Press triggers a sparkle burst and crossfade.

Touch is the entire interaction model. There are no swipes, no pinches, no swipe-from-edge gestures the app needs to handle.

## The three themes (v1)

Each theme is a complete self-contained world composed of:
- 1 looping background video (5–10s seamless loop, Veo 3)
- 2 music tracks (30–60s loopable, Suno)
- 2–3 character images (transparent PNG, Nano Banana)
- 1 voice clip per character, recorded by Ryan or Kristen
- A sparkle color palette (4–6 colors used for the drag trail)

| Theme | Energy | Vibe | Example characters |
|---|---|---|---|
| Sleepy Ocean | Calm | Glowy underwater, slow drift, lullaby Suno tracks | Whale, jellyfish, starfish |
| Sparkle Space | Medium | Starfield, twinkly Suno tracks | Rocket, alien, comet |
| Disco Jungle | High | Bright jungle, funk Suno tracks | Dancing banana, monkey, parrot |

The magic button advances in fixed order: Sleepy Ocean → Sparkle Space → Disco Jungle → Sleepy Ocean.

When entering a theme, the app picks one of its two music tracks at random; on next entry, picks the other (never repeats back-to-back).

## Audio model

Three modes, set by the adult:

- **Silent** — no audio at all. Sparkles and animations carry the experience. Default.
- **Gentle** — sound effects (sparkle chimes, soft spawn pops) + character voice labels. No music.
- **Full** — sound effects + voice labels + Suno music. Music ducks briefly when a voice label plays.

Default is **Silent** on first install so an adult is never surprised in public. The choice persists across launches via `AsyncStorage`.

Theme changes always crossfade music (1s fade out, 1s fade in).

## Adult controls (hidden)

Single hidden gesture: **long-press the top-left corner for 2 full seconds**. Opens a small overlay containing:

- **Audio mode**: Silent / Gentle / Full (radio)
- **Jump to theme**: three buttons, one per theme
- **Exit app**: requires a second confirm tap; closes the app
- **Close** (X)

The overlay auto-dismisses after 5 seconds of no interaction. No tap-outside-to-dismiss (Ava might trigger it).

This is the only adult-facing surface. There is no settings page, no onboarding, no tutorial, no splash screen beyond a brief fade-in of the first theme on launch.

## Safety / lockdown — defense in depth

**Layer 1 — OS lock (primary)**:
- Android: **Screen Pinning** ("App pinning" in Security settings). Long-press recents → pin icon → require PIN/pattern to unpin.
- iOS: **Guided Access** (Accessibility settings). Triple-click side button → set passcode.
- A `README.md` in the repo documents setup for both, screenshotted, written for non-technical readers (Kristen).

**Layer 2 — In-app exit gate (secondary)**:
- The only way out of the app from within is the long-press → confirm flow above.
- The app does **not** handle any system gestures, back buttons, or shortcuts. The Android back button is intercepted and ignored while play surface is active.

**Layer 3 — Permissions and network**:
- Zero runtime network calls. All assets bundled.
- No camera, microphone, location, contacts, or notification permissions requested.
- No analytics SDK, no crash reporter, no ads SDK, no auth SDK.
- No in-app purchases, no external links, no sign-in.

## Language learning approach

Passive labeling only. Aligned with how 18-month-olds actually acquire vocabulary (they hear a thing named by a trusted voice while looking at it).

- Every character has one voice clip: a single word, in Ryan or Kristen's voice, ~0.5–1.5 seconds long.
- Voice plays once per spawn, on tap, in Gentle and Full modes only.
- Music ducks to ~30% for the duration of the voice clip, then returns.
- **No quizzes, no "say it back," no progress meter, no praise audio ("good job!"), no streaks.**

Multi-language, sentence construction, and any structured "lesson" content is explicitly out of scope for v1.

## Tech stack

- **Expo** (latest stable, managed workflow) — cross-platform iOS/Android, single codebase
- **TypeScript**
- **expo-video** — looping background videos (replaces legacy `expo-av` video player)
- **expo-audio** — Suno music tracks, sparkle SFX, voice labels
- **react-native-gesture-handler** + **react-native-reanimated** — taps, drags, animations
- **@shopify/react-native-skia** — sparkle particle trail (GPU-accelerated, smooth at 60fps)
- **@react-native-async-storage/async-storage** — persist audio mode setting only
- All assets bundled at build time

No backend. No external services. No CI deploy targets (sideload via Expo Go for development; build and install directly on Ryan's and Kristen's phones for distribution).

## Architecture

Small, focused units with clear responsibilities:

### `ThemeRegistry`
- Static, hand-written list of three theme objects.
- Each theme: `{ id, name, video, music: string[], characters: Character[], sparkleColors: string[] }`
- Each character: `{ id, image, voiceLabel, label }`
- All asset references are `require(...)` paths resolved at build time.

### `ThemeProvider`
- React context. Holds current theme id and `advance()` function.
- Exposes `currentTheme: Theme`, `advanceTheme()`.

### `AudioController`
- Owns: current audio mode (Silent/Gentle/Full), current music track instance, ducking state.
- Exposes: `setAudioMode(mode)`, `playSparkleSFX()`, `playSpawnSFX()`, `playCharacterLabel(character)`, `onThemeChange(newTheme)`.
- On theme change: crossfade out old track, pick the not-recently-played track for the new theme, crossfade in.
- `playCharacterLabel` ducks music to 30% for the clip duration, then ramps back up.
- Internal `lastPlayedByTheme: Record<themeId, trackIndex>` to enforce no-back-to-back rule.

### `BackgroundVideo`
- Renders `expo-video` view sized to fill the screen behind everything.
- Listens to `ThemeProvider` for `currentTheme.video`, swaps source on theme change with a 300ms fade.
- Always muted (audio lives in `AudioController`).

### `PlaySurface`
- Full-screen `GestureDetector` capturing pan/tap.
- **Tap**: picks a random character from `currentTheme.characters`, spawns it at touch point with a bounce-in animation that fades after 4 seconds. Calls `AudioController.playSpawnSFX()` and `playCharacterLabel(character)`.
- **Drag**: feeds touch positions into the Skia particle emitter; emits sparkles in the theme's color palette.
- Manages the on-screen character sprite list (capped at ~15 to bound memory).

### `MagicButton`
- Fixed-position circular button (bottom-right, large hit target).
- Color and icon shift per theme.
- Press: calls `themeProvider.advanceTheme()` and emits a sparkle burst at its own position.
- Press hit area extends well beyond the visual button (toddler thumbs).

### `AdultPanel`
- Long-press gesture (2s) on a 60×60px hit zone in the top-left corner. The hit zone is invisible.
- Opens a small modal overlay (300px wide, centered).
- Contains: audio-mode radio, theme jump buttons, exit-app button (two-tap confirm), close button.
- Auto-dismiss timer resets on any interaction; fires at 5s of idle.

### `assets/` layout
```
assets/
  themes/
    sleepy-ocean/
      background.mp4
      music/
        lullaby-1.mp3
        lullaby-2.mp3
      characters/
        whale.png
        jellyfish.png
        starfish.png
      voices/
        whale.mp3
        jellyfish.mp3
        starfish.mp3
    sparkle-space/
      ...
    disco-jungle/
      ...
  sfx/
    sparkle.mp3
    spawn.mp3
```

## Asset pipeline (out of band — operator process, not app)

Documented in `README.md`:

1. **Music** — Suno → trim to 30–60s with seamless loop point → export mp3 → place in `assets/themes/<theme>/music/`.
2. **Video** — Veo 3 → generate 5–10s clip → ensure last frame matches first frame for seamless loop (Veo can be prompted for this) → encode to H.264 mp4, target ≤2 MB per clip → place as `background.mp4`.
3. **Characters** — Nano Banana (Gemini 2.5 Flash Image), prompt for transparent background, ~512px → save as PNG → place in `assets/themes/<theme>/characters/`.
4. **Voices** — record on phone, single word, normalize to -3dB peak, trim silence, export as mp3 → place in `assets/themes/<theme>/voices/`.
5. Update `ThemeRegistry.ts` with new entries.

## Data flow

```
[User touch]
   |
   v
PlaySurface (GestureDetector)
   |--> tap: spawn character sprite + AudioController.playCharacterLabel
   |--> drag: feed positions into Skia particle emitter
   |
   v
[MagicButton press]
   |
   v
ThemeProvider.advanceTheme()
   |--> BackgroundVideo: fade & swap video source
   |--> AudioController.onThemeChange: crossfade music
   |--> PlaySurface: swap available characters + sparkle palette

[Long-press top-left 2s]
   |
   v
AdultPanel modal
   |--> audio mode change -> AudioController.setAudioMode + AsyncStorage write
   |--> theme jump -> ThemeProvider.setTheme
   |--> exit -> system close (no save needed)
```

## Error handling

The app has very little that can fail at runtime — all assets are bundled, no network, no auth. Failure modes worth handling:

- **Asset load failure** (corrupted file in the bundle): catch, skip the asset (e.g., a character that fails to load is omitted from the spawn pool), log to dev console only. The app never shows a toddler an error message.
- **Audio device busy / interrupted** (phone call, etc.): `expo-audio` handles interruption events; resume on return.
- **Skia frame drop**: cap particles emitted per frame; degrade gracefully.

No error screens, no fallback UI, no "something went wrong" — the worst case is "a character is silently missing", which is invisible to Ava.

## Testing strategy

This is a small, single-screen app where the bugs that matter are visual, audio, and gesture-related — none of which unit tests catch well. Pragmatic plan:

- **Unit tests** for pure logic only: `AudioController` track-picking (no back-to-back), `ThemeRegistry` schema validation at build time.
- **Manual smoke checklist** (kept in `README.md`):
  - Launch in Silent mode — no audio
  - Tap → character spawns and fades
  - Drag → sparkles trail finger and fade
  - Magic button → theme changes, music crossfades, video crossfades
  - Long-press top-left 2s → adult panel opens
  - Audio mode change → takes effect immediately, persists across relaunch
  - Android back button → does nothing
  - Both phones at least once before each handoff to Ava
- **Real-user test** — Ryan watches Ava use it. If something annoys an adult or confuses Ava, that's the bug.

## Explicitly out of scope

- Multiple kid profiles
- Cloud sync / accounts
- Time limits, screen-time tracking, parental dashboards
- Achievements, progress, gamification
- Speech, ABCs, structured lessons, multi-language
- Push notifications (entitlement not even requested)
- Web build (Expo can do it; we don't want it)
- Customizing themes from inside the app (theme set is a code change)

## Open questions (for the implementation plan stage)

- Distribution: Expo development build on each phone via TestFlight (iOS) / direct APK install (Android)? Or just use Expo Go during development and never package? Probably TestFlight + APK once content is stable; Expo Go during build-out.
- Bundle size budget: with 3 themes × (1 video + 2 music + 3 voices + 3 character images) plus 2 SFX, target install size under ~30 MB. Need to verify after first theme is built.
