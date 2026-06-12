# Adding a book to AvieBaby

Step-by-step walkthrough for getting one of Ava's picture books into the app: page images, family voice recordings, registry entry, test on phone.

You can stop at any step — for example, after page-1 of a 12-page book is done, you can already load the book in the app and play it (it just ends and loops after page 1). Books grow over time as you add more pages and more readers.

---

## Prerequisites

- The repo cloned and your Expo dev server runnable (`npm run start`).
- `ffmpeg` on your PATH. Test with `ffmpeg -version`. (If missing on Windows: `winget install --id Gyan.FFmpeg --scope user`, open a fresh Git Bash.)
- Phone images of the book pages, or a tablet, or scans. Doesn't matter what format — the script accepts anything ffmpeg reads (jpg, png, heic, etc.).
- Audio recordings of each page in m4a/wav/mp3/etc. Anything ffmpeg accepts.

---

## Step 1: Decide on a `book-id`

Lowercase, dash-separated, no spaces. This becomes a folder name on disk and an id in code.

| Book title | Good `book-id` | Why |
|---|---|---|
| Goodnight Moon | `goodnight-moon` | Two words, dashes |
| Brown Bear, Brown Bear | `brown-bear` | Drop the repeat for brevity |
| The Very Hungry Caterpillar | `hungry-caterpillar` | Drop "the", keep distinctive part |

You'll use this id in every script command and in the registry.

---

## Step 2: Decide on `reader-id`s for everyone who'll record this book

Lowercase, single word ideally. These become folder names too.

| Person | `reader-id` | Display name (`Reader.name`) |
|---|---|---|
| Ryan (uncle) | `ryan` | `Uncle Ryan` |
| Kristen (mom) | `kristen` | `Mommy` |
| Kyle | `kyle` | `Uncle Kyle` |
| Grandma | `grandma` | `Grandma` |

A book can have one reader to start, or many. You can always add more later.

---

## Step 3: Photograph and order the pages

