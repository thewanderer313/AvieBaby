# AvieBaby — Book Mode Design Spec

**Date**: 2026-06-12
**Owner**: Ryan (uncle)
**Primary user**: Ava, 18 months old
**Adult operators**: Ryan (Android), Kristen (iPhone), and other family members who record themselves reading books

## Purpose

A second mode in the AvieBaby app where the adult picks a picture book and one of several family voices, then leaves Ava with the page-image-and-audio experience. She sees the pages and hears people she knows reading the words. Over time, the catalog grows: more books, more readers per book. The app design must scale to "the whole bookshelf" without code changes other than adding registry entries.

Same safety, privacy, and adult-control guarantees as the existing play mode. Book mode is opt-in per session (an adult starts it) and not selectable by Ava herself — but she retains real agency once inside (turn pages, go back, replay).

## Relationship to play mode

Play mode (the existing v1 app) is unchanged. Book mode is a second, parallel mode with its own root component. The app is in exactly one mode at any time. Mode switching is adult-driven via the AdultPanel.

```
App
├── AppModeProvider (mode: 'play' | 'book')
├── ThemeProvider
├── AudioProvider
└── ModeRouter
    ├── PlayScreen   (when mode === 'play')   → portrait
    └── BookScreen   (when mode === 'book')   → landscape
```

The transition between screens is a brief crossfade (~200 ms).

## Orientation

