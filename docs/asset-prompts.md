# Asset generation prompts

Reference prompts for producing the bundled assets each theme expects. Tweak freely — these are starting points designed to be safe defaults.

## Music (Suno)

**How to use these in Suno:**
- Use **Custom Mode**.
- Paste the prompt into the **Style of Music** field.
- Leave the **Lyrics** field empty and toggle **Instrumental** ON. Suno will sometimes sneak in a humming or "oohs" if you don't.
- Generate 2–3 takes per prompt, pick the cleanest, then trim to a **30–60 second seamless loop** in Suno's editor (or in Audacity / GarageBand). Pick a loop point on a downbeat where the harmony returns to the I chord — that hides the seam.
- File names must be `track-1.mp3` and `track-2.mp3` inside `assets/themes/<theme>/music/`.

### Sleepy Ocean (calm, lullaby energy)

**track-1.mp3 — "Music Box Lullaby"**

```
lullaby, music box, soft strings pad, gentle vibraphone, 60 BPM, dreamy, tender, instrumental, loopable, peaceful bedtime
```

**track-2.mp3 — "Underwater Drift"**

```
ambient new age, warm synth pad, harp arpeggio, marimba, soft chimes, 55 BPM, floating, oceanic, instrumental, no vocals
```

### Sparkle Space (medium energy, twinkly)

**track-1.mp3 — "Cosmic Twinkle"**

```
dreamy chillwave, celeste, glockenspiel, soft synth pad, plucky bells, 90 BPM, whimsical, magical, instrumental, child-friendly
```

**track-2.mp3 — "Friendly Synthwave"**

```
warm analog synthwave, bell synth lead, gentle drum machine, 95 BPM, cheerful, exploratory, instrumental, no vocals, loopable
```

### Disco Jungle (high energy, funk)

**track-1.mp3 — "Toy Funk"**

```
kid-friendly funk, bouncy bass, clean guitar chops, warm horn stabs, shaker, conga, 108 BPM, joyful, danceable, instrumental
```

**track-2.mp3 — "Jungle Bounce"**

```
tropical funk, marimba, bongo, sax, electric piano, claps, 112 BPM, sunny, playful, instrumental, no vocals
```

### Loop trimming checklist
- ☐ Track length 30–60 s
- ☐ Start and end both land on a downbeat (count `1 2 3 4` — both should hit on `1`)
- ☐ No fade-in or fade-out (those break the loop seam)
- ☐ Final ms volume matches first ms volume — crossfade ~50 ms in Audacity if needed
- ☐ Export as 44.1 kHz / 128 kbps mp3 minimum (96 kbps if size matters)

---

## Background video (Veo 3) — coming as you generate

For each theme:

- **Sleepy Ocean**: "Slow drifting underwater scene, sun rays from above, gentle current, soft blue-green palette, no fish or text, last frame matches first frame, 8 seconds, seamless loop."
- **Sparkle Space**: "Slow starfield with drifting nebula clouds, occasional shooting star, deep purple and gold palette, no text or characters, last frame matches first frame, 8 seconds, seamless loop."
- **Disco Jungle**: "Bright cartoon jungle leaves swaying with shafts of golden light and floating motes, vibrant tropical palette, no characters or text, last frame matches first frame, 8 seconds, seamless loop."

Re-encode after download (per README): `ffmpeg -i input.mp4 -vf "scale=720:-2" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart -an background.mp4`

---

## Characters (Nano Banana / Gemini 2.5 Flash Image) — coming as you generate

Character ids per theme (must match `src/themes/ThemeRegistry.ts`):

- **sleepy-ocean**: whale, jellyfish, starfish
- **sparkle-space**: rocket, alien, comet
- **disco-jungle**: banana, monkey, parrot

Base prompt template: `"Friendly cartoon <character>, soft rounded shapes, large eyes, gentle smile, simple shading, centered, transparent background, no shadow, no text, toddler-safe, ~512x512px"`. Iterate on a single character with Nano Banana's "consistent character" mode so re-renders feel like the same little guy.
