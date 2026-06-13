# Library and Readings — Design

**Status:** Draft for review
**Author:** Ryan + Claude (brainstorm, 2026-06-13)
**Supersedes (in part):** `2026-06-12-book-mode-design.md` (data model only — the runtime UX of book mode is unchanged)

## Motivation

Today, a book is `{ pages[], readers{ reader-id → audio[] } }`. The page sequence is shared across all readers of that book. This couples the readers in a way that makes editing painful: if Ryan wants to reorder his pages, he can't — Kristen's reading is locked into the same order, even though her recording would still play fine in either order. Adding a page mid-book has the same problem multiplied across readers.

The fix is to make each reader's reading of a book a fully independent unit. The shared identity is the book *title*, not the page sequence.

## Goals

- One reader's edits never affect another reader's reading of the same title.
- The page set, order, and count of a reading are owned by that reading.
- Assets (images, audio) live in a flat library and are referenced by readings.
- The library has predictable filters so building a reading is not a file hunt.
- Existing AvieBaby app runtime UX is unchanged from a user-visible standpoint: title-group picker → reader picker → book screen.

## Non-goals (v1)

- No drag-and-drop reordering in the reading editor (up/down arrows only).
- No cross-title asset reuse in the picker UI (assets are filtered by their source string; reusing an image across two titles requires re-uploading or relaxing the filter in v1.1).
- No bulk delete in the library.
- No editing of an asset's source/reader after upload (re-upload instead).
- No migration of the existing `assets/books/test/` book. Greenfield.

## Concepts

Three top-level concepts replace today's "book":

### Asset

An image or audio file in the library.

```ts
type Asset =
  | { id: string; type: 'image'; source: string; filename: string }
  | { id: string; type: 'audio'; source: string; reader: string; filename: string };
```

- `source` is a free-text string supplied at upload time. Typically the title of the book the asset belongs to.
- `reader` is required on audio assets only. Free-text, e.g. "Uncle Ryan".
- `filename` is the on-disk path relative to `assets/library/{images,audio}/`.
- `id` is sequential and zero-padded (`img-0001`, `aud-0001`) for human readability.

### Title-group

A real-world book title that one or more readings are bound to.

```ts
type TitleGroup = {
  id: string;            // slug derived from displayName at creation
  displayName: string;
  cover?: string;        // path relative to assets/titles/<id>/, when set
};
```

- `id` is locked at creation. Renames change only `displayName`.
- `cover` is an optional thumbnail used by the runtime app's picker.

### Reading

The per-reader content for a title-group.

```ts
type Reading = {
  id: string;
  titleId: string;       // -> TitleGroup.id
  reader: string;        // display name, e.g. "Uncle Ryan"
  pages: Array<{
    image: string;       // -> Asset.id where type === 'image'
    audio: string;       // -> Asset.id where type === 'audio'
  }>;
};
```

- `pages` order is the playback order. Page N = `pages[N-1]`.
- `image` and `audio` ids must resolve to existing assets. Integrity is checked at write time and at registry generation.
- Two readings under the same `titleId` may have different page counts, different image sets, and different orderings. They are independent in every respect except the shared title.

## On-disk layout

```
assets/
  library/
    images/img-NNNN.png
    audio/aud-NNNN.mp3
    library.json
  titles/
    <title-id>/
      title.json
      cover.png                  # optional
  readings/
    <reading-id>/
      reading.json
```

`assets/books/` is deleted as part of the v1 cutover.

### `library.json`

```json
{
  "assets": [
    { "id": "img-0001", "type": "image", "source": "Goodnight Moon", "filename": "img-0001.png" },
    { "id": "aud-0001", "type": "audio", "source": "Goodnight Moon", "reader": "Uncle Ryan", "filename": "aud-0001.mp3" }
  ]
}
```

Ids are issued by scanning the array for the highest existing prefix-typed id and incrementing. No id is ever reused.

### `titles/<id>/title.json`

```json
{ "id": "goodnight-moon", "displayName": "Goodnight Moon", "cover": "cover.png" }
```

### `readings/<id>/reading.json`

```json
{
  "id": "rdg-0001",
  "titleId": "goodnight-moon",
  "reader": "Uncle Ryan",
  "pages": [
    { "image": "img-0001", "audio": "aud-0001" },
    { "image": "img-0002", "audio": "aud-0002" }
  ]
}
```

Reading ids are sequential with a `rdg-` prefix.

## Runtime app changes

The user-visible flow is unchanged: picker → reader picker → book screen.

Internals:

- `BookRegistry.ts` is regenerated from `library.json` + each `titles/<id>/title.json` + each `readings/<id>/reading.json`. Output shape changes to expose title-groups and the readings that belong to each.
- `BookProvider` exposes the list of title-groups and, given a selected title-group, the list of readings bound to it (each labeled by `reader`).
- Selecting a reading hydrates a flat `pages` array of `{ image: require(...), audio: require(...) }` resolved through the asset library.
- `BookScreen`, `BookPage`, `BookGestureSurface` are unchanged — they already consume a flat pages array.

`scripts/book-register.js` is rewritten to walk the new layout. Its output remains a single `src/books/BookRegistry.ts`.

The existing scripts (`book-page.sh`, `book-voice.sh`, `book-cover.sh`) keep their ffmpeg pipelines but get retargeted: `book-page.sh` writes to `assets/library/images/`, `book-voice.sh` writes to `assets/library/audio/`, both update `library.json`. `book-cover.sh` writes to `assets/titles/<id>/cover.png` and updates `title.json`.

## Book-tool UI