- `mode === 'play'` → device locked to **portrait**
- `mode === 'book'` → device locked to **landscape** (rotate counterclockwise so the device's volume rocker / power button physical layout doesn't change Ava's grip dramatically)

Orientation is enforced via `expo-screen-orientation` at the App root. Ava can't accidentally flip orientation. When she rotates the phone, the OS does nothing because the app is locked.

The 120×120 AdultPanel hotspot stays in the **same physical corner of the device** in both modes. In portrait that corner is top-left of the screen; after counterclockwise rotation to landscape it is bottom-left of the screen. The hotspot's position in CSS is determined at render time based on the current mode.

## Core experience (book mode)

When a book is open:
- Full-screen page image, `contentFit="contain"` (letterboxed if needed). Black background fills any remaining space.
- The current page's audio plays automatically from the start.
- Ava taps anywhere (except the adult corner) → next page. Current audio cuts off immediately; next page's audio starts.
- Ava long-presses (~800 ms hold) anywhere (except the adult corner) → previous page. Current audio cuts off, previous page's audio starts.
- When she advances past the last page, the book loops back to page 1 with a fresh play of the page-1 audio. No "the end" screen. She can listen forever.
- When she is on page 1 and triggers "previous", nothing happens (no wrap-around backward).
- The adult corner long-press (2 s) opens the AdultPanel.

## Gesture priority and timing

Three gestures compete on the book surface. They resolve by position and duration:

| Position | Duration | Outcome |
|---|---|---|
| In adult corner (120×120) | ≥ 2000 ms | Open AdultPanel |
| In adult corner | < 2000 ms | Treat as tap → next page (so a stray tap on the corner still progresses, never opens the panel) |
| Outside adult corner | ≥ 800 ms | Previous page |
| Outside adult corner | < 250 ms | Next page (interrupt audio) |
| Outside adult corner | 250–799 ms | Next page (tolerance window — treat as a slow tap, not a hold) |

The 250–799 ms window is the "fat finger" zone — Ava holds her thumb on the screen a little long, but didn't mean to go back. Calling this forward keeps the most common case from being surprising.

## Audio behavior

Each book × reader combination provides one audio clip per page. Audio plays at full volume in **gentle**, **music**, and **full** audio modes; silenced in **silent** mode. The "music" mode mute-on-voice rule from play mode does NOT apply in book mode — the whole point of book mode is hearing the family voice. A small visual indicator (a quiet little speaker icon on the adult corner only, *not* the play surface) can show audio state if useful; out of scope for v1.

Entering book mode pauses play-mode background music. Exiting book mode resumes it.

There is no SFX, no chimes, and no music in book mode. Only the family voice reading the page. The book audio uses the same `playOneShot`-style transient player pattern that voice labels use in play mode.

## Adult panel additions

The AdultPanel gains a new top-level section, "Books", with the same UX shape as the existing lockdown tutorial (sub-views within the modal).

### When opened in play mode

The Books section is rendered in the settings view, between **Jump to theme** and **Lock the phone**. Tapping "Books" enters the book picker sub-view:

1. **Pick a book** — scrollable list of registered books (one row per book showing title). Title comes from `Book.title`.
2. After tapping a book, the panel pushes a **Pick a reader** sub-view showing the readers registered for that book (e.g., "Uncle Ryan", "Mommy", "Grandma").
3. Tapping a reader closes the AdultPanel and transitions the app to landscape book mode, starting at page 1 with that reader's audio.
4. A "← Back" link returns from reader picker to book picker; from book picker back to settings.

### When opened in book mode

The AdultPanel layout shifts to put **"Exit book"** as the most prominent control at the top. The standard settings remain available below it (audio mode, theme jump, lockdown help). The "Books" section is absent in this state (no nesting books-within-a-book mode for v1).

### Mid-book book switching

To switch books or readers mid-session, the adult exits to play mode first (via "Exit book"), then re-enters via the Books picker. Direct book-to-book switching is out of scope for v1.

## Data model

### Types (`src/books/types.ts`)

```ts
/** Stable id for a reader, e.g. 'ryan' | 'kristen' | 'grandma'. */
export type ReaderId = string;

export interface Reader {
  /** Stable id used as map key (e.g., 'ryan'). */
  id: ReaderId;
  /** Display name shown in the picker (e.g., "Uncle Ryan"). */
  name: string;
  /**
   * One audio clip per page, in the same order as Book.pages.
   * Length MUST equal Book.pages.length. Each entry is a require()'d mp3 module id.
   */
  pages: number[];
}

export interface Book {
  /** Stable id used in the file system (e.g., 'goodnight-moon'). */
  id: string;
  /** Display title shown in the picker (e.g., "Goodnight Moon"). */
  title: string;
  /** Optional thumbnail for the picker. require()'d png/jpg module id. */
  cover?: number;
  /**
   * Page images in order. Each entry is a require()'d image module id.
   * Length must equal each Reader.pages array's length.
   */
  pages: number[];
  /** One or more family-recorded readings. Order is presentation order in the picker. */
  readers: Reader[];
}
```

### Registry (`src/books/BookRegistry.ts`)

A static hand-edited array, same pattern as `ThemeRegistry.ts`:

```ts
import { Book } from './types';

export const BOOKS: Book[] = [
  // example shape — file starts empty for v1 implementation, filled in as
  // real books and recordings are produced
  {
    id: 'goodnight-moon',
    title: 'Goodnight Moon',
    cover: require('../../assets/books/goodnight-moon/cover.png'),
    pages: [
      require('../../assets/books/goodnight-moon/pages/page-01.png'),
      require('../../assets/books/goodnight-moon/pages/page-02.png'),
      // ...
    ],
    readers: [
      {
        id: 'ryan',
        name: 'Uncle Ryan',
        pages: [
          require('../../assets/books/goodnight-moon/voices/ryan/page-01.mp3'),
          require('../../assets/books/goodnight-moon/voices/ryan/page-02.mp3'),
          // ...
        ],
      },
      // additional readers as recordings are made
    ],
  },
];
```

Adding a new book or a new reader is a small TS edit. There is no runtime discovery of files.

### Asset layout

```
assets/books/<book-id>/
  cover.png                    (optional)
  pages/
    page-01.png
    page-02.png
    ...
  voices/<reader-id>/
    page-01.mp3
    page-02.mp3
    ...
```

Filenames are zero-padded two-digit page numbers. Page count is determined by `pages.length` in the registry — the script doesn't need to know it, the registry editor does.

## Asset pipeline scripts

Three new scripts mirror the shape of existing helpers (`voice.sh`, `boomerang.sh`, `icon.sh`):

### `scripts/book-page.sh <input-image> <book-id> <page-number>`

- Resizes input to a landscape-friendly target (1920×1080 max, preserving aspect ratio, padded with black to 1920×1080 if needed).
- Re-encodes to PNG.
- Writes to `assets/books/<book-id>/pages/page-NN.png` (NN = zero-padded page number).
- Validates: input exists, ffmpeg installed, page number is 1–99.

### `scripts/book-voice.sh [--keep-tail] <input-audio> <book-id> <reader-id> <page-number>`

- Same trim / loudness pipeline as `voice.sh` (silence trim, -16 LUFS, mono mp3 96 kbps).
- `--keep-tail` flag, same semantics as `voice.sh`.
- Writes to `assets/books/<book-id>/voices/<reader-id>/page-NN.mp3`.
- Validates: input exists, ffmpeg installed, book-id matches `assets/books/<book-id>/`, page number is 1–99.

### `scripts/book-cover.sh <input-image> <book-id>`

- Resizes to 512×512 square with `force_original_aspect_ratio=increase,crop`.
- Re-encodes to PNG.
- Writes to `assets/books/<book-id>/cover.png`.
- Optional — only needed if `cover` is set on the Book entry.

## Components

### `src/mode/AppModeProvider.tsx`

React context. Holds `mode: 'play' | 'book'`, `currentBookId: string | null`, `currentReaderId: string | null`, and methods `enterBook(bookId, readerId)` and `exitBook()`. Side effects on transition:

- `enterBook`: store ids, set mode to 'book', call `expo-screen-orientation` to lock landscape, pause play-mode music via AudioProvider, run a crossfade.
- `exitBook`: clear ids, set mode to 'play', lock portrait, resume play-mode music, crossfade.

Exposes `useAppMode()` hook.

### `src/books/BookProvider.tsx`

Context for in-book state. Provides `currentPage: number` (0-indexed), `currentBook: Book`, `currentReader: Reader`, `next()`, `previous()`. The `next()` from the last page wraps to page 0 and starts that audio fresh. `previous()` at page 0 is a no-op.

Mounts only when `mode === 'book'`. Reads the active book/reader from `AppModeProvider`.

### `src/components/BookScreen.tsx`

Landscape root. Renders, in z-order from back to front:
- Solid black background View
- Current page's `<Image>` with `contentFit="contain"`, full screen
- `BookGestureSurface` (transparent, catches all gestures except adult corner)
- AdultPanel (with its hotspot positioned bottom-left for landscape)

Triggers page-1 audio playback on mount via `useEffect`. Triggers each page's audio whenever `currentPage` changes via another `useEffect`. Audio runs through `AudioProvider.playBookPage(source)`.

### `src/components/BookGestureSurface.tsx`

The book surface has two physically separate gesture regions, each with its own `GestureDetector`:

1. **The adult corner** — a 120×120 View at the device's top-left physical corner (= bottom-left of the landscape screen). Carries only a single `Gesture.LongPress().minDuration(2000)` → opens AdultPanel. Identical pattern to play mode.

2. **The play surface** — a full-screen View that does NOT include the corner region. Layered behind the corner View. Carries two gestures via `Gesture.Race`:
   - `Gesture.Tap().maxDuration(799)` → `BookProvider.next()`. The 799 ms cap is wide enough to absorb fat-finger toddler taps that linger longer than a crisp tap but aren't meant as a hold. Any release before 800 ms = forward.
   - `Gesture.LongPress().minDuration(800)` → `BookProvider.previous()`. Fires once the moment the hold crosses 800 ms — the user doesn't have to release. This makes the "back" gesture feel responsive (the page changes the instant they've held long enough).

