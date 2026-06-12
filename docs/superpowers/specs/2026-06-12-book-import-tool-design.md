# AvieBaby Book Import Tool — Design Spec

**Date**: 2026-06-12
**Owner**: Ryan (uncle)
**User**: Ryan (single user, on his Windows machine)

## Purpose

A local web GUI launched via `npm run book-tool` that lets Ryan **see, add, edit, preview, and remove** books in the AvieBaby app's book mode catalog. The tool wraps the existing ffmpeg-based asset pipeline (`book-page.sh`, `book-voice.sh`, `book-cover.sh`, `book-register.js`) so the same trusted processing runs under the hood — the GUI is a thin, careful shell around them.

The motivating problem: scanning a 12-page book and recording 12 audio clips currently requires running ~25 shell commands in a precise order. The risk of mismatched page-to-audio order is real, and there's no in-place verification before publishing to the registry. The tool eliminates both.

## Non-goals

- Multi-user / auth / remote access. The server only binds to `127.0.0.1`.
- Hosting on the public internet.
- Replacing the underlying shell scripts (they remain the source of truth for ffmpeg processing).
- Reordering pages mid-book, removing pages mid-book, or removing a single reader from a multi-reader book (these all involve shifting indices across multiple readers — defer to v2).
- Editing the app source code (the tool only touches `assets/books/` and runs `book-register.js`).

## Architecture

Two processes, both started by `npm run book-tool`:

1. **Express server** on port `5174` (configurable via `PORT` env var). Binds to `127.0.0.1` only. Talks to the project filesystem and shells out to the existing pipeline scripts.
2. **Vite dev server** on port `5175` (proxied via the Express server) serving the React single-page frontend.

`npm run book-tool` is a single script that:
- Starts both processes concurrently
- Opens the user's default browser to `http://localhost:5174/`
- Stops cleanly on Ctrl+C

The frontend talks to the server via JSON REST + multipart form uploads. The server's responses include validation results, progress, and error details so the frontend can show meaningful feedback.

## Frontend: screens

The single-page app has four screens. Navigation is local React state (no routing library needed for v1).

### 1. Book list (home)

- **"+ Add a book"** button at the top
- A grid of cards, one per registered book. Each card:
  - Cover thumbnail (or a generated placeholder if no cover)
  - Title
  - Page count, reader list (e.g., "12 pages • Uncle Ryan, Mommy")
  - Four buttons: **Preview**, **Edit**, **Delete**
- Empty-state message if no books exist, with a link to the asset pipeline docs.

### 2. Add-book wizard

A single page with sections, top to bottom:

**Title + first reader**
- Text input: **Book title** ("Goodnight Moon")
- Text input: **Reader display name** ("Uncle Ryan")
- Auto-derived **book id** and **reader id**; editable text inputs that update live as the display fields are typed. Both validate against existing ids (red border + helper text on collision).

Derivation rule (applied in the client, sent to the server explicitly):
- Lowercase the input.
- Strip apostrophes and any character that isn't `a-z`, `0-9`, space, or dash.
- Collapse runs of spaces/dashes to a single dash.
- Trim leading/trailing dashes.

Examples: `"Goodnight Moon"` → `goodnight-moon`. `"Don't Let the Pigeon Drive the Bus"` → `dont-let-the-pigeon-drive-the-bus`. `"Brown Bear, Brown Bear"` → `brown-bear-brown-bear`.

**Pages**
- Drop zone accepting multiple image files at once. Also a "Choose files" button for the OS native file picker.
- Each dropped file appears as a tile: thumbnail (preview-rendered in the browser via `URL.createObjectURL`) + page-number badge (1, 2, 3...) + filename underneath.
- Tiles can be **dragged to reorder**. Page numbers update live.
- Each tile has an "×" button to remove.
- Footer line: "12 pages selected" and the order they'll be processed in.

**Voices**
- Drop zone for multiple audio files.
- Tiles appear in dropped order, **auto-paired to pages** by position. Page 1 ⇄ first audio, etc.
- Each tile shows: filename + duration (derived via `<audio>` `loadedmetadata`) + a ▶ Play button for verification + page-number badge showing which page it's currently paired with.
- Tiles draggable to re-pair (drag the tile to a different position in the list).
- Per-tile checkbox: "Use --keep-tail for this file" (defaults off). The user can flip this if they know the trailing word is soft.
- Inline warning if audio count ≠ page count, in red, with the count diff.