Three top-level tabs replace today's single books list:

### 1. Library

A flat list of assets. Above the list, three filter controls:

- **Source** dropdown — distinct list of `source` strings, plus "All".
- **Reader** dropdown — distinct list of `reader` strings on audio assets, plus "All". Disabled when the type filter is set to "Image".
- **Type** toggle — All / Image / Audio.

Each row shows a thumbnail (image) or play button (audio), id, source, reader (if audio), and a delete button.

Two upload buttons above the filters: **Upload images** and **Upload audio**.

**Image upload flow:**
1. User drops or selects 1..N image files.
2. Prompt asks for `source` (autocomplete from existing distinct sources). Required.
3. Server runs each file through `book-page.sh`'s ffmpeg pipeline, assigns sequential `img-NNNN` ids, appends to `library.json`.
4. SSE progress overlay (existing pattern).

Asset order at upload has no semantic meaning. Page order is set in the reading editor.

**Audio upload flow:**
1. User drops or selects 1..N audio files.
2. Prompt asks for `source` (autocomplete) and `reader` (autocomplete). Both required.
3. Optional checkbox: **Keep tail** — when set, the pipeline runs with `--keep-tail`.
4. Server runs each file through `book-voice.sh`'s pipeline, assigns sequential `aud-NNNN` ids, appends to `library.json`.

**Delete asset:** if any reading references the asset, the request is rejected with a list of the offending readings.

### 2. Titles

List of title-groups. Each card shows the cover (or a placeholder), displayName, and the count of readings bound to it.

**Create:** displayName (required) and optional cover image. Cover image is run through `book-cover.sh` to produce the 512×512 thumbnail.

**Edit:** rename (changes displayName, id is immutable) and replace cover.

**Delete:** blocked while any reading is bound. Error names the readings.

### 3. Readings

List of readings, grouped by title-group displayName. Each row shows reader name, page count, and edit/delete/preview buttons.

**Create / edit a reading:**

A single-column editor. Header: title-group picker (dropdown of existing titles, required) and reader name (free text, required).

Body: a list of page rows. Each row contains:

- An image picker (dropdown of library images filtered to `source` = the title-group's `displayName` by default; user can change the filter)
- An audio picker (dropdown filtered to `source` = title-group displayName AND `reader` = reading.reader by default)
- Up / down arrows
- Delete-row button

Below the rows: **Add page** button — appends a blank row.

Save validates that every row has both an image and an audio asset, and that asset ids resolve.

**Preview:** uses the existing `PreviewOverlay`, fed the reading's flat pages array.

**Delete reading:** removes the `readings/<id>/` folder. Does not touch library assets.

## Filter defaults — the flagged open question

When the reading editor opens, the image picker defaults to `source = titleGroup.displayName` and the audio picker defaults to the same `source` plus `reader = reading.reader`. The user can clear or change the filters if they want to pull an asset uploaded under a different source string.

If the user routinely uploads under a slightly different source string than the title-group's displayName, the default filter will return an empty list. The user can fix this either by clearing the filter or by re-uploading under the matching source. Not blocking; flagged for follow-up.

## Errors and edge cases

- Assets can't be deleted if referenced by any reading. The server returns `409 { error, referencedBy: [readingIds] }`.
- Title-groups can't be deleted while any reading is bound. Same 409 shape.
- Reading save fails with `400` if any page row references a missing asset id or has a null image/audio.
- Image upload rejects non-image MIME types; audio upload rejects non-audio MIME types.
- Empty `source` or `reader` is rejected at the API layer with `400`.
- A reading with zero pages is allowed (the app loops/ends immediately). The book-tool surfaces a warning but does not block save.
- Concurrent writes to `library.json`, `title.json`, and `reading.json` are serialized through the existing `withBookLock` mutex pattern (extended: `withLibraryLock`, `withTitleLock(id)`, `withReadingLock(id)`).

## Testing

**Server:**
- CRUD + integrity tests for library, titles, readings routes.
- Reference-integrity tests (cannot delete referenced assets/titles, cannot save a reading with invalid asset ids).
- Concurrent write safety via the lock helpers.

**Registry generator:**
- Tests against a fixture library + titles + readings tree, asserting the generated TS structure.

**Runtime app:**
- Existing book-mode tests updated to consume the new BookRegistry shape.
- New unit test: selecting a title-group lists its readings; selecting a reading yields the expected pages array.

## Migration

None. Greenfield. As part of the implementation:

1. Delete `assets/books/`.
2. Delete the old `src/books/BookRegistry.ts` and rewrite from the new layout (initially empty).
3. Delete `scripts/book-page.sh`'s old path logic and retarget to the new library paths. Same for `book-voice.sh` and `book-cover.sh`.
4. Delete the book-tool's `books.ts` / `readers.ts` / `pages.ts` routes and the `Add Book Wizard` / `Edit Book` screens. They are replaced by the library / titles / readings routes and screens.

## Scope summary

**In for v1:**
- Greenfield deletion of the old layout
- Library asset CRUD with source + reader metadata, batch upload, ffmpeg pipelines
- Title-group CRUD with optional cover
- Reading CRUD with single-column row editor and up/down reordering
- Preview overlay against a reading
- Runtime `BookRegistry` regen from the new layout
- Reference-integrity enforcement on delete and on reading save

**Deferred:**
- Drag-and-drop reordering
- Cross-title asset reuse (currently possible by clearing the source filter, but no first-class UI)
- Bulk delete
- Editing an asset's source/reader after upload
- Source-string normalization / autocomplete-of-title-displayNames merge