Because the corner View sits on top of the play surface and has its own gesture detector, holding inside the corner never triggers the play surface's back gesture — gesture-handler resolves to the corner's LongPress, which only fires at 2 s. This keeps the adult corner clean: only ever opens the AdultPanel, never accidentally pages backward.

### AudioProvider additions

A new method `playBookPage(source: number): void`:

- Cancels any currently-playing book-page clip.
- Plays the new clip via `createAudioPlayer` (fire-and-forget like voice labels).
- Respects `shouldPlayVoice()` — silent mode means no sound.
- Does NOT duck music (because no music plays in book mode).

A book audio mode boolean isn't needed; the existing `shouldPlayVoice()` covers it. Book mode plays voice clips just like character voice labels do.

### AdultPanel additions

New view enum: `'settings' | 'lockdown' | 'book-picker' | 'reader-picker'`. The existing `view` state becomes a small union. New props on the book and reader sub-views:

- `book-picker`: list of `BOOKS.map(b => button(b.title))`. Tap → set `view = 'reader-picker'` with that book's id stashed.
- `reader-picker`: list of `selectedBook.readers.map(r => button(r.name))`. Tap → call `appMode.enterBook(bookId, readerId)`, close modal.

When the AdultPanel is opened with `mode === 'book'`, the settings view replaces the "Books" entry with an "Exit book" button at the top (red, same style as the existing exit button but labeled differently). Pressing it calls `appMode.exitBook()`.

