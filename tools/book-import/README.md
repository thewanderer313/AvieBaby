# AvieBaby Book Import Tool

A local-only web GUI for managing the AvieBaby app's book catalog. Wraps the existing `scripts/book-page.sh` / `scripts/book-voice.sh` / `scripts/book-cover.sh` / `scripts/book-register.js` so you can see, add, edit, preview, and delete books without running shell commands per page.

## Run

From the repo root:

```
npm run book-tool
```

Opens your default browser to http://127.0.0.1:5175/. Ctrl+C to stop.

Requires ffmpeg on PATH (same as the underlying scripts), Node 20+, and bash (Git Bash on Windows).

## What it does

- Lists all registered books with cover, page count, and readers
- Add a book: drop in images + audio (paired by drop order, drag to reorder), set title and reader name, click Import. Runs book-page.sh / book-voice.sh / book-cover.sh / book-register.js for you.
- Edit a book: rename title, rename readers, add a new reader (with their N audio clips), replace a single page image, replace a single audio clip, append more pages at the end.
- Preview a book: full-screen viewer that mimics the app's tap-to-advance + audio behavior.
- Delete a book: requires typing the book title to confirm.

## What it does NOT do (v1)

- Reorder pages mid-book (you must add pages in correct order at add time; replace individual page images via Edit if a single page is wrong).
- Remove pages mid-book or remove a single reader from a multi-reader book.
- Multi-user / network access. The server binds to 127.0.0.1 only.

## Smoke checklist

After making changes to the tool, run through this before declaring it working:

1. `npm run book-tool` opens a browser tab to http://127.0.0.1:5175/.
2. Book list shows existing books (or empty state).
3. Add a one-page book end-to-end. Verify `assets/books/<id>/pages/page-01.png` and `voices/<reader>/page-01.mp3` exist; verify the book appears in the list.
4. Add a second reader to that book. Verify the reader picker in the preview shows both.
5. Preview the book. Verify the page image displays, audio plays, arrow keys + clicks navigate.
6. Edit: rename the title. Verify it updates in the list.
7. Replace a single page image. Verify the new image shows in the preview.
8. Append pages with audio for each existing reader. Verify the new pages appear at the end.
9. Delete the book. Confirm the assets/books/<id>/ directory is gone and the book is no longer in the list.
10. Try every validation: collision on book id, too few voices, file too large, oversize image.

## Architecture

- Express server on 127.0.0.1:5174 exposes REST + SSE
- Vite dev server on 127.0.0.1:5175 serves the React frontend, proxies /api and /assets to 5174
- A single root npm script (`npm run book-tool`) starts both processes and opens the browser
- The Express server shells out to the shell scripts via `child_process.spawn` with argv arrays
- Pure-logic tests live in `server/validation.test.ts` and `server/registry.test.ts`; UI is manually smoke-tested

See `docs/superpowers/specs/2026-06-12-book-import-tool-design.md` for the full design rationale.
