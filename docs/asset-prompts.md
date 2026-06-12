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

## Background video (Veo 3)

### How to generate

- **Easiest**: Gemini app or web (`gemini.google.com`). Free tier covers a few generations a day; Gemini Advanced gets you many more.
- **More control**: Google AI Studio (`aistudio.google.com`) → Veo 3. Lets you set seeds and use negative prompts.

### Critical settings

- **Aspect ratio: 9:16 (portrait)**. The app runs portrait-locked. If Veo gives you 16:9 you'll get letterboxed bars or a stretched picture. Both Gemini and AI Studio expose this before you generate — pick it.
- **Length: 8 seconds.** Veo 3's default and the sweet spot for a loop.
- **Style: ambient / no characters.** Each video is a *background*. Characters, text, faces, and any storytelling motion compete with the tap-to-spawn experience. Stay abstract.

### Prompt rules for our use case

A good Veo prompt for a loopable background combines: **subject + motion + palette + framing + lighting + negative constraints**. The order matters less than including all six.

What to AVOID in the prompt (and to add as negatives if available):
- "people", "characters", "creatures", "faces", "text", "logo", "UI", "title card"
- "camera pan", "zoom", "dolly" — any directional camera motion makes loops obvious
- "fast", "explosive", "dramatic" — toddler-calm aesthetic

### Per-theme prompts

**Sleepy Ocean (`assets/themes/sleepy-ocean/background.mp4`)**

```
Underwater background, calm sunlit kelp forest swaying gently, godrays piercing teal-green water from above, soft particles of plankton drifting, slow ambient motion, dreamy and peaceful, vertical 9:16, no fish, no characters, no text, no camera movement, 8 seconds
```

**Sparkle Space (`assets/themes/sparkle-space/background.mp4`)**

```
Slow drifting starfield with soft purple and gold nebula clouds, gentle parallax of distant stars, occasional tiny twinkle, magical ambient atmosphere, vertical 9:16, no text, no characters, no spaceships, no camera movement, 8 seconds
```

**Disco Jungle (`assets/themes/disco-jungle/background.mp4`)**

```
Tropical jungle canopy from below, vibrant green leaves swaying in dappled golden sunlight, sparkles of pollen drifting, vivid saturated colors, joyful ambient atmosphere, vertical 9:16, no animals, no characters, no text, no camera movement, 8 seconds
```

### Post-processing: forcing a seamless loop

Veo's "seamless loop" requests are unreliable. The fix is a 30-second ffmpeg step.

**The workhorse — boomerang (forward + reversed):**

```bash
ffmpeg -i input.mp4 \
  -filter_complex "[0:v]reverse[r];[0:v][r]concat=n=2:v=1:a=0[c];[c]scale=720:-2[v]" \
  -map "[v]" \
  -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart -an \
  background.mp4
```

Plays the 8s clip forward then in reverse → 16s total → loops perfectly because the last frame *is* the first frame. Imperceptible for ambient backgrounds (drifting water, swaying leaves, starfields) because nothing has strong directional motion. Output is small and ready to drop in.

**Fallback — crossfade tail with head (for when boomerang looks weird):**

```bash
ffmpeg -i input.mp4 \
  -filter_complex "[0:v]split=2[a][b];[a]trim=0:7,setpts=PTS-STARTPTS[head];[b]trim=7:8,setpts=PTS-STARTPTS[tail];[tail][head]xfade=transition=fade:duration=1:offset=0[c];[c]scale=720:-2[v]" \
  -map "[v]" \
  -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart -an \
  background.mp4
```

Drops to 7s total but the seam is a soft 1s crossfade.

### Loop verification checklist

- ☐ Output file is < 2 MB
- ☐ Aspect ratio is taller than wide (720×1280 or similar)
- ☐ Plays for 5+ continuous seconds in VLC/QuickTime without a visible jump
- ☐ No audio track (run `ffprobe background.mp4` — should report video stream only)
- ☐ Filename is exactly `background.mp4` and lives in `assets/themes/<theme>/`

### Common issues