The lockdown tutorial sub-view is unchanged and reachable from both modes.

## Privacy / safety guarantees (unchanged from v1)

- Zero network calls; all book assets bundled at build time.
- No permissions requested.
- No analytics, no crash reporters, no ads, no sign-in.
- Adult-corner long-press is the only escape from book mode just as it's the only escape from play mode.
- Android hardware back button is intercepted in both modes (existing behavior in `App.tsx`).

## Testing strategy

Same shape as v1:

- **Unit tests** for pure logic only:
  - `BookProvider` page advance/retreat including the "loop at end" rule and "no-op at page 0 back" rule.
  - `BookRegistry` schema invariants: every book has at least one reader; every reader's `pages.length` equals the book's `pages.length`; book ids unique; reader ids unique within a book.
- **No tests for UI / orientation / Skia / gestures** — those get manual smoke testing on device.
- **Manual smoke checklist** in README:
  - Open the app → silent mode by default
  - Long-press top-left → AdultPanel opens
  - Tap "Books" → pick a book → pick a reader → app rotates and book starts
  - Tap on page → advances, audio cuts and new audio plays
  - Long-press (~1 s) → goes back a page
  - Hold the device's physical top-left corner (now bottom-left in landscape) for 2 s → AdultPanel opens with "Exit book" at top
  - Tap Exit book → returns to portrait + play mode
  - Switch audio to silent in AdultPanel, re-enter book mode → no audio plays but pages still advance on tap

## Explicitly out of scope (v1)

- Bookmarks / resume mid-book between sessions
- Manual reading speed or skip-to-specific-page
- Page text overlay or subtitles
- Search across books, categories, tagging
- Direct book-to-book or reader-to-reader switching mid-book (requires exit + re-enter)
- Re-recording flow inside the app (recordings still happen outside, via `book-voice.sh`)
- Background music underneath the reading
- Per-page audio length matching to page count (no enforcement; the script trusts the user matches files correctly)
- Multi-language pickers, multiple covers, animated covers
- Image-zoom or pan within a page
- Backward-loop at page 1
- Picture-only books (a reader entry is required; if no recording exists, silent mode achieves the same effect)

## Open questions (deferred to implementation plan)

- Whether to crossfade page images for a transition feel or just hard-cut — try hard-cut first, add transitions only if device testing reveals it's jarring.
- Whether to pre-decode the next page's image to avoid flicker on advance — wait and see if the simple Image component is fast enough on real hardware.
- Whether the BookProvider's `next()` should pre-emptively kill the previous page's audio player synchronously, or let AudioProvider's `playBookPage` clean up — settle during AudioProvider design.