**Cover (optional)**
- Small single-file drop zone. Skip if not provided.

**Import button**
- Disabled until: title non-empty, reader name non-empty, book id valid + unique, ≥1 page, audio count == page count.
- On click: progress overlay with a per-step status feed ("Processing page 3/12...", "Processing audio 5/12...", "Generating cover...", "Updating registry..."). Each script invocation's stdout/stderr is shown in a collapsible details block in case something fails.
- On success: return to book list with a green toast "Book added: Goodnight Moon" and the new book visible.
- On failure: stay on the wizard, show the error, leave all the user's input in place so they can retry without redoing work.

### 3. Edit-book screen

Mirrors the add layout, pre-populated with the current state of the book.

**Title** input at the top.

**Readers** list:
- One row per existing reader: display name (editable input) + ▶ play-all button (plays all pages sequentially in the preview overlay)
- **"+ Add a reader"** button → sub-flow:
  - Asks for new reader name + id
  - Shows a list of every existing page with a drop zone underneath each one (or one drop zone at the top that auto-pairs to pages in order)
  - "Save" runs `book-voice.sh` for each page and updates `book.json`

**Pages** list (one row per existing page):
- Thumbnail of the current page image (clickable to enlarge in a modal)
- For each reader: a small audio row with ▶ play + filename + a **Replace** button (replaces just that audio file)
- A **Replace image** button (replaces just the page image)

**"+ Add pages at the end"** button:
- Drop zone for new page images
- Once images are in, the UI requires audio uploads for **every existing reader** for **every new page** (shows missing-audio in red); only enables Save when complete.

**Save changes** button:
- Disabled until all required fields are valid (no empty titles, no missing audio for added pages, etc.)
- On click: writes the diff to disk via individual API calls (title/readers via `PATCH`, asset replacements via `PUT`, new readers via `POST`), regenerates the registry, returns to book list with toast.

### 4. Preview overlay

A full-screen modal opened from the book list's Preview button.

