# AvieBaby

A toddler-safe play app, built with Expo, for handing to an 18-month-old without worry. Single screen: tap to spawn custom characters, drag to leave sparkle trails, press the magic button to cycle three custom themed worlds.

## Before you hand the phone over: lock it down

The app handles its own exit gate, but the **strongest** lock is the OS-level one. Set it up once.

### Android (Ryan's phone)

1. Settings → Security & privacy → Other security settings → **App pinning** → turn ON.
2. Toggle **"Ask for PIN before unpinning"** ON.
3. Open the AvieBaby app, then open the Recents view.
4. Tap the AvieBaby icon at the top of its card → **Pin**.
5. To unpin later: swipe up from the bottom and hold; phone asks for the PIN.

### iOS (Kristen's phone)

1. Settings → Accessibility → **Guided Access** → turn ON.
2. Set a Guided Access passcode (and enable Touch ID / Face ID if you want).
3. Open AvieBaby.
4. Triple-click the side button → tap **Start**.
5. To exit: triple-click side button → enter passcode → **End**.

## The adult control panel (inside the app)

Long-press the **top-left corner for 2 seconds**. A panel opens with:

- **Audio**: Silent (default) / Gentle (effects + voice labels) / Full (effects + voice + Suno music)
- **Jump to theme**: directly pick Sleepy Ocean / Sparkle Space / Disco Jungle
- **Exit app**: requires a second confirm tap

The panel auto-dismisses after 5 seconds of inactivity. The Android back button is intercepted — it does nothing.

## Replacing placeholder assets with real Suno / Veo / Nano Banana content

Every theme has these slots:

```
assets/themes/<theme-name>/
  background.mp4              -- 5–10s seamless loop, H.264, ≤2 MB
  music/track-1.mp3           -- 30–60s loopable
  music/track-2.mp3           -- 30–60s loopable
  characters/<id>.png         -- transparent background, ~512px
  voices/<id>.mp3             -- single word, ~1.5s, family voice
```

After the scaffold, all slots contain silent / blank placeholders so the app runs end-to-end. Swap them in as you generate the real things.

### Pipeline per theme

1. **Music (Suno)** — generate two tracks per theme. Trim to a clean 30-60s loop point and export as mp3. Save as `track-1.mp3` and `track-2.mp3`.
2. **Background (Veo 3)** — generate a 5–10 second clip. Prompt for "seamless loop, final frame matches first frame." Re-encode to small H.264 mp4:
   ```bash
   ffmpeg -i input.mp4 -vf "scale=720:-2" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart -an background.mp4
   ```
3. **Characters (Nano Banana / Gemini 2.5 Flash Image)** — for each character, prompt for "transparent background, centered, no shadow, friendly toddler-safe character." Export PNG. Save as `assets/themes/<theme>/characters/<id>.png`.
4. **Voices (you & Kristen)** — record the character name in your phone's voice memo app. One word per clip. Normalize and trim silence:
   ```bash
   ffmpeg -i recording.m4a -af "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-30dB, loudnorm" -ar 44100 -b:a 96k whale.mp3
   ```

### Registering a new character

If you add a new character (e.g., "octopus" in Sleepy Ocean), edit `src/themes/ThemeRegistry.ts` and add an entry under that theme's `characters` array. The PNG and voice clip filenames must match the `id` you give it.

## Manual smoke test (run before every handoff to Ava)

1. Launch the app.
2. **Silent mode (default)**: tap and drag — animations work, no audio at all.
3. Long-press top-left 2s → adult panel opens.
4. Switch to **Full** audio. Close panel. Tap once → spawn animation + voice label heard + music playing.
5. Press magic button → music swaps to the new theme, video swaps, button color changes.
6. Long-press top-left → audio still set to Full. Press Exit → confirm → app closes.
7. Reopen the app → audio mode is still Full (persisted).
8. Press magic button rapidly → no crashes.
9. Press Android hardware back button → nothing happens.

## Book mode (v2)

A second mode where the adult picks a picture book and a family-recorded reader. App rotates to landscape; Ava taps to advance pages, long-presses (~1s) to go back, and the book loops at the end. Adult long-press top-left of the physical device (= bottom-left in landscape) for 2 s to access settings or exit back to play mode.

### Adding a book

1. Process the first page with the book's display title:
   `scripts/book-page.sh --title "Goodnight Moon" <input> goodnight-moon 1`
   Subsequent pages don't need `--title`.
2. Process the rest of the pages with `scripts/book-page.sh <input> <book-id> <page-number>`.
3. For each reader, process the first page with the reader's display name:
   `scripts/book-voice.sh --reader-name "Uncle Ryan" <input.m4a> goodnight-moon ryan 1`
   Subsequent pages from the same reader don't need `--reader-name`.
4. Process the rest of the voice pages with `scripts/book-voice.sh [--keep-tail] <input.m4a> <book-id> <reader-id> <page-number>`.
5. Optional: `scripts/book-cover.sh <input.jpg> <book-id>` to add a thumbnail.
6. Regenerate the registry: `node scripts/book-register.js` (or `scripts/book-register.js` directly).
7. Reload Expo (`r`) and re-test. Run `npm test` to verify the validator passes.

### Book-mode smoke checklist

1. Launch the app — play mode loads as usual.
2. Long-press top-left for 2 s → adult panel opens.
3. Tap "Read a book to Ava" → pick a book → pick a reader.
4. App rotates to landscape, page 1 appears, audio starts.
5. Tap on the page → page 2 appears, audio cuts over.
6. Hold (~1 s) on the page → page 1 returns.
7. Tap through to the last page, tap once more → loops to page 1.
8. Long-press top-left of the device (= bottom-left of the screen in landscape) for 2 s → adult panel opens with "Exit book" at top.
9. Tap "Exit book" → returns to portrait + play mode.
10. Set audio to silent in adult panel, re-enter the book → pages advance on tap but no audio plays.

## Development

```bash
npm install
scripts/make-placeholders.sh    # generate stub assets (needs ffmpeg)
npm run start                   # launches Expo dev server
npm test                        # runs unit tests
npm run typecheck               # TypeScript check
```

## What's NOT in this app

By design: no internet, no analytics, no ads, no sign-in, no in-app purchases, no camera/mic/location permissions, no notifications, no profiles, no progress tracking, no learning quizzes.