- **Loop "pops" with a visible jump every cycle** → Use the boomerang command above. Don't trust Veo's own loop prompt.
- **Output is 15+ MB** → CRF too low; bump `-crf 26` to `-crf 28` (smaller file, slightly more compression).
- **Colors look washed out on phone** → Veo sometimes returns bt.601 color. Add `-colorspace bt709 -color_primaries bt709 -color_trc bt709` before `background.mp4` in the ffmpeg command.
- **Boomerang reveals directional motion** (e.g., one specific particle reversing visibly) → Regenerate with a more "swirly / random" motion prompt (replace "drifting" with "swirling slowly"), or use the crossfade fallback.

---

## Characters (Nano Banana / Gemini 2.5 Flash Image) — coming as you generate

Character ids per theme (must match `src/themes/ThemeRegistry.ts`):

- **sleepy-ocean**: whale, jellyfish, starfish
- **sparkle-space**: rocket, alien, comet
- **disco-jungle**: banana, monkey, parrot

Base prompt template: `"Friendly cartoon <character>, soft rounded shapes, large eyes, gentle smile, simple shading, centered, transparent background, no shadow, no text, toddler-safe, ~512x512px"`. Iterate on a single character with Nano Banana's "consistent character" mode so re-renders feel like the same little guy.

---

## App icon

The icon needs to be **square, 1024×1024, full-bleed** (no transparency around the edges — the OS clips the corners itself). Generate it in Nano Banana / Gemini 2.5 Flash Image, then run `scripts/icon.sh <input.png>` and it'll produce all the iOS/Android variants automatically.

### Four prompt directions

Pick whichever fits the vibe you want. All four are 1024×1024 square, vibrant, child-friendly, no text.

**A. Letter A with sparkles (most "for Ava")**

```
App icon for a toddler play app, 1024x1024 square, full-bleed. A large stylized letter A in white at the center, soft rounded sans-serif, surrounded by colorful sparkles and tiny stars. Vibrant gradient background flowing from cyan to lilac to coral pink. Soft rounded shapes, no shadows, no other text, modern flat app icon style, joyful and toddler-safe.
```

**B. Sparkle creature (most playful)**

```
App icon for a toddler play app, 1024x1024 square, full-bleed. A cute round cartoon sparkle creature with big friendly eyes and rosy cheeks, holding a tiny magic wand. Vibrant rainbow gradient background. Surrounded by small sparkles and stars. Bright joyful colors, soft rounded shapes, no shadows, no text, modern flat app icon style.
```

**C. Three worlds (most "represents the themes")**

```
App icon for a toddler play app, 1024x1024 square, full-bleed. Three colorful glowing orbs representing different worlds arranged in a triangle: a blue ocean orb with a tiny whale, a purple cosmic orb with a star, and a green tropical orb with a leaf. Soft pastel gradient background. Each orb glows softly. Bright joyful colors, no text, no shadows, modern flat app icon style.
```

**D. Magic button (matches the in-app button)**

```
App icon for a toddler play app, 1024x1024 square, full-bleed. A large glowing magic button in the center, bright coral pink with a soft white border, displaying a 5-pointed star symbol. Surrounded by colorful sparkles drifting outward. Background: soft rainbow gradient (yellow to pink to purple). Bright joyful colors, no text, no shadows, modern flat app icon style.
```

### Workflow

1. Generate in Nano Banana. Aim for 1024×1024 square output (any of the prompts above explicitly request that).
2. Generate 2–3 takes and pick the one that reads well at small size — squint at it; if you can still tell what it is, it'll work as a home-screen icon.
3. Save as `~/Desktop/aviebaby-icon.png` (or anywhere).
4. From the project: `scripts/icon.sh ~/Desktop/aviebaby-icon.png`
5. Optional: pass a custom Android background color: `scripts/icon.sh ~/Desktop/aviebaby-icon.png "#FF69B4"`
6. Update `app.json` color fields if you changed the background — `expo.android.adaptiveIcon.backgroundColor` and `expo.splash.backgroundColor` should match for a polished look.

### Icon design tips

- **Important content stays in the middle 65%.** The OS crops the corners (iOS rounds them, Android may mask with a circle on some launchers).
- **Avoid fine detail.** It'll be 60×60 pixels on her home screen — anything thinner than ~30 pixels of source will disappear.
- **Pick a color that contrasts the typical home-screen wallpaper.** A bright icon stands out; a dark one disappears against a dark wallpaper.
