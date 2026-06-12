# Adding a book to AvieBaby

Step-by-step walkthrough for getting one of Ava's picture books into the app: page images, family voice recordings, then one command to regenerate the registry. No TypeScript editing required.

You can stop at any step — for example, after page-1 of a 12-page book is done, you can already load the book in the app and play it (it just ends and loops after page 1). Books grow over time as you add more pages and more readers.

---

## Prerequisites

- The repo cloned and your Expo dev server runnable (`npm run start`).
- `ffmpeg` on your PATH. Test with `ffmpeg -version`. (If missing on Windows: `winget install --id Gyan.FFmpeg --scope user`, open a fresh Git Bash.)
- Node.js (you already have this if `npm run start` works).
- Phone images of the book pages, or a tablet, or scans. Anything ffmpeg reads (jpg, png, heic, etc.).
- Audio recordings of each page in m4a/wav/mp3/etc.

---

## Step 1: Decide on a `book-id`

Lowercase, dash-separated, no spaces. Becomes a folder name on disk and an id in code.

| Book title | Good `book-id` |
|---|---|
| Goodnight Moon | `goodnight-moon` |
| Brown Bear, Brown Bear | `brown-bear` |
| The Very Hungry Caterpillar | `hungry-caterpillar` |

You'll use this id in every script command.

---

## Step 2: Decide on `reader-id`s for everyone who'll record this book

Lowercase, single word ideally. Become folder names.

| Person | `reader-id` | Display name |
|---|---|---|
| Ryan (uncle) | `ryan` | `Uncle Ryan` |
| Kristen (mom) | `kristen` | `Mommy` |
| Kyle | `kyle` | `Uncle Kyle` |
| Grandma | `grandma` | `Grandma` |

A book can have one reader to start, or many. Add more anytime.

---

## Step 3: Photograph and order the pages