- Header bar: book title + reader picker dropdown (defaults to first reader) + an **× Close** button
- Page image fills the viewport, letterboxed on a black background with `object-fit: contain` (mirrors the real app's `contentFit="contain"`)
- The reader's audio for the current page **auto-plays** when the page appears
- **Click on the page area** or **right arrow key** → next page. Cuts current audio, plays new audio.
- **Long-press** (~800ms) on the page **or left arrow key** → previous page. Same audio behavior.
- **After last page**, loops to page 1 (matches the real app's behavior).
- **No timer / no auto-advance** — pages only advance on user input, matching the spec for the app itself.

## Backend: API

All endpoints return JSON. Multipart endpoints (`POST`/`PUT` with files) use `multipart/form-data` with field names called out below.

### `GET /api/books`
Returns the current registry as JSON:
```json
{
  "books": [
    {
      "id": "goodnight-moon",
      "title": "Goodnight Moon",
      "pageCount": 12,
      "hasCover": true,
      "readers": [
        { "id": "uncle-ryan", "name": "Uncle Ryan" },
        { "id": "mommy", "name": "Mommy" }
      ]
    }
  ]
}
```

The server implementation: re-runs `node scripts/book-register.js` to make sure the on-disk registry is fresh, then parses `assets/books/<id>/book.json` for each subdirectory plus filesystem inspection for page/voice counts.

### `POST /api/books`
Multipart upload:
- `title` (string)
- `bookId` (string) — pre-derived from title client-side, sent explicitly so server and client agree
- `readerName` (string)
- `readerId` (string)
- `page-1`, `page-2`, ..., `page-N` (image files, in order)
- `voice-1`, `voice-2`, ..., `voice-N` (audio files, in order, matching page count)
- `voice-keep-tail-N` (string `"true"`/`"false"` per page — sent for any that have the flag enabled)
- `cover` (image file, optional)

Server runs:
1. `scripts/book-page.sh --title "<title>" <tmp/page-1> <bookId> 1`
2. `scripts/book-page.sh <tmp/page-N> <bookId> N` for the rest
3. `scripts/book-voice.sh --reader-name "<readerName>" [--keep-tail] <tmp/voice-1> <bookId> <readerId> 1`
4. `scripts/book-voice.sh [--keep-tail] <tmp/voice-N> <bookId> <readerId> N` for the rest
5. `scripts/book-cover.sh <tmp/cover> <bookId>` if cover provided
6. `node scripts/book-register.js`

Each step streams progress events back to the client via Server-Sent Events on the same connection (or a separate `/api/jobs/:id/events` if SSE in the multipart response gets ugly — implementation detail). On any step's failure, the API returns 500 with the stderr in the response body and the temporary files are cleaned up but partial assets on disk (e.g., the first 3 pages succeeded before page 4 failed) are LEFT for inspection — the user can re-run with the fix.

### `DELETE /api/books/:id`
Removes `assets/books/<id>/` recursively, then regenerates the registry. Body: `{ confirmation: "<book title>" }` — the server validates that the confirmation matches the book's title to guard against fat-finger deletes.

### `PATCH /api/books/:id`
JSON body:
```json
{
  "title": "New Title",
  "readers": { "uncle-ryan": "Uncle Ryan (Updated)" }
}
```
Server updates `assets/books/<id>/book.json` accordingly, regenerates registry.

### `POST /api/books/:id/readers`
Multipart upload:
- `readerName`, `readerId`
- `voice-1`, ..., `voice-N` matching the existing book's page count
- Optional `voice-keep-tail-N` flags

Server runs `book-voice.sh` for each, updates `book.json` (so the new reader's display name lands in metadata), regenerates registry.

### `POST /api/books/:id/pages`
Multipart upload for adding pages at the end:
- `page-N+1`, `page-N+2`, ... (image files)
- `voice-<reader-id>-<page-num>` (audio file per existing reader per new page)

Server runs `book-page.sh` for each new image, `book-voice.sh` for each new audio, regenerates registry.

### `PUT /api/books/:id/pages/:n/image`
Multipart upload of a single replacement page image. Server runs `book-page.sh` with the existing book-id and page number, which overwrites the previous file.

### `PUT /api/books/:id/pages/:n/voices/:reader-id`
Multipart upload of a single replacement audio file. Optional `keepTail` field. Server runs `book-voice.sh` with overwrite.

### `GET /assets/books/...`
Static file serving for the preview overlay's image and audio playback. Read-only; the server only serves files inside `assets/books/`.

## Validation rules

The server enforces these before any script runs:

- **Book id**: lowercase, dash-separated, 1-50 chars, matches `^[a-z][a-z0-9-]*$`, unique across existing books (when adding) or matches the URL param (when editing).
- **Reader id**: same constraints, unique within the book.
- **Title**: non-empty, ≤120 chars, single line.
- **Reader name**: non-empty, ≤80 chars.
- **Page images**: each ≤10 MB, format accepted by ffmpeg (PNG/JPG/HEIC/WebP).
- **Audio**: each ≤20 MB, format accepted by ffmpeg (M4A/MP3/WAV/AAC).
- **Page count**: ≥1, ≤99.
- **Audio count on add**: must equal page count.
- **Audio count on add-reader**: must equal existing page count.
- **No path traversal**: book-id and reader-id are sanitized before being passed to any shell command (no `..`, no `/`, no `;`).

All shell-script arguments are passed using `child_process.spawn` (not `exec`) with argv arrays to prevent shell injection.

## Files

```
tools/book-import/
├── package.json            Local deps (express, multer, vite, react, etc.) separate from app deps
├── tsconfig.json
├── vite.config.ts
├── server/
│   ├── index.ts            Express boot, routes, ports, browser-open
│   ├── routes/
│   │   ├── books.ts        list / add / edit / delete
│   │   ├── readers.ts      add reader to existing book
│   │   └── pages.ts        add pages, replace single page or audio
│   ├── pipeline.ts         child_process.spawn wrappers for the scripts
│   ├── registry.ts         parse assets/books/ + book.json into the API response shape
│   └── validation.ts       id/name/file-size sanitization
└── client/
    ├── index.html
    ├── main.tsx
    ├── App.tsx
    ├── api.ts              fetch wrappers, types shared with server
    ├── screens/
    │   ├── BookList.tsx
    │   ├── AddBookWizard.tsx
    │   ├── EditBook.tsx
    │   └── PreviewOverlay.tsx
    └── components/
        ├── PageTile.tsx
        ├── VoiceTile.tsx
        ├── DropZone.tsx
        ├── ProgressOverlay.tsx
        └── DeleteConfirm.tsx
```

Root `package.json` adds:
- `"book-tool": "cd tools/book-import && npm run dev"`
- A devDependency or workspace declaration so the tool's deps don't leak into the Expo build.

## Tech stack

- **Server**: Node 20+ (already required), Express 4, Multer for multipart, `child_process.spawn`, native fs/promises.
- **Frontend**: React 18+ (separate from the app's React Native; this is a plain web React using Vite), TypeScript. No router. No state library beyond React's built-ins.
- **Drag-and-drop**: native HTML5 drag-and-drop API. `react-dnd` only if the native API gets clunky during implementation.
- **Audio playback**: `<audio>` elements with `controls={false}` and custom play buttons.
- **Image rendering**: `<img>` with `URL.createObjectURL` for pre-import previews, plain `<img src="/assets/books/...">` for in-registry images.

## Error handling

- **Script failure**: API returns 500 with `{ step: "page-3", stderr: "...", message: "..." }`. Frontend keeps the wizard state and shows a clear error.
- **Partial completion**: If page 4 fails after pages 1-3 succeeded, the script-produced files at `assets/books/<id>/pages/page-{01,02,03}.png` are LEFT on disk. The user can re-import only the failing page (which overwrites `page-04.png`) — book-id stays the same. A re-run of the registry generator at the end ties everything together.
- **File-format issues**: Validated client-side first; if a file is rejected by ffmpeg, the script's stderr lands in the response.
- **Concurrent edits**: The server uses a single in-process mutex around any write operation — no two scripts run at once for the same book.

## Testing strategy

Mirrors the app's pragmatic approach:

- **Unit tests** for pure logic only: id validation, file-size validation, voice-count-matches-page-count, `book.json` diff calculation for the PATCH endpoint.
- **No tests** for the React UI surface (drag-and-drop + audio elements are hard to unit-test reliably) — manual smoke checklist in `tools/book-import/README.md`.
- **Smoke checklist**:
  - Start the tool, browser opens, book list shows existing books
  - Add a one-page book end-to-end; verify file paths and registry entry
  - Add a multi-page book with the keep-tail flag on one voice; verify the audio
  - Add a reader to that book; verify the reader picker shows both in the preview
  - Replace a page image; verify the replacement appears in the preview
  - Replace an audio file; verify
  - Delete the book; verify all files and the registry entry are gone
  - Try every validation rule (collision, too many pages, mismatched count, etc.)

## What's explicitly out of scope (v1)

- Editing operations that change page count for existing books in any way other than appending (reorder, mid-book insert, mid-book remove)
- Removing a single reader while keeping the others
- Asset re-processing on already-stored files (re-run `boomerang.sh` etc.)
- Server processes that survive across `npm run book-tool` sessions
- Drag-and-drop FROM an existing book's pages (e.g., to copy them into a new book)
- Backup / version control of book.json or assets/books/ (Git handles that already)
- Internationalization, accessibility audit, mobile responsiveness (it's a local-only tool used on Ryan's primary computer)

## Open questions (deferred to implementation plan)

- **Vite + Express integration**: run them as two processes coordinated by a single root script (concurrently / npm-run-all), or run Vite in middleware mode embedded in Express? Lean toward two processes — simpler, no middleware setup, the frontend dev experience stays normal.
- **Progress streaming**: SSE vs. WebSocket vs. just polling `/api/jobs/:id`. Probably SSE; smallest spec.
- **Drag-and-drop fidelity**: native HTML5 DnD works but feels clunky on touchpads. `react-dnd` is heavier but smoother. Try native first.
- **Audio duration in tiles**: derive client-side from `<audio>.loadedmetadata` (zero-trip) or have the server return it from ffprobe (one extra script call). Lean toward client-side.