1. Open the book to page 1. Photograph the spread (or just the left page if it's a wordy left + picture right book — Ava cares about pictures more than words, and your voice supplies the words).
2. Repeat for every page in the order you'll read them.
3. Transfer the photos to your computer. Put them somewhere you can find: `~/Desktop/book-source/goodnight-moon/`.
4. **Rename them with the page order**:

```
~/Desktop/book-source/goodnight-moon/
  page-01.jpg
  page-02.jpg
  page-03.jpg
  ...
  page-12.jpg
```

Zero-padded to two digits so they sort correctly. The script doesn't care about the filename, but it'll save you confusion when you process them.

> **Tip:** if the book spread is wider than tall (typical), you'll get the best result when book mode displays it. If it's a portrait single-page format, the script will pad with black bars on the sides — still works, just not as dramatic.

---

## Step 4: Process the page images

For each page, from the project directory in Git Bash:

```bash
scripts/book-page.sh ~/Desktop/book-source/goodnight-moon/page-01.jpg goodnight-moon 1
scripts/book-page.sh ~/Desktop/book-source/goodnight-moon/page-02.jpg goodnight-moon 2
scripts/book-page.sh ~/Desktop/book-source/goodnight-moon/page-03.jpg goodnight-moon 3
# ... and so on
```

Each command:
- Scales the image to fit a 1920×1080 landscape canvas
- Pads with black if the aspect ratio doesn't match
- Saves as `assets/books/goodnight-moon/pages/page-01.png` (zero-padded number)

**Verify all pages landed:**

```bash
ls -la assets/books/goodnight-moon/pages/
```

You should see `page-01.png` through `page-NN.png`. **Count them. That's your book's page count — you'll need this number to match recordings later.**

---

## Step 5: Record audio for each page (one reader at a time)

Open your phone's voice recorder. For each page:

1. Look at the page on your computer screen.
2. Hit record.
3. Read the page out loud the way you'd read it to Ava.
4. Stop recording when you're done.
5. Save with a name that tells you which page: `goodnight-page-01.m4a`.

Do this for every page. You'll end up with as many recordings as pages.

> **Tips for natural-sounding recordings:**
> - Don't try to be perfect. Toddlers love the small mistakes — the laugh when you stumble on a word, the way your voice softens for sleepy parts.
> - Pause briefly at the start of each recording before speaking. The script trims silence, so the leading pause disappears, but it gives you a second to settle.
> - Hold the phone consistent distance for all pages so volume is similar (the loudness normalizer handles small differences but extreme ones — like 6 inches vs 2 feet — can sound weird).

Transfer all recordings to your computer: `~/Desktop/book-source/goodnight-moon/voices/ryan/`. (One folder per reader so they don't collide if Kristen also records this book.)

---

## Step 6: Process the audio recordings

For each page, from the project directory:

```bash
scripts/book-voice.sh ~/Desktop/book-source/goodnight-moon/voices/ryan/page-01.m4a goodnight-moon ryan 1
scripts/book-voice.sh ~/Desktop/book-source/goodnight-moon/voices/ryan/page-02.m4a goodnight-moon ryan 2
# ... and so on
```

Each command:
- Strips leading and trailing silence
- Normalizes loudness so all pages play at the same volume
- Converts to mono mp3 at 96 kbps
- Saves as `assets/books/goodnight-moon/voices/ryan/page-01.mp3`

**If you have a quiet trailing word that's getting cut off** (e.g., "...moon" trails into the word "you" softly), re-run that one page with `--keep-tail`:

```bash
scripts/book-voice.sh --keep-tail ~/Desktop/book-source/goodnight-moon/voices/ryan/page-04.m4a goodnight-moon ryan 4
```

**Verify all audio landed:**

```bash
ls -la assets/books/goodnight-moon/voices/ryan/
```

The audio file count **must equal** the page count from step 4. If you have 12 pages but only 11 recordings, the book won't load until they match.

---

## Step 7 (optional): Add a cover thumbnail

If you want a thumbnail in the picker:

```bash
scripts/book-cover.sh ~/Desktop/book-source/goodnight-moon/cover.jpg goodnight-moon
```

Saves a 512×512 square at `assets/books/goodnight-moon/cover.png`. The cover field on the book entry is optional — you can skip this if you don't have a cover image handy.

---

## Step 8: Add the book to the registry

Open `src/books/BookRegistry.ts`. Add an entry to the `BOOKS` array:

```ts
import { Book } from './types';

export const BOOKS: Book[] = [
  {
    id: 'goodnight-moon',
    title: 'Goodnight Moon',
    cover: require('../../assets/books/goodnight-moon/cover.png'), // omit this line if no cover
    pages: [
      require('../../assets/books/goodnight-moon/pages/page-01.png'),
      require('../../assets/books/goodnight-moon/pages/page-02.png'),
      require('../../assets/books/goodnight-moon/pages/page-03.png'),
      // ... one require() per page, in order
    ],
    readers: [
      {
        id: 'ryan',
        name: 'Uncle Ryan',
        pages: [
          require('../../assets/books/goodnight-moon/voices/ryan/page-01.mp3'),
          require('../../assets/books/goodnight-moon/voices/ryan/page-02.mp3'),
          require('../../assets/books/goodnight-moon/voices/ryan/page-03.mp3'),
          // ... one require() per page, in the same order as the page images
        ],
      },
    ],
  },
];
```

**The order matters.** The `pages` array's order is the order they'll play. The reader's `pages` array's i-th entry MUST correspond to the book's `pages` i-th entry — i.e., audio[0] plays while image[0] is showing.

The TypeScript validator (`validateBooks`) will catch:
- A reader with more or fewer audio entries than there are pages.
- Duplicate book ids.
- Duplicate reader ids inside one book.
- Books with zero readers.

It runs the next time the test suite runs (`npm test`) and won't crash the app at runtime — but the book won't behave right if the lengths don't match. So **count carefully**.

---

## Step 9: Reload and test

```bash
npm run typecheck
npm test
```

Both should pass. Then start the dev server if it isn't running, press `r` in its terminal to reload, and on your phone:

1. Long-press the top-left corner (2 s) → adult panel opens.
2. Tap **"Read a book to Ava"**.
3. Tap **Goodnight Moon** (or whatever your book is).
4. Tap **Uncle Ryan** (or whichever reader).
5. App rotates to landscape, page 1 appears, your voice starts reading.
6. Tap on the page → page 2.
7. Hold for ~1 second → page 1 again.
8. Tap through to the last page, then tap once more → loops back to page 1.
9. Long-press the *device's* top-left corner (= bottom-left of the landscape screen) for 2 seconds → adult panel.
10. Tap **Exit book** → returns to play mode.

---

## Adding another reader to the same book

Once Ryan has recorded the whole book, Kristen wants to record her version. Step 5 + step 6 again, but with `kristen` as the reader-id:

```bash
scripts/book-voice.sh ~/Desktop/kristen/page-01.m4a goodnight-moon kristen 1
scripts/book-voice.sh ~/Desktop/kristen/page-02.m4a goodnight-moon kristen 2
# ... etc
```

Then edit `BookRegistry.ts` and add Kristen as a second reader inside the same book entry:

```ts
readers: [
  {
    id: 'ryan',
    name: 'Uncle Ryan',
    pages: [/* ... */],
  },
  {
    id: 'kristen',
    name: 'Mommy',
    pages: [
      require('../../assets/books/goodnight-moon/voices/kristen/page-01.mp3'),
      require('../../assets/books/goodnight-moon/voices/kristen/page-02.mp3'),
      // ...
    ],
  },
],
```

Now the reader picker shows both options when you tap the book.

---

## Adding another book

Same nine steps, with a different `book-id`. Each book is a self-contained folder under `assets/books/` and a separate entry in the registry's `BOOKS` array.

The registry validator and the adult-panel picker scale to as many books as you want — there's no code change required for book #5, #10, or #50.

---

## Commit when you're happy

```bash
git add assets/books/goodnight-moon/ src/books/BookRegistry.ts
git commit -m "Add Goodnight Moon (read by Uncle Ryan)"
git push
```

Don't commit until each book sounds right on your phone — once it's pushed, it'll go to TestFlight and Mom on her next app update.

---

## Troubleshooting

**The book doesn't show up in the picker.**
You probably forgot to add it to `BookRegistry.ts`, or there's a typo in the `id`. Tests would have caught a mismatch — run `npm test` and read any failures.

**Pages advance but no audio plays.**
Check your audio mode (long-press → adult panel). In **silent** mode, book audio is silenced. Switch to **gentle**, **music**, or **full**.

**Audio plays for the wrong page.**
The order of `require()` calls inside `reader.pages` doesn't match the order in `book.pages`. Double-check that audio[i] corresponds to image[i] for every i.

**A specific page's word is being cut off.**
Re-run `book-voice.sh --keep-tail` for that one page.

**Pages look stretched or weird.**
The page image probably wasn't in a sensible aspect ratio. Re-run `book-page.sh` with a higher-resolution source if you have one.

**A new reader's recording plays in the wrong book.**
The `reader-id` collided across books. Reader ids are scoped per-book, but folder paths use them too — make sure the path in your `require()` calls matches the folder you saved into.