1. Open the book to page 1. Photograph it (or just the picture page if it's a wordy left + picture right book — Ava cares about pictures more than words).
2. Repeat for every page in reading order.
3. Transfer photos to your computer at e.g. `~/Desktop/book-source/goodnight-moon/`.
4. **Rename them in page order**, zero-padded:

```
~/Desktop/book-source/goodnight-moon/
  page-01.jpg
  page-02.jpg
  ...
  page-12.jpg
```

The script doesn't care about the input filenames, but matching them to page numbers saves confusion later.

---

## Step 4: Process the page images

**For the very first page**, include `--title "Display Title"`. This stamps the book's display title once so the registry generator can use it.

```bash
scripts/book-page.sh --title "Goodnight Moon" ~/Desktop/book-source/goodnight-moon/page-01.jpg goodnight-moon 1
```

For every other page, drop the title flag:

```bash
scripts/book-page.sh ~/Desktop/book-source/goodnight-moon/page-02.jpg goodnight-moon 2
scripts/book-page.sh ~/Desktop/book-source/goodnight-moon/page-03.jpg goodnight-moon 3
# ... etc
```

Each command:
- Scales to fit a 1920×1080 landscape canvas
- Pads with black if needed
- Saves as `assets/books/goodnight-moon/pages/page-NN.png` (zero-padded)

**Verify:**

```bash
ls -la assets/books/goodnight-moon/pages/
```

Should show `page-01.png` through `page-NN.png`. **Count them — that's the page count you need for recordings.**

---

## Step 5: Record audio for each page

For one reader at a time, open your phone's voice recorder.

For each page:
1. Look at the page on your computer screen.
2. Hit record.
3. Read the page out loud the way you'd read it to Ava.
4. Stop.
5. Save with a name that says which page: `goodnight-page-01.m4a`.

> **Tips:**
> - Don't try to be perfect — toddlers love small mistakes.
> - Pause briefly at the start before speaking. The trim handles the leading silence.
> - Keep your phone at a consistent distance so volume stays even.

Transfer all recordings to your computer at e.g. `~/Desktop/book-source/goodnight-moon/voices/ryan/`.

---

## Step 6: Process the audio recordings

**For the reader's first page**, include `--reader-name "Display Name"`. This stamps the display name once.

```bash
scripts/book-voice.sh --reader-name "Uncle Ryan" ~/Desktop/book-source/goodnight-moon/voices/ryan/page-01.m4a goodnight-moon ryan 1
```

For every other page from the same reader, drop the reader-name flag:

```bash
scripts/book-voice.sh ~/Desktop/book-source/goodnight-moon/voices/ryan/page-02.m4a goodnight-moon ryan 2
scripts/book-voice.sh ~/Desktop/book-source/goodnight-moon/voices/ryan/page-03.m4a goodnight-moon ryan 3
# ... etc
```

Each command:
- Trims leading and trailing silence
- Loudness-normalizes
- Converts to mono mp3 at 96 kbps
- Saves as `assets/books/goodnight-moon/voices/ryan/page-NN.mp3`

**If a soft trailing word ("...moon" or "...you") gets clipped**, re-run that one page with `--keep-tail`:

```bash
scripts/book-voice.sh --keep-tail ~/Desktop/.../page-04.m4a goodnight-moon ryan 4
```

You can combine the flags:

```bash
scripts/book-voice.sh --keep-tail --reader-name "Uncle Ryan" <input> goodnight-moon ryan 1
```

**Verify:**

```bash
ls -la assets/books/goodnight-moon/voices/ryan/
```

The audio file count **must equal** the page count from Step 4.

---

## Step 7 (optional): Add a cover thumbnail

```bash
scripts/book-cover.sh ~/Desktop/book-source/goodnight-moon/cover.jpg goodnight-moon
```

Writes a 512×512 square at `assets/books/goodnight-moon/cover.png`. Skip if you don't have a cover handy.

---

## Step 8: Regenerate the registry — one command

```bash
node scripts/book-register.js
```

(or run `scripts/book-register.js` directly — it has a `#!` shebang.)

It scans `assets/books/`, reads each `book.json`, and writes a fresh `src/books/BookRegistry.ts` with every page image and audio file in the correct order. It also re-emits the `validateBooks` function so tests still pass.

The output looks like:

```
Wrote src/books/BookRegistry.ts (3 books).
```

**Verify:**

```bash
npm run typecheck
npm test
```

Both should pass. If a test fails, the error message will tell you which book has a mismatched page count or missing reader.

---

## Step 9: Reload and test on phone

Press `r` in the Expo terminal (or restart with `npx expo start --clear` if assets don't update).

On the phone:
1. Long-press top-left for 2 s → adult panel.
2. Tap **Read a book to Ava**.
3. Tap **Goodnight Moon**.
4. Tap **Uncle Ryan**.
5. App rotates to landscape, page 1 appears, your voice plays.
6. Tap → page 2.
7. Hold (~1 s) → page 1 again.
8. Tap through to the last page, tap once more → loops to page 1.
9. Long-press the *device's* top-left corner (= bottom-left in landscape) for 2 s → adult panel.
10. Tap **Exit book** → returns to play mode.

---

## Adding another reader to the same book

Once Ryan's done a book, Kristen wants to record her version. Do step 5 + step 6 again, with `--reader-name` on the first page:

```bash
scripts/book-voice.sh --reader-name "Mommy" ~/Desktop/kristen/page-01.m4a goodnight-moon kristen 1
scripts/book-voice.sh ~/Desktop/kristen/page-02.m4a goodnight-moon kristen 2
# ... etc
```

Then regenerate:

```bash
node scripts/book-register.js
```

The reader picker shows both options the next time you tap the book.

---

## Adding another book

Same nine steps with a different `book-id`. Each book is a self-contained folder under `assets/books/` with its own `book.json`.

The registry generator handles any number of books — there's no code change needed for book #5, #10, or #50.

---

## Commit when you're happy

```bash
git add assets/books/goodnight-moon/ src/books/BookRegistry.ts
git commit -m "Add Goodnight Moon (read by Uncle Ryan)"
git push
```

Test on the phone before pushing — once it's on github it'll go out to TestFlight on the next app update.

---

## What's in `book.json`?

The metadata file the scripts maintain for each book. You **rarely** need to look at it, but if you ever want to rename a book or a reader, this is the source of truth — edit it, then re-run `node scripts/book-register.js`.

Example after a few `--title` / `--reader-name` flag invocations:

```json
{
  "title": "Goodnight Moon",
  "readers": {
    "ryan": "Uncle Ryan",
    "kristen": "Mommy"
  }
}
```

If you somehow lose `book.json`, the generator falls back to using the ids as display strings. Re-run any script with `--title` or `--reader-name` to restore the right names.

---

## Troubleshooting

**The book doesn't show up in the picker.**
You forgot to run `node scripts/book-register.js` after dropping in assets, or `BOOKS` in the registry doesn't include your book. Run the generator and reload.

**Pages advance but no audio plays.**
Check your audio mode (long-press → adult panel). In **silent** mode book audio is silenced. Switch to **gentle**, **music**, or **full**.

**A specific page's word is being cut off.**
Re-run `book-voice.sh --keep-tail` for that one page, then re-run the generator.

**The display title is the book id (e.g., shows "goodnight-moon" instead of "Goodnight Moon").**
You didn't pass `--title` on any page-page invocation for that book. Either re-run one with `--title "Real Title"`, or hand-edit `assets/books/<book-id>/book.json`. Then re-run the generator.

**A reader's name shows as `ryan` instead of `Uncle Ryan`.**
Same fix on the voice side: re-run one of the reader's voice clips with `--reader-name "Uncle Ryan"`, or edit `book.json`. Then re-run the generator.

**Tests fail with "Reader has N audio pages but the book has M image pages."**
You have a mismatch. List both directories:
```bash
ls assets/books/<book>/pages/
ls assets/books/<book>/voices/<reader>/
```
Figure out which page is missing and process it. Re-run the generator. Tests should pass.

**`npm test` fails after running the generator.**
The generator preserved the `validateBooks` function but produced an invalid `BOOKS` array. Read the error to see which book — most often missing or extra files.
