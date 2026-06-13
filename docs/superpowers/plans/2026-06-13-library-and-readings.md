# Library and Readings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared-page book model with a flat asset library, title-groups, and per-reader independent readings.

**Architecture:** Three decoupled concepts on disk: assets (image/audio in a flat library, indexed by `library.json`), title-groups (one folder per real-world title with `title.json` + optional cover), readings (one folder per reading with `reading.json` referencing asset ids by `image+audio` pairs in playback order). The book-tool exposes them via three tabs (Library / Titles / Readings) with a drag-and-drop page editor. The runtime app's user-visible flow (title → reader → book screen) is unchanged.

**Tech Stack:** Express 4 + multer + tsx (server), Vite 5 + React 18 + @dnd-kit/sortable (client), Jest + ts-jest (tests), bash + ffmpeg (asset pipelines), Expo SDK 56 + AsyncStorage (runtime app, unchanged).

**Spec:** `docs/superpowers/specs/2026-06-13-library-and-readings-design.md`

---

## Conventions used throughout this plan

- All paths are repo-root-relative unless absolute.
- Repo root: `C:\Users\Ryank\Desktop\Vibe Coding\AvieBaby`.
- Server tests live in `tools/book-import/server/__tests__/`.
- Each storage module returns plain objects, throws on integrity failures.
- All Express route handlers `try/catch` and forward errors via `next(err)`; the server has a generic error middleware that maps `BadRequest` → 400, `Conflict` → 409, `NotFound` → 404.
- All file writes go through atomic write (write to `*.tmp` then `fs.rename`) to avoid torn JSON.
- Asset ids: `img-NNNN` and `aud-NNNN`, zero-padded to 4 digits.
- Reading ids: `rdg-NNNN`.
- Title ids: slugified displayName (lowercase, spaces→`-`, drop non `[a-z0-9-]`).

---

## Phase plan

- **Phase 1** (Tasks 1–2): Greenfield, scaffolding, install dnd-kit
- **Phase 2** (Tasks 3–7): Server types, storage modules, locks
- **Phase 3** (Tasks 8–11): Server HTTP routes, wire them
- **Phase 4** (Tasks 12–14): Asset pipeline scripts retargeting
- **Phase 5** (Tasks 15–16): Generator + runtime app
- **Phase 6** (Tasks 17–23): Book-tool client (api, app, three tabs, editor)
- **Phase 7** (Tasks 24–25): Smoke test, final review

---

## Phase 1 — Foundation and greenfield

### Task 1: Greenfield cleanup and new directory scaffolding

**Files:**
- Delete: `assets/books/` (entire directory)
- Delete: `tools/book-import/server/routes/books.ts`
- Delete: `tools/book-import/server/routes/readers.ts`
- Delete: `tools/book-import/server/routes/pages.ts`
- Delete: `tools/book-import/server/registry.ts`
- Delete: `tools/book-import/client/screens/AddBookWizard.tsx`
- Delete: `tools/book-import/client/screens/EditBook.tsx`
- Delete: `tools/book-import/client/screens/BookList.tsx`
- Create: `assets/library/images/.gitkeep`
- Create: `assets/library/audio/.gitkeep`
- Create: `assets/library/library.json` with `{"assets": []}`
- Create: `assets/titles/.gitkeep`
- Create: `assets/readings/.gitkeep`
- Modify: `tools/book-import/server/index.ts` — remove imports of deleted route factories, leave health route + SSE only
- Modify: `src/books/BookRegistry.ts` — replace with empty stub (see Step 4)
- Modify: `src/books/types.ts` — replace with new types (see Step 5)
- Modify: `src/books/BookProvider.tsx` — adapt to new registry shape (full rewrite later in Task 16; for now make it compile against new types with a TODO stub)

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: clean tree on `feat/book-mode-v1`. If anything is pending, commit it first.

- [ ] **Step 2: Delete old asset directory and old route/screen files**

```bash
rm -rf assets/books
rm tools/book-import/server/routes/books.ts
rm tools/book-import/server/routes/readers.ts
rm tools/book-import/server/routes/pages.ts
rm tools/book-import/server/registry.ts
rm tools/book-import/client/screens/AddBookWizard.tsx
rm tools/book-import/client/screens/EditBook.tsx
rm tools/book-import/client/screens/BookList.tsx
```

- [ ] **Step 3: Create new directory scaffolding**

```bash
mkdir -p assets/library/images assets/library/audio assets/titles assets/readings
touch assets/library/images/.gitkeep assets/library/audio/.gitkeep assets/titles/.gitkeep assets/readings/.gitkeep
printf '{"assets": []}\n' > assets/library/library.json
```

- [ ] **Step 4: Replace `src/books/BookRegistry.ts` with an empty stub**

Write `src/books/BookRegistry.ts`:

```ts
import type { BookRegistry } from './types';

export const REGISTRY: BookRegistry = {
  titles: [],
  readingsByTitleId: {},
  assets: {},
};

export function validateRegistry(): string[] {
  const errors: string[] = [];
  for (const reading of Object.values(REGISTRY.readingsByTitleId).flat()) {
    if (!REGISTRY.titles.find((t) => t.id === reading.titleId)) {
      errors.push(`Reading ${reading.id} references missing title ${reading.titleId}`);
    }
    for (const page of reading.pages) {
      if (!REGISTRY.assets[page.image]) {
        errors.push(`Reading ${reading.id} page references missing image ${page.image}`);
      }
      if (!REGISTRY.assets[page.audio]) {
        errors.push(`Reading ${reading.id} page references missing audio ${page.audio}`);
      }
    }
  }
  return errors;
}
```

- [ ] **Step 5: Replace `src/books/types.ts` with new types**

Write `src/books/types.ts`:

```ts
export interface TitleGroup {
  id: string;
  displayName: string;
  cover?: number;
}

export interface ReadingPage {
  image: string;
  audio: string;
}

export interface Reading {
  id: string;
  titleId: string;
  reader: string;
  pages: ReadingPage[];
}

export interface BookRegistry {
  titles: TitleGroup[];
  readingsByTitleId: Record<string, Reading[]>;
  assets: Record<string, number>;
}
```

Note: `cover` and asset values are `require()`-result numbers — the Metro bundler converts `require('../../assets/...')` calls into integer module ids during the registry generator's output.

- [ ] **Step 6: Adapt `src/books/BookProvider.tsx` to compile against new types (stub)**

Replace the body of `src/books/BookProvider.tsx` with:

```tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import { REGISTRY } from './BookRegistry';
import type { TitleGroup, Reading } from './types';

interface BookContext {
  titles: TitleGroup[];
  readingsForTitle: (titleId: string) => Reading[];
  selectedReading: Reading | null;
  selectReading: (r: Reading | null) => void;
  pageIndex: number;
  goToNext: () => void;
  goToPrev: () => void;
}

const Ctx = createContext<BookContext | null>(null);

export const BookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const value = useMemo<BookContext>(
    () => ({
      titles: REGISTRY.titles,
      readingsForTitle: (titleId) => REGISTRY.readingsByTitleId[titleId] ?? [],
      selectedReading,
      selectReading: (r) => {
        setSelectedReading(r);
        setPageIndex(0);
      },
      pageIndex,
      goToNext: () => {
        if (!selectedReading) return;
        setPageIndex((i) => (i + 1) % selectedReading.pages.length);
      },
      goToPrev: () => {
        if (!selectedReading) return;
        setPageIndex((i) => (i - 1 + selectedReading.pages.length) % selectedReading.pages.length);
      },
    }),
    [selectedReading, pageIndex],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useBooks(): BookContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBooks must be used inside BookProvider');
  return ctx;
}
```

- [ ] **Step 7: Trim `tools/book-import/server/index.ts` to compile without old routes**

Edit the imports and route mounts. New file content:

```ts
import express from 'express';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getJob } from './jobs.js';
import type { PipelineEvent } from './pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const PORT = Number(process.env.PORT || 5174);
const HOST = '127.0.0.1';

const app = express();
app.use(express.json());

app.use('/assets/library', express.static(path.join(REPO_ROOT, 'assets', 'library')));
app.use('/assets/titles', express.static(path.join(REPO_ROOT, 'assets', 'titles')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, repoRoot: REPO_ROOT });
});

app.get('/api/jobs/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let finishedDuringReplay = false;
  for (const event of job.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.step === 'done') finishedDuringReplay = true;
  }
  if (finishedDuringReplay) {
    res.end();
    return;
  }

  const onEvent = (event: PipelineEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.step === 'done') {
      res.end();
    }
  };

  job.emitter.on('event', onEvent);
  req.on('close', () => {
    job.emitter.off('event', onEvent);
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Book import server listening on http://${HOST}:${PORT}`);
});
```

- [ ] **Step 8: Delete obsolete tests**

```bash
rm -f tools/book-import/server/__tests__/routes-books.test.ts
rm -f tools/book-import/server/__tests__/routes-readers.test.ts
rm -f tools/book-import/server/__tests__/routes-pages.test.ts
rm -f tools/book-import/server/__tests__/registry.test.ts
rm -f tools/book-import/server/__tests__/validation.test.ts
```

(Keep `jobs.test.ts`, `pipeline.test.ts`, `locks.test.ts` if present — we'll update lock tests in Task 7.)

- [ ] **Step 9: Replace `tools/book-import/client/main.tsx` rendering until App is rewritten**

Open `tools/book-import/client/App.tsx` and replace its body with a temporary placeholder so the client still builds:

```tsx
import React from 'react';
export const App: React.FC = () => <div style={{ padding: 24 }}>Book tool rewrite in progress…</div>;
```

- [ ] **Step 10: Run typecheck and tests**

Run: `npm run typecheck` in repo root.
Expected: PASS.

Run: `npm test` in repo root.
Expected: 34 main-app tests pass (no book-tool changes have moved yet).

Run: `cd tools/book-import && npm run typecheck`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: greenfield delete of old book layout

Deletes assets/books/, the books/readers/pages routes and screens, the
old in-app registry, and the test book. Scaffolds new directory layout
(assets/library/{images,audio}, assets/titles/, assets/readings/) and
replaces src/books/{types,BookRegistry,BookProvider}.tsx with stubs
sized for the new model.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add @dnd-kit dependencies

**Files:**
- Modify: `tools/book-import/package.json`

- [ ] **Step 1: Install dnd-kit packages**

Run:
```bash
cd tools/book-import && npm install @dnd-kit/core@^6.1.0 @dnd-kit/sortable@^8.0.0 @dnd-kit/utilities@^3.2.2
```

- [ ] **Step 2: Verify install**

Run: `cd tools/book-import && npm ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: three packages listed with no `UNMET DEPENDENCY` lines.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/package.json tools/book-import/package-lock.json
git commit -m "$(cat <<'EOF'
deps(book-tool): add @dnd-kit for reading-editor drag and drop

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Server data layer

### Task 3: Shared server types

**Files:**
- Create: `tools/book-import/server/types.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
export type AssetType = 'image' | 'audio';

export interface ImageAsset {
  id: string;
  type: 'image';
  source: string;
  filename: string;
}

export interface AudioAsset {
  id: string;
  type: 'audio';
  source: string;
  reader: string;
  filename: string;
}

export type Asset = ImageAsset | AudioAsset;

export interface LibraryFile {
  assets: Asset[];
}

export interface TitleGroup {
  id: string;
  displayName: string;
  cover?: string;
}

export interface ReadingPage {
  image: string;
  audio: string;
}

export interface Reading {
  id: string;
  titleId: string;
  reader: string;
  pages: ReadingPage[];
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd tools/book-import && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/server/types.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): server-side shared types for new model

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Library storage module

**Files:**
- Create: `tools/book-import/server/library.ts`
- Create: `tools/book-import/server/__tests__/library.test.ts`
- Modify: `tools/book-import/server/validation.ts` (add `validateAssetSource`, `validateReader`)

- [ ] **Step 1: Write failing tests**

`tools/book-import/server/__tests__/library.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadLibrary,
  addImageAsset,
  addAudioAsset,
  deleteAsset,
  AssetNotFoundError,
  AssetInUseError,
} from '../library.js';

function setupRepo(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-lib-'));
  const libDir = path.join(repo, 'assets', 'library');
  const imagesDir = path.join(libDir, 'images');
  const audioDir = path.join(libDir, 'audio');
  require('fs').mkdirSync(imagesDir, { recursive: true });
  require('fs').mkdirSync(audioDir, { recursive: true });
  writeFileSync(path.join(libDir, 'library.json'), JSON.stringify({ assets: [] }));
  return repo;
}

describe('library storage', () => {
  let repo: string;
  beforeEach(() => { repo = setupRepo(); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('loadLibrary returns empty assets initially', () => {
    expect(loadLibrary(repo)).toEqual({ assets: [] });
  });

  test('addImageAsset assigns padded id, writes file, returns asset', async () => {
    const srcFile = path.join(repo, 'tmp-in.png');
    writeFileSync(srcFile, 'PNGDATA');
    const asset = await addImageAsset(repo, 'Goodnight Moon', srcFile);
    expect(asset.id).toBe('img-0001');
    expect(asset.type).toBe('image');
    expect(asset.source).toBe('Goodnight Moon');
    expect(existsSync(path.join(repo, 'assets/library/images', asset.filename))).toBe(true);
    expect(loadLibrary(repo).assets).toHaveLength(1);
  });

  test('addImageAsset increments id sequentially', async () => {
    const f = path.join(repo, 'in.png'); writeFileSync(f, '1');
    const a = await addImageAsset(repo, 'Book', f);
    writeFileSync(f, '2');
    const b = await addImageAsset(repo, 'Book', f);
    expect(a.id).toBe('img-0001');
    expect(b.id).toBe('img-0002');
  });

  test('addAudioAsset requires reader', async () => {
    const f = path.join(repo, 'in.mp3'); writeFileSync(f, '1');
    const asset = await addAudioAsset(repo, 'Book', 'Uncle Ryan', f);
    expect(asset.id).toBe('aud-0001');
    expect(asset.type).toBe('audio');
    expect(asset.reader).toBe('Uncle Ryan');
  });

  test('deleteAsset removes file and entry', async () => {
    const f = path.join(repo, 'in.png'); writeFileSync(f, '1');
    const asset = await addImageAsset(repo, 'Book', f);
    await deleteAsset(repo, asset.id, () => []);
    expect(loadLibrary(repo).assets).toHaveLength(0);
    expect(existsSync(path.join(repo, 'assets/library/images', asset.filename))).toBe(false);
  });

  test('deleteAsset throws AssetInUseError when reference checker returns readings', async () => {
    const f = path.join(repo, 'in.png'); writeFileSync(f, '1');
    const asset = await addImageAsset(repo, 'Book', f);
    await expect(
      deleteAsset(repo, asset.id, (id) => [{ readingId: 'rdg-0001', titleId: 't' }]),
    ).rejects.toThrow(AssetInUseError);
  });

  test('deleteAsset throws AssetNotFoundError for unknown id', async () => {
    await expect(deleteAsset(repo, 'img-9999', () => [])).rejects.toThrow(AssetNotFoundError);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd tools/book-import && npx jest library --no-coverage`
Expected: FAIL — `Cannot find module '../library.js'`.

- [ ] **Step 3: Implement `library.ts`**

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Asset, ImageAsset, AudioAsset, LibraryFile } from './types.js';

export class AssetNotFoundError extends Error {}
export class AssetInUseError extends Error {
  constructor(public readonly references: Array<{ readingId: string; titleId: string }>) {
    super(`Asset is referenced by ${references.length} reading(s)`);
  }
}

const LIBRARY_JSON = (repoRoot: string) => path.join(repoRoot, 'assets', 'library', 'library.json');
const IMAGES_DIR = (repoRoot: string) => path.join(repoRoot, 'assets', 'library', 'images');
const AUDIO_DIR = (repoRoot: string) => path.join(repoRoot, 'assets', 'library', 'audio');

export function loadLibrary(repoRoot: string): LibraryFile {
  const raw = fs.readFileSync(LIBRARY_JSON(repoRoot), 'utf8');
  return JSON.parse(raw) as LibraryFile;
}

function writeLibraryAtomic(repoRoot: string, lib: LibraryFile): void {
  const target = LIBRARY_JSON(repoRoot);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(lib, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

function nextId(lib: LibraryFile, prefix: 'img' | 'aud'): string {
  const matching = lib.assets.filter((a) => a.id.startsWith(`${prefix}-`));
  let max = 0;
  for (const a of matching) {
    const n = Number(a.id.slice(prefix.length + 1));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

export async function addImageAsset(
  repoRoot: string,
  source: string,
  sourceFilePath: string,
): Promise<ImageAsset> {
  const lib = loadLibrary(repoRoot);
  const id = nextId(lib, 'img');
  const filename = `${id}.png`;
  fs.mkdirSync(IMAGES_DIR(repoRoot), { recursive: true });
  fs.copyFileSync(sourceFilePath, path.join(IMAGES_DIR(repoRoot), filename));
  const asset: ImageAsset = { id, type: 'image', source, filename };
  lib.assets.push(asset);
  writeLibraryAtomic(repoRoot, lib);
  return asset;
}

export async function addAudioAsset(
  repoRoot: string,
  source: string,
  reader: string,
  sourceFilePath: string,
): Promise<AudioAsset> {
  const lib = loadLibrary(repoRoot);
  const id = nextId(lib, 'aud');
  const filename = `${id}.mp3`;
  fs.mkdirSync(AUDIO_DIR(repoRoot), { recursive: true });
  fs.copyFileSync(sourceFilePath, path.join(AUDIO_DIR(repoRoot), filename));
  const asset: AudioAsset = { id, type: 'audio', source, reader, filename };
  lib.assets.push(asset);
  writeLibraryAtomic(repoRoot, lib);
  return asset;
}

export async function deleteAsset(
  repoRoot: string,
  id: string,
  referenceChecker: (assetId: string) => Array<{ readingId: string; titleId: string }>,
): Promise<void> {
  const lib = loadLibrary(repoRoot);
  const idx = lib.assets.findIndex((a) => a.id === id);
  if (idx === -1) throw new AssetNotFoundError(`No asset with id ${id}`);
  const refs = referenceChecker(id);
  if (refs.length > 0) throw new AssetInUseError(refs);
  const asset = lib.assets[idx];
  const dir = asset.type === 'image' ? IMAGES_DIR(repoRoot) : AUDIO_DIR(repoRoot);
  const filePath = path.join(dir, asset.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  lib.assets.splice(idx, 1);
  writeLibraryAtomic(repoRoot, lib);
}

export function findAsset(lib: LibraryFile, id: string): Asset | null {
  return lib.assets.find((a) => a.id === id) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/book-import && npx jest library --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/book-import/server/library.ts tools/book-import/server/__tests__/library.test.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): library storage with sequential id allocation

Add/delete asset operations, atomic library.json writes, reference
checker hook (deleteAsset rejects when the caller's checker returns
any readings).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Title-group storage module

**Files:**
- Create: `tools/book-import/server/titles.ts`
- Create: `tools/book-import/server/__tests__/titles.test.ts`

- [ ] **Step 1: Write failing tests**

`tools/book-import/server/__tests__/titles.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  slugify, loadTitles, loadTitle, createTitle, renameTitle, setTitleCover,
  deleteTitle, TitleNotFoundError, TitleInUseError, TitleIdConflictError,
} from '../titles.js';

function setupRepo(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-titles-'));
  mkdirSync(path.join(repo, 'assets', 'titles'), { recursive: true });
  return repo;
}

describe('title storage', () => {
  let repo: string;
  beforeEach(() => { repo = setupRepo(); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('slugify lowercases, dashes spaces, drops punctuation', () => {
    expect(slugify('Goodnight Moon')).toBe('goodnight-moon');
    expect(slugify("Brown Bear, Brown Bear")).toBe('brown-bear-brown-bear');
    expect(slugify('  Hello World!  ')).toBe('hello-world');
  });

  test('createTitle writes title.json and returns the title', async () => {
    const t = await createTitle(repo, 'Goodnight Moon');
    expect(t.id).toBe('goodnight-moon');
    expect(t.displayName).toBe('Goodnight Moon');
    expect(existsSync(path.join(repo, 'assets/titles', t.id, 'title.json'))).toBe(true);
  });

  test('createTitle throws TitleIdConflictError on duplicate slug', async () => {
    await createTitle(repo, 'Goodnight Moon');
    await expect(createTitle(repo, 'Goodnight Moon')).rejects.toThrow(TitleIdConflictError);
  });

  test('loadTitles returns all created titles', async () => {
    await createTitle(repo, 'A');
    await createTitle(repo, 'B');
    expect(loadTitles(repo).map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  test('renameTitle updates displayName but not id', async () => {
    const t = await createTitle(repo, 'Original');
    const updated = await renameTitle(repo, t.id, 'New Name');
    expect(updated.id).toBe('original');
    expect(updated.displayName).toBe('New Name');
  });

  test('setTitleCover copies file and updates cover field', async () => {
    const t = await createTitle(repo, 'X');
    const src = path.join(repo, 'src-cover.png'); writeFileSync(src, 'C');
    const updated = await setTitleCover(repo, t.id, src);
    expect(updated.cover).toBe('cover.png');
    expect(existsSync(path.join(repo, 'assets/titles', t.id, 'cover.png'))).toBe(true);
  });

  test('deleteTitle removes the title-group folder', async () => {
    const t = await createTitle(repo, 'X');
    await deleteTitle(repo, t.id, () => []);
    expect(loadTitle(repo, t.id)).toBeNull();
  });

  test('deleteTitle throws TitleInUseError when checker returns readings', async () => {
    const t = await createTitle(repo, 'X');
    await expect(
      deleteTitle(repo, t.id, () => [{ readingId: 'rdg-0001', titleId: t.id }]),
    ).rejects.toThrow(TitleInUseError);
  });

  test('deleteTitle throws TitleNotFoundError for unknown id', async () => {
    await expect(deleteTitle(repo, 'nope', () => [])).rejects.toThrow(TitleNotFoundError);
  });
});
```

- [ ] **Step 2: Run tests to confirm fail**

Run: `cd tools/book-import && npx jest titles --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `titles.ts`**

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TitleGroup } from './types.js';

export class TitleNotFoundError extends Error {}
export class TitleIdConflictError extends Error {}
export class TitleInUseError extends Error {
  constructor(public readonly references: Array<{ readingId: string; titleId: string }>) {
    super(`Title is referenced by ${references.length} reading(s)`);
  }
}

const TITLES_DIR = (repoRoot: string) => path.join(repoRoot, 'assets', 'titles');
const TITLE_DIR = (repoRoot: string, id: string) => path.join(TITLES_DIR(repoRoot), id);
const TITLE_JSON = (repoRoot: string, id: string) => path.join(TITLE_DIR(repoRoot, id), 'title.json');

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function writeTitleAtomic(repoRoot: string, t: TitleGroup): void {
  const target = TITLE_JSON(repoRoot, t.id);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(t, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

export function loadTitle(repoRoot: string, id: string): TitleGroup | null {
  const p = TITLE_JSON(repoRoot, id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as TitleGroup;
}

export function loadTitles(repoRoot: string): TitleGroup[] {
  const dir = TITLES_DIR(repoRoot);
  if (!fs.existsSync(dir)) return [];
  const out: TitleGroup[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const t = loadTitle(repoRoot, entry.name);
    if (t) out.push(t);
  }
  return out;
}

export async function createTitle(repoRoot: string, displayName: string): Promise<TitleGroup> {
  const id = slugify(displayName);
  if (!id) throw new Error(`Invalid displayName: ${displayName}`);
  if (loadTitle(repoRoot, id)) {
    throw new TitleIdConflictError(`Title id "${id}" already exists`);
  }
  const t: TitleGroup = { id, displayName };
  writeTitleAtomic(repoRoot, t);
  return t;
}

export async function renameTitle(
  repoRoot: string,
  id: string,
  newDisplayName: string,
): Promise<TitleGroup> {
  const t = loadTitle(repoRoot, id);
  if (!t) throw new TitleNotFoundError(`No title ${id}`);
  t.displayName = newDisplayName;
  writeTitleAtomic(repoRoot, t);
  return t;
}

export async function setTitleCover(
  repoRoot: string,
  id: string,
  sourceFilePath: string,
): Promise<TitleGroup> {
  const t = loadTitle(repoRoot, id);
  if (!t) throw new TitleNotFoundError(`No title ${id}`);
  fs.copyFileSync(sourceFilePath, path.join(TITLE_DIR(repoRoot, id), 'cover.png'));
  t.cover = 'cover.png';
  writeTitleAtomic(repoRoot, t);
  return t;
}

export async function deleteTitle(
  repoRoot: string,
  id: string,
  referenceChecker: (titleId: string) => Array<{ readingId: string; titleId: string }>,
): Promise<void> {
  const t = loadTitle(repoRoot, id);
  if (!t) throw new TitleNotFoundError(`No title ${id}`);
  const refs = referenceChecker(id);
  if (refs.length > 0) throw new TitleInUseError(refs);
  fs.rmSync(TITLE_DIR(repoRoot, id), { recursive: true, force: true });
}
```

- [ ] **Step 4: Run tests to pass**

Run: `cd tools/book-import && npx jest titles --no-coverage`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/book-import/server/titles.ts tools/book-import/server/__tests__/titles.test.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): title-group storage with slug ids and reference checks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Reading storage module

**Files:**
- Create: `tools/book-import/server/readings.ts`
- Create: `tools/book-import/server/__tests__/readings.test.ts`

- [ ] **Step 1: Write failing tests**

`tools/book-import/server/__tests__/readings.test.ts`:

```ts
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadReadings, loadReading, createReading, updateReading, deleteReading,
  readingsReferencingAsset, readingsReferencingTitle,
  ReadingNotFoundError, ReadingValidationError,
} from '../readings.js';

function setupRepo(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-rdg-'));
  mkdirSync(path.join(repo, 'assets', 'readings'), { recursive: true });
  return repo;
}

const PAGES = [
  { image: 'img-0001', audio: 'aud-0001' },
  { image: 'img-0002', audio: 'aud-0002' },
];
const ASSET_EXISTS = (id: string) => /^(img|aud)-\d+$/.test(id);

describe('reading storage', () => {
  let repo: string;
  beforeEach(() => { repo = setupRepo(); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('createReading assigns padded id and writes reading.json', async () => {
    const r = await createReading(repo, {
      titleId: 'goodnight-moon',
      reader: 'Uncle Ryan',
      pages: PAGES,
    }, ASSET_EXISTS);
    expect(r.id).toBe('rdg-0001');
    expect(r.titleId).toBe('goodnight-moon');
    expect(r.reader).toBe('Uncle Ryan');
    expect(r.pages).toEqual(PAGES);
  });

  test('createReading rejects when a page references a missing asset', async () => {
    await expect(createReading(repo, {
      titleId: 't', reader: 'R',
      pages: [{ image: 'nope', audio: 'aud-0001' }],
    }, ASSET_EXISTS)).rejects.toThrow(ReadingValidationError);
  });

  test('createReading allows empty pages array', async () => {
    const r = await createReading(repo, { titleId: 't', reader: 'R', pages: [] }, ASSET_EXISTS);
    expect(r.pages).toEqual([]);
  });

  test('createReading increments id', async () => {
    const a = await createReading(repo, { titleId: 't', reader: 'R', pages: [] }, ASSET_EXISTS);
    const b = await createReading(repo, { titleId: 't', reader: 'R', pages: [] }, ASSET_EXISTS);
    expect(a.id).toBe('rdg-0001');
    expect(b.id).toBe('rdg-0002');
  });

  test('updateReading replaces fields', async () => {
    const r = await createReading(repo, { titleId: 't', reader: 'R', pages: [] }, ASSET_EXISTS);
    const upd = await updateReading(repo, r.id, {
      titleId: 'new-title', reader: 'Mommy', pages: PAGES,
    }, ASSET_EXISTS);
    expect(upd.id).toBe(r.id);
    expect(upd.reader).toBe('Mommy');
    expect(upd.titleId).toBe('new-title');
    expect(upd.pages).toEqual(PAGES);
  });

  test('updateReading throws on bad asset', async () => {
    const r = await createReading(repo, { titleId: 't', reader: 'R', pages: [] }, ASSET_EXISTS);
    await expect(updateReading(repo, r.id, {
      titleId: 't', reader: 'R', pages: [{ image: 'bad', audio: 'aud-0001' }],
    }, ASSET_EXISTS)).rejects.toThrow(ReadingValidationError);
  });

  test('updateReading on missing id throws', async () => {
    await expect(updateReading(repo, 'rdg-9999', {
      titleId: 't', reader: 'R', pages: [],
    }, ASSET_EXISTS)).rejects.toThrow(ReadingNotFoundError);
  });

  test('deleteReading removes folder', async () => {
    const r = await createReading(repo, { titleId: 't', reader: 'R', pages: [] }, ASSET_EXISTS);
    await deleteReading(repo, r.id);
    expect(loadReading(repo, r.id)).toBeNull();
  });

  test('readingsReferencingAsset finds matches', async () => {
    await createReading(repo, { titleId: 't', reader: 'R', pages: PAGES }, ASSET_EXISTS);
    expect(readingsReferencingAsset(repo, 'img-0001')).toHaveLength(1);
    expect(readingsReferencingAsset(repo, 'img-9999')).toHaveLength(0);
  });

  test('readingsReferencingTitle finds matches', async () => {
    await createReading(repo, { titleId: 'x', reader: 'R', pages: [] }, ASSET_EXISTS);
    expect(readingsReferencingTitle(repo, 'x')).toHaveLength(1);
    expect(readingsReferencingTitle(repo, 'y')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL (no module)**

Run: `cd tools/book-import && npx jest readings --no-coverage`

- [ ] **Step 3: Implement `readings.ts`**

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Reading, ReadingPage } from './types.js';

export class ReadingNotFoundError extends Error {}
export class ReadingValidationError extends Error {}

interface ReadingDraft {
  titleId: string;
  reader: string;
  pages: ReadingPage[];
}

const READINGS_DIR = (repoRoot: string) => path.join(repoRoot, 'assets', 'readings');
const READING_DIR = (repoRoot: string, id: string) => path.join(READINGS_DIR(repoRoot), id);
const READING_JSON = (repoRoot: string, id: string) =>
  path.join(READING_DIR(repoRoot, id), 'reading.json');

function listReadingIds(repoRoot: string): string[] {
  const dir = READINGS_DIR(repoRoot);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export function loadReading(repoRoot: string, id: string): Reading | null {
  const p = READING_JSON(repoRoot, id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as Reading;
}

export function loadReadings(repoRoot: string): Reading[] {
  return listReadingIds(repoRoot)
    .map((id) => loadReading(repoRoot, id))
    .filter((r): r is Reading => r !== null);
}

function nextReadingId(repoRoot: string): string {
  let max = 0;
  for (const id of listReadingIds(repoRoot)) {
    const m = id.match(/^rdg-(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return `rdg-${String(max + 1).padStart(4, '0')}`;
}

function validatePages(pages: ReadingPage[], assetExists: (id: string) => boolean): void {
  for (const [i, page] of pages.entries()) {
    if (!page || typeof page.image !== 'string' || typeof page.audio !== 'string') {
      throw new ReadingValidationError(`Page ${i + 1}: missing image or audio`);
    }
    if (!assetExists(page.image)) {
      throw new ReadingValidationError(`Page ${i + 1}: image asset ${page.image} not found`);
    }
    if (!assetExists(page.audio)) {
      throw new ReadingValidationError(`Page ${i + 1}: audio asset ${page.audio} not found`);
    }
  }
}

function writeReadingAtomic(repoRoot: string, r: Reading): void {
  const target = READING_JSON(repoRoot, r.id);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(r, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

export async function createReading(
  repoRoot: string,
  draft: ReadingDraft,
  assetExists: (id: string) => boolean,
): Promise<Reading> {
  if (!draft.titleId) throw new ReadingValidationError('titleId required');
  if (!draft.reader) throw new ReadingValidationError('reader required');
  validatePages(draft.pages ?? [], assetExists);
  const id = nextReadingId(repoRoot);
  const reading: Reading = { id, titleId: draft.titleId, reader: draft.reader, pages: draft.pages };
  writeReadingAtomic(repoRoot, reading);
  return reading;
}

export async function updateReading(
  repoRoot: string,
  id: string,
  draft: ReadingDraft,
  assetExists: (id: string) => boolean,
): Promise<Reading> {
  if (!loadReading(repoRoot, id)) throw new ReadingNotFoundError(`No reading ${id}`);
  if (!draft.titleId) throw new ReadingValidationError('titleId required');
  if (!draft.reader) throw new ReadingValidationError('reader required');
  validatePages(draft.pages ?? [], assetExists);
  const reading: Reading = { id, titleId: draft.titleId, reader: draft.reader, pages: draft.pages };
  writeReadingAtomic(repoRoot, reading);
  return reading;
}

export async function deleteReading(repoRoot: string, id: string): Promise<void> {
  if (!loadReading(repoRoot, id)) throw new ReadingNotFoundError(`No reading ${id}`);
  fs.rmSync(READING_DIR(repoRoot, id), { recursive: true, force: true });
}

export function readingsReferencingAsset(
  repoRoot: string,
  assetId: string,
): Array<{ readingId: string; titleId: string }> {
  return loadReadings(repoRoot)
    .filter((r) => r.pages.some((p) => p.image === assetId || p.audio === assetId))
    .map((r) => ({ readingId: r.id, titleId: r.titleId }));
}

export function readingsReferencingTitle(
  repoRoot: string,
  titleId: string,
): Array<{ readingId: string; titleId: string }> {
  return loadReadings(repoRoot)
    .filter((r) => r.titleId === titleId)
    .map((r) => ({ readingId: r.id, titleId: r.titleId }));
}
```

- [ ] **Step 4: Run tests pass**

Run: `cd tools/book-import && npx jest readings --no-coverage`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/book-import/server/readings.ts tools/book-import/server/__tests__/readings.test.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): reading storage with referential integrity checks

CRUD on readings, plus helpers to find readings referencing a given
asset or title. Validation rejects pages whose image/audio ids don't
exist in the library (the assetExists predicate is injected so tests
can supply a fake).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Per-resource lock helper

**Files:**
- Modify: `tools/book-import/server/locks.ts`
- Modify: `tools/book-import/server/__tests__/locks.test.ts` (if exists; otherwise create)

- [ ] **Step 1: Write failing tests**

Overwrite `tools/book-import/server/__tests__/locks.test.ts`:

```ts
import { withLibraryLock, withTitleLock, withReadingLock } from '../locks.js';

describe('locks', () => {
  test('withLibraryLock serializes calls', async () => {
    const order: string[] = [];
    const a = withLibraryLock(async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('a-done');
    });
    const b = withLibraryLock(async () => { order.push('b-done'); });
    await Promise.all([a, b]);
    expect(order).toEqual(['a-done', 'b-done']);
  });

  test('withTitleLock is keyed per title id', async () => {
    const order: string[] = [];
    const a = withTitleLock('x', async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('x-a');
    });
    const b = withTitleLock('y', async () => { order.push('y-b'); });
    await Promise.all([a, b]);
    expect(order).toEqual(['y-b', 'x-a']);
  });

  test('withReadingLock is keyed per reading id', async () => {
    const order: string[] = [];
    const a = withReadingLock('r1', async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('r1-done');
    });
    const b = withReadingLock('r1', async () => { order.push('r1-second'); });
    await Promise.all([a, b]);
    expect(order).toEqual(['r1-done', 'r1-second']);
  });

  test('lock releases even when fn throws', async () => {
    await expect(withLibraryLock(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const ok = await withLibraryLock(async () => 'ok');
    expect(ok).toBe('ok');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `cd tools/book-import && npx jest locks --no-coverage`

- [ ] **Step 3: Replace `locks.ts`**

```ts
const tails = new Map<string, Promise<unknown>>();

function withKeyedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  tails.set(
    key,
    next.catch(() => {}),
  );
  return next;
}

export function withLibraryLock<T>(fn: () => Promise<T>): Promise<T> {
  return withKeyedLock('library', fn);
}

export function withTitleLock<T>(titleId: string, fn: () => Promise<T>): Promise<T> {
  return withKeyedLock(`title:${titleId}`, fn);
}

export function withReadingLock<T>(readingId: string, fn: () => Promise<T>): Promise<T> {
  return withKeyedLock(`reading:${readingId}`, fn);
}
```

- [ ] **Step 4: Run tests pass**

Run: `cd tools/book-import && npx jest locks --no-coverage`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/book-import/server/locks.ts tools/book-import/server/__tests__/locks.test.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): per-resource lock helpers (library, title, reading)

Replaces the old withBookLock with three keyed helpers. Each
serializes writes against the same resource; concurrent writes
against different ids run in parallel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — HTTP routes

All route files follow the same pattern: factory function `makeXRouter(repoRoot)` returns an `express.Router`. Multer is used for multipart uploads with `memoryStorage()`; uploaded buffers get written to a temp file (`os.tmpdir()`) before being handed to the pipeline. Each writing route is wrapped in the appropriate lock. Pipeline-backed uploads run through `createJob()` and respond `202` with `{ jobId }`; clients subscribe to `/api/jobs/:jobId/events` for progress. Pure CRUD (titles, readings) responds synchronously.

### Task 8: Library routes

**Files:**
- Create: `tools/book-import/server/routes/library.ts`
- Create: `tools/book-import/server/__tests__/routes-library.test.ts`

- [ ] **Step 1: Write failing supertest tests**

`tools/book-import/server/__tests__/routes-library.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeLibraryRouter } from '../routes/library.js';

function setupApp(): { app: express.Express; repo: string } {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-routes-lib-'));
  mkdirSync(path.join(repo, 'assets', 'library', 'images'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'library', 'audio'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'readings'), { recursive: true });
  writeFileSync(path.join(repo, 'assets', 'library', 'library.json'), '{"assets":[]}');
  const app = express();
  app.use(express.json());
  app.use('/api/library', makeLibraryRouter(repo));
  return { app, repo };
}

describe('library routes', () => {
  let app: express.Express; let repo: string;
  beforeEach(() => { ({ app, repo } = setupApp()); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('GET /api/library returns empty assets list', async () => {
    const res = await request(app).get('/api/library');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ assets: [] });
  });

  test('DELETE /api/library/:id returns 404 for missing asset', async () => {
    const res = await request(app).delete('/api/library/img-9999');
    expect(res.status).toBe(404);
  });
});
```

(Upload endpoints are integration-tested manually since they shell out to ffmpeg; route tests cover the read/delete paths and 404 handling.)

- [ ] **Step 2: Run failing**

Run: `cd tools/book-import && npx jest routes-library --no-coverage`

- [ ] **Step 3: Install supertest if not already present**

Run: `cd tools/book-import && npm install --save-dev supertest @types/supertest`

- [ ] **Step 4: Implement `routes/library.ts`**

```ts
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadLibrary, addImageAsset, addAudioAsset, deleteAsset,
  AssetNotFoundError, AssetInUseError,
} from '../library.js';
import { readingsReferencingAsset } from '../readings.js';
import { withLibraryLock } from '../locks.js';
import { createJob, finishJob } from '../jobs.js';
import { runBookPage, runBookVoice, runBookRegister } from '../pipeline.js';

const upload = multer({ storage: multer.memoryStorage() });

export function makeLibraryRouter(repoRoot: string): express.Router {
  const r = express.Router();

  r.get('/', (_req, res) => {
    res.json(loadLibrary(repoRoot));
  });

  r.post(
    '/images',
    upload.array('files'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const source = String(req.body.source ?? '').trim();
        if (!source) return res.status(400).json({ error: 'source required' });
        if (files.length === 0) return res.status(400).json({ error: 'no files' });

        const job = createJob();
        res.status(202).json({ jobId: job.id });

        withLibraryLock(async () => {
          try {
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              const tmpIn = path.join(os.tmpdir(), `img-in-${Date.now()}-${i}-${f.originalname}`);
              fs.writeFileSync(tmpIn, f.buffer);
              const tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgout-'));
              await runBookPage(repoRoot, tmpIn, '__staging__', i + 1, null, job.emit);
              const stagedPath = path.join(repoRoot, 'assets', 'books', '__staging__', 'pages',
                `page-${String(i + 1).padStart(2, '0')}.png`);
              await addImageAsset(repoRoot, source, stagedPath);
              fs.rmSync(stagedPath, { force: true });
              fs.rmSync(tmpIn, { force: true });
              fs.rmSync(tmpOutDir, { recursive: true, force: true });
            }
            fs.rmSync(path.join(repoRoot, 'assets', 'books'), { recursive: true, force: true });
            await runBookRegister(repoRoot, job.emit);
            finishJob(job.id, 'succeeded');
          } catch (err) {
            job.emit({ step: 'pipeline', status: 'failed', stderr: (err as Error).message });
            finishJob(job.id, 'failed');
          }
        });
      } catch (err) {
        next(err);
      }
    },
  );

  r.post(
    '/audio',
    upload.array('files'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const source = String(req.body.source ?? '').trim();
        const reader = String(req.body.reader ?? '').trim();
        const keepTail = String(req.body.keepTail ?? 'false') === 'true';
        if (!source) return res.status(400).json({ error: 'source required' });
        if (!reader) return res.status(400).json({ error: 'reader required' });
        if (files.length === 0) return res.status(400).json({ error: 'no files' });

        const job = createJob();
        res.status(202).json({ jobId: job.id });

        withLibraryLock(async () => {
          try {
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              const tmpIn = path.join(os.tmpdir(), `aud-in-${Date.now()}-${i}-${f.originalname}`);
              fs.writeFileSync(tmpIn, f.buffer);
              await runBookVoice(
                repoRoot, tmpIn, '__staging__', '__r__', i + 1, null, keepTail, job.emit,
              );
              const stagedPath = path.join(repoRoot, 'assets', 'books', '__staging__', 'voices',
                '__r__', `page-${String(i + 1).padStart(2, '0')}.mp3`);
              await addAudioAsset(repoRoot, source, reader, stagedPath);
              fs.rmSync(stagedPath, { force: true });
              fs.rmSync(tmpIn, { force: true });
            }
            fs.rmSync(path.join(repoRoot, 'assets', 'books'), { recursive: true, force: true });
            await runBookRegister(repoRoot, job.emit);
            finishJob(job.id, 'succeeded');
          } catch (err) {
            job.emit({ step: 'pipeline', status: 'failed', stderr: (err as Error).message });
            finishJob(job.id, 'failed');
          }
        });
      } catch (err) {
        next(err);
      }
    },
  );

  r.delete('/:id', async (req, res, next) => {
    try {
      await withLibraryLock(async () => {
        await deleteAsset(repoRoot, req.params.id, (id) => readingsReferencingAsset(repoRoot, id));
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof AssetNotFoundError) return res.status(404).json({ error: err.message });
      if (err instanceof AssetInUseError)
        return res.status(409).json({ error: err.message, referencedBy: err.references });
      next(err);
    }
  });

  return r;
}
```

Note: the routes above use the legacy `book-page.sh` / `book-voice.sh` outputs via a temporary `__staging__` book directory. This bridge is removed in Task 12-13 when scripts get retargeted directly to the library; until then we keep the bridge so route work can be tested without touching scripts.

- [ ] **Step 5: Run tests pass**

Run: `cd tools/book-import && npx jest routes-library --no-coverage`
Expected: pass (read/delete coverage).

- [ ] **Step 6: Commit**

```bash
git add tools/book-import/server/routes/library.ts tools/book-import/server/__tests__/routes-library.test.ts tools/book-import/package.json tools/book-import/package-lock.json
git commit -m "$(cat <<'EOF'
feat(book-tool): library HTTP routes (list, batch upload, delete)

Read and delete are synchronous; the two batch-upload endpoints run
through createJob/SSE so clients can stream pipeline progress.
Bridges to the existing book-page.sh / book-voice.sh via a staging
book id; scripts will be retargeted directly in a later task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Title routes

**Files:**
- Create: `tools/book-import/server/routes/titles.ts`
- Create: `tools/book-import/server/__tests__/routes-titles.test.ts`

- [ ] **Step 1: Tests**

`tools/book-import/server/__tests__/routes-titles.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeTitlesRouter } from '../routes/titles.js';

function setup(): { app: express.Express; repo: string } {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-routes-titles-'));
  mkdirSync(path.join(repo, 'assets', 'titles'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'readings'), { recursive: true });
  const app = express();
  app.use(express.json());
  app.use('/api/titles', makeTitlesRouter(repo));
  return { app, repo };
}

describe('title routes', () => {
  let app: express.Express; let repo: string;
  beforeEach(() => { ({ app, repo } = setup()); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('GET /api/titles empty list', async () => {
    const res = await request(app).get('/api/titles');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ titles: [] });
  });

  test('POST /api/titles creates', async () => {
    const res = await request(app).post('/api/titles').send({ displayName: 'Goodnight Moon' });
    expect(res.status).toBe(201);
    expect(res.body.title.id).toBe('goodnight-moon');
  });

  test('POST /api/titles 400 on empty displayName', async () => {
    const res = await request(app).post('/api/titles').send({ displayName: '' });
    expect(res.status).toBe(400);
  });

  test('POST /api/titles 409 on duplicate slug', async () => {
    await request(app).post('/api/titles').send({ displayName: 'X' });
    const res = await request(app).post('/api/titles').send({ displayName: 'X' });
    expect(res.status).toBe(409);
  });

  test('PATCH /api/titles/:id renames', async () => {
    await request(app).post('/api/titles').send({ displayName: 'Original' });
    const res = await request(app).patch('/api/titles/original').send({ displayName: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title.displayName).toBe('New');
  });

  test('DELETE /api/titles/:id succeeds when no readings reference it', async () => {
    await request(app).post('/api/titles').send({ displayName: 'X' });
    const res = await request(app).delete('/api/titles/x');
    expect(res.status).toBe(200);
  });

  test('DELETE /api/titles/:id 404 unknown', async () => {
    const res = await request(app).delete('/api/titles/nope');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run failing**

Run: `cd tools/book-import && npx jest routes-titles --no-coverage`

- [ ] **Step 3: Implement `routes/titles.ts`**

```ts
import express from 'express';
import multer from 'multer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadTitles, loadTitle, createTitle, renameTitle, setTitleCover, deleteTitle,
  TitleNotFoundError, TitleIdConflictError, TitleInUseError,
} from '../titles.js';
import { readingsReferencingTitle } from '../readings.js';
import { withTitleLock } from '../locks.js';
import { runBookCover, runBookRegister } from '../pipeline.js';

const upload = multer({ storage: multer.memoryStorage() });

export function makeTitlesRouter(repoRoot: string): express.Router {
  const r = express.Router();

  r.get('/', (_req, res) => {
    res.json({ titles: loadTitles(repoRoot) });
  });

  r.get('/:id', (req, res) => {
    const t = loadTitle(repoRoot, req.params.id);
    if (!t) return res.status(404).json({ error: 'not found' });
    res.json({ title: t });
  });

  r.post('/', async (req, res, next) => {
    try {
      const displayName = String(req.body.displayName ?? '').trim();
      if (!displayName) return res.status(400).json({ error: 'displayName required' });
      const t = await createTitle(repoRoot, displayName);
      res.status(201).json({ title: t });
    } catch (err) {
      if (err instanceof TitleIdConflictError) return res.status(409).json({ error: err.message });
      next(err);
    }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const displayName = String(req.body.displayName ?? '').trim();
      if (!displayName) return res.status(400).json({ error: 'displayName required' });
      const t = await withTitleLock(req.params.id, () =>
        renameTitle(repoRoot, req.params.id, displayName),
      );
      res.json({ title: t });
    } catch (err) {
      if (err instanceof TitleNotFoundError) return res.status(404).json({ error: err.message });
      next(err);
    }
  });

  r.post('/:id/cover', upload.single('file'), async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'file required' });
      const tmpIn = path.join(os.tmpdir(), `cover-in-${Date.now()}-${file.originalname}`);
      fs.writeFileSync(tmpIn, file.buffer);
      const t = await withTitleLock(req.params.id, async () => {
        await runBookCover(repoRoot, tmpIn, req.params.id, () => {});
        const updated = await setTitleCover(
          repoRoot, req.params.id,
          path.join(repoRoot, 'assets', 'titles', req.params.id, 'cover.png'),
        );
        await runBookRegister(repoRoot, () => {});
        return updated;
      });
      fs.rmSync(tmpIn, { force: true });
      res.json({ title: t });
    } catch (err) {
      if (err instanceof TitleNotFoundError) return res.status(404).json({ error: err.message });
      next(err);
    }
  });

  r.delete('/:id', async (req, res, next) => {
    try {
      await withTitleLock(req.params.id, () =>
        deleteTitle(repoRoot, req.params.id, (id) => readingsReferencingTitle(repoRoot, id)),
      );
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof TitleNotFoundError) return res.status(404).json({ error: err.message });
      if (err instanceof TitleInUseError)
        return res.status(409).json({ error: err.message, referencedBy: err.references });
      next(err);
    }
  });

  return r;
}
```

- [ ] **Step 4: Run tests pass**

Run: `cd tools/book-import && npx jest routes-titles --no-coverage`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/book-import/server/routes/titles.ts tools/book-import/server/__tests__/routes-titles.test.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): title HTTP routes

GET list / single, POST create, PATCH rename, POST cover upload (runs
book-cover.sh), DELETE with referential integrity (409 + referencedBy).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Reading routes

**Files:**
- Create: `tools/book-import/server/routes/readings.ts`
- Create: `tools/book-import/server/__tests__/routes-readings.test.ts`

- [ ] **Step 1: Tests**

`tools/book-import/server/__tests__/routes-readings.test.ts`:

```ts
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeReadingsRouter } from '../routes/readings.js';

function setup(): { app: express.Express; repo: string } {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-routes-rdg-'));
  mkdirSync(path.join(repo, 'assets', 'readings'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'library', 'images'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'library', 'audio'), { recursive: true });
  writeFileSync(
    path.join(repo, 'assets', 'library', 'library.json'),
    JSON.stringify({
      assets: [
        { id: 'img-0001', type: 'image', source: 'X', filename: 'img-0001.png' },
        { id: 'aud-0001', type: 'audio', source: 'X', reader: 'R', filename: 'aud-0001.mp3' },
      ],
    }),
  );
  const app = express();
  app.use(express.json());
  app.use('/api/readings', makeReadingsRouter(repo));
  return { app, repo };
}

describe('reading routes', () => {
  let app: express.Express; let repo: string;
  beforeEach(() => { ({ app, repo } = setup()); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('GET /api/readings empty', async () => {
    const res = await request(app).get('/api/readings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ readings: [] });
  });

  test('POST /api/readings creates', async () => {
    const res = await request(app).post('/api/readings').send({
      titleId: 'x', reader: 'R',
      pages: [{ image: 'img-0001', audio: 'aud-0001' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.reading.id).toBe('rdg-0001');
  });

  test('POST /api/readings 400 missing fields', async () => {
    const res = await request(app).post('/api/readings').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/readings 400 invalid asset id', async () => {
    const res = await request(app).post('/api/readings').send({
      titleId: 'x', reader: 'R',
      pages: [{ image: 'img-9999', audio: 'aud-0001' }],
    });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/readings/:id replaces', async () => {
    const create = await request(app).post('/api/readings').send({
      titleId: 'x', reader: 'R', pages: [],
    });
    const id = create.body.reading.id;
    const res = await request(app).patch(`/api/readings/${id}`).send({
      titleId: 'y', reader: 'M', pages: [{ image: 'img-0001', audio: 'aud-0001' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.reading.titleId).toBe('y');
    expect(res.body.reading.pages).toHaveLength(1);
  });

  test('DELETE /api/readings/:id', async () => {
    const create = await request(app).post('/api/readings').send({
      titleId: 'x', reader: 'R', pages: [],
    });
    const id = create.body.reading.id;
    const res = await request(app).delete(`/api/readings/${id}`);
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/readings');
    expect(list.body.readings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run failing**

Run: `cd tools/book-import && npx jest routes-readings --no-coverage`

- [ ] **Step 3: Implement `routes/readings.ts`**

```ts
import express from 'express';
import {
  loadReadings, loadReading, createReading, updateReading, deleteReading,
  ReadingNotFoundError, ReadingValidationError,
} from '../readings.js';
import { loadLibrary, findAsset } from '../library.js';
import { withReadingLock } from '../locks.js';
import { runBookRegister } from '../pipeline.js';

export function makeReadingsRouter(repoRoot: string): express.Router {
  const r = express.Router();
  const assetExists = (id: string) => findAsset(loadLibrary(repoRoot), id) !== null;

  r.get('/', (_req, res) => {
    res.json({ readings: loadReadings(repoRoot) });
  });

  r.get('/:id', (req, res) => {
    const reading = loadReading(repoRoot, req.params.id);
    if (!reading) return res.status(404).json({ error: 'not found' });
    res.json({ reading });
  });

  r.post('/', async (req, res, next) => {
    try {
      const { titleId, reader, pages } = req.body ?? {};
      const reading = await createReading(
        repoRoot,
        { titleId, reader, pages: Array.isArray(pages) ? pages : [] },
        assetExists,
      );
      try { await runBookRegister(repoRoot, () => {}); } catch {}
      res.status(201).json({ reading });
    } catch (err) {
      if (err instanceof ReadingValidationError) return res.status(400).json({ error: err.message });
      next(err);
    }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const { titleId, reader, pages } = req.body ?? {};
      const reading = await withReadingLock(req.params.id, () =>
        updateReading(
          repoRoot, req.params.id,
          { titleId, reader, pages: Array.isArray(pages) ? pages : [] },
          assetExists,
        ),
      );
      try { await runBookRegister(repoRoot, () => {}); } catch {}
      res.json({ reading });
    } catch (err) {
      if (err instanceof ReadingNotFoundError) return res.status(404).json({ error: err.message });
      if (err instanceof ReadingValidationError) return res.status(400).json({ error: err.message });
      next(err);
    }
  });

  r.delete('/:id', async (req, res, next) => {
    try {
      await withReadingLock(req.params.id, () => deleteReading(repoRoot, req.params.id));
      try { await runBookRegister(repoRoot, () => {}); } catch {}
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ReadingNotFoundError) return res.status(404).json({ error: err.message });
      next(err);
    }
  });

  return r;
}
```

- [ ] **Step 4: Run tests pass**

Run: `cd tools/book-import && npx jest routes-readings --no-coverage`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/book-import/server/routes/readings.ts tools/book-import/server/__tests__/routes-readings.test.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): reading HTTP routes (CRUD with referential checks)

Each write fires book-register at the end so the in-app registry
stays in sync without the client needing a separate call.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Wire all three routers in `index.ts`

**Files:**
- Modify: `tools/book-import/server/index.ts`

- [ ] **Step 1: Add the three router mounts**

Replace lines 17–22 (the section between `const app = express();` and the static asset mounts) so the result reads:

```ts
const app = express();
app.use(express.json());

import { makeLibraryRouter } from './routes/library.js';
import { makeTitlesRouter } from './routes/titles.js';
import { makeReadingsRouter } from './routes/readings.js';

app.use('/api/library', makeLibraryRouter(REPO_ROOT));
app.use('/api/titles', makeTitlesRouter(REPO_ROOT));
app.use('/api/readings', makeReadingsRouter(REPO_ROOT));

app.use('/assets/library', express.static(path.join(REPO_ROOT, 'assets', 'library')));
app.use('/assets/titles', express.static(path.join(REPO_ROOT, 'assets', 'titles')));
```

(Move the three new `import` statements up next to the existing imports at the top of the file when you write it — they're shown inline above only for clarity. ESM requires imports at the top.)

- [ ] **Step 2: Start the dev server, hit health**

Run: `cd tools/book-import && npm run dev:server &`

Then: `curl http://127.0.0.1:5174/api/health`
Expected: `{"ok":true,"repoRoot":"..."}`

Then: `curl http://127.0.0.1:5174/api/library`
Expected: `{"assets":[]}`

Then: `curl http://127.0.0.1:5174/api/titles`
Expected: `{"titles":[]}`

Then: `curl http://127.0.0.1:5174/api/readings`
Expected: `{"readings":[]}`

Kill the server: `kill %1` (or Ctrl-C if you ran it foregrounded).

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/server/index.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): mount library/titles/readings routers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Pipeline scripts retargeting

After this phase, `runBookPage` / `runBookVoice` no longer needs the `__staging__` bridge. We update the pipeline wrappers in `pipeline.ts` accordingly.

### Task 12: Retarget `scripts/book-page.sh` to library

**Files:**
- Modify: `scripts/book-page.sh`
- Modify: `tools/book-import/server/pipeline.ts`
- Modify: `tools/book-import/server/routes/library.ts` (remove `__staging__` bridge)

- [ ] **Step 1: Replace `scripts/book-page.sh`**

```bash
#!/usr/bin/env bash
# Process a single book page image into the flat library.
#
# Usage:
#   scripts/book-page.sh <input-image> <output-path>
#
# Output: writes a 1920x1080 padded PNG to <output-path>. Caller is
# responsible for choosing the filename and updating library.json.

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/book-page.sh <input-image> <output-path>'

if [ "$#" -ne 2 ]; then
  echo "$USAGE" >&2
  exit 1
fi

INPUT="$1"
OUTPUT="$2"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg is required." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

echo "Processing '$INPUT' -> '$OUTPUT' ..."

ffmpeg -y -i "$INPUT" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#000000" \
  -update 1 -pix_fmt rgba \
  "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
echo
echo "Done. Wrote $OUTPUT ($((SIZE / 1024)) KB)."
```

- [ ] **Step 2: Update `pipeline.ts`'s `runBookPage`**

Replace `runBookPage` with:

```ts
export async function runBookPage(
  repoRoot: string,
  inputPath: string,
  outputPath: string,
  emit: PipelineEmit,
): Promise<void> {
  await runScript(repoRoot, ['scripts/book-page.sh', inputPath, outputPath], 'page', emit);
}
```

- [ ] **Step 3: Replace `__staging__` bridge in `routes/library.ts` image-upload handler**

Replace the for-loop body inside `withLibraryLock` for the `POST /images` route:

```ts
for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const tmpIn = path.join(os.tmpdir(), `img-in-${Date.now()}-${i}-${f.originalname}`);
  fs.writeFileSync(tmpIn, f.buffer);
  const lib = loadLibrary(repoRoot);
  const id = `img-${String(
    Math.max(0, ...lib.assets.filter((a) => a.id.startsWith('img-')).map((a) => Number(a.id.slice(4)))) + 1,
  ).padStart(4, '0')}`;
  const outPath = path.join(repoRoot, 'assets', 'library', 'images', `${id}.png`);
  await runBookPage(repoRoot, tmpIn, outPath, job.emit);
  lib.assets.push({ id, type: 'image', source, filename: `${id}.png` });
  fs.writeFileSync(
    path.join(repoRoot, 'assets', 'library', 'library.json'),
    JSON.stringify(lib, null, 2) + '\n',
  );
  fs.rmSync(tmpIn, { force: true });
}
await runBookRegister(repoRoot, job.emit);
finishJob(job.id, 'succeeded');
```

The id allocation duplicates logic in `library.ts` — that's deliberate so the loop assigns sequential ids in one transaction without re-reading + writing the JSON between every ffmpeg call. (Library lock guarantees no concurrent writer.)

- [ ] **Step 4: Manual integration test**

Run server, hit upload endpoint with a sample image via curl. Confirm `assets/library/images/img-0001.png` is created and `library.json` contains the new entry.

```bash
cd tools/book-import && npm run dev:server &
sleep 1
curl -X POST http://127.0.0.1:5174/api/library/images \
  -F "source=Test Book" \
  -F "files=@/path/to/sample.png"
```

Wait ~5 seconds for ffmpeg. Then:

```bash
cat ../../assets/library/library.json
ls ../../assets/library/images/
```

Expected: one img-0001 entry and one file. Kill the server.

- [ ] **Step 5: Commit**

```bash
git add scripts/book-page.sh tools/book-import/server/pipeline.ts tools/book-import/server/routes/library.ts
git commit -m "$(cat <<'EOF'
feat(scripts): retarget book-page.sh to take output path directly

Removes the legacy <book-id> <page-num> arg shape and the book.json
title stamping. Caller (route handler or human) chooses the output
path and any catalog updates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Retarget `scripts/book-voice.sh`

**Files:**
- Modify: `scripts/book-voice.sh`
- Modify: `tools/book-import/server/pipeline.ts`
- Modify: `tools/book-import/server/routes/library.ts` (audio upload)

- [ ] **Step 1: Replace `scripts/book-voice.sh`**

Strip the `<book-id> <reader-id> <page-num>` args; take input + output path. Keep `--keep-tail` flag and the ffmpeg pipeline (trim, normalize, mono mp3 @ 96k).

```bash
#!/usr/bin/env bash
# Normalize a voice recording into a mono mp3 ready for the library.
#
# Usage:
#   scripts/book-voice.sh [--keep-tail] <input-audio> <output-path>

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='Usage: scripts/book-voice.sh [--keep-tail] <input-audio> <output-path>'

KEEP_TAIL=0
POSITIONAL=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --keep-tail) KEEP_TAIL=1; shift ;;
    -h|--help) echo "$USAGE"; exit 0 ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
set -- "${POSITIONAL[@]}"

if [ "$#" -ne 2 ]; then
  echo "$USAGE" >&2; exit 1
fi

INPUT="$1"; OUTPUT="$2"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input not found: $INPUT" >&2; exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg required" >&2; exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

# silenceremove start; loudnorm; optional silenceremove end
SILREMOVE_START="silenceremove=start_periods=1:start_silence=0.05:start_threshold=-55dB"
SILREMOVE_END="silenceremove=stop_periods=-1:stop_silence=0.5:stop_threshold=-55dB"

if [ "$KEEP_TAIL" -eq 1 ]; then
  FILTER="$SILREMOVE_START,loudnorm=I=-16:LRA=11:TP=-1.5"
else
  FILTER="$SILREMOVE_START,loudnorm=I=-16:LRA=11:TP=-1.5,$SILREMOVE_END"
fi

ffmpeg -y -i "$INPUT" -af "$FILTER" -ac 1 -ar 44100 -b:a 96k -c:a libmp3lame "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT")
echo "Done. Wrote $OUTPUT ($((SIZE / 1024)) KB)."
```

- [ ] **Step 2: Update `pipeline.ts`'s `runBookVoice`**

Replace with:

```ts
export async function runBookVoice(
  repoRoot: string,
  inputPath: string,
  outputPath: string,
  keepTail: boolean,
  emit: PipelineEmit,
): Promise<void> {
  const args = ['scripts/book-voice.sh'];
  if (keepTail) args.push('--keep-tail');
  args.push(inputPath, outputPath);
  await runScript(repoRoot, args, 'voice', emit);
}
```

- [ ] **Step 3: Replace audio-upload loop in `routes/library.ts`**

Same shape as the image loop:

```ts
for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const tmpIn = path.join(os.tmpdir(), `aud-in-${Date.now()}-${i}-${f.originalname}`);
  fs.writeFileSync(tmpIn, f.buffer);
  const lib = loadLibrary(repoRoot);
  const id = `aud-${String(
    Math.max(0, ...lib.assets.filter((a) => a.id.startsWith('aud-')).map((a) => Number(a.id.slice(4)))) + 1,
  ).padStart(4, '0')}`;
  const outPath = path.join(repoRoot, 'assets', 'library', 'audio', `${id}.mp3`);
  await runBookVoice(repoRoot, tmpIn, outPath, keepTail, job.emit);
  lib.assets.push({ id, type: 'audio', source, reader, filename: `${id}.mp3` });
  fs.writeFileSync(
    path.join(repoRoot, 'assets', 'library', 'library.json'),
    JSON.stringify(lib, null, 2) + '\n',
  );
  fs.rmSync(tmpIn, { force: true });
}
await runBookRegister(repoRoot, job.emit);
finishJob(job.id, 'succeeded');
```

- [ ] **Step 4: Manual smoke (curl upload of an mp3)**

- [ ] **Step 5: Commit**

```bash
git add scripts/book-voice.sh tools/book-import/server/pipeline.ts tools/book-import/server/routes/library.ts
git commit -m "$(cat <<'EOF'
feat(scripts): retarget book-voice.sh to take output path directly

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Retarget `scripts/book-cover.sh`

**Files:**
- Modify: `scripts/book-cover.sh`
- Modify: `tools/book-import/server/pipeline.ts` (`runBookCover`)
- Modify: `tools/book-import/server/routes/titles.ts` (use output path directly)

- [ ] **Step 1: Replace `scripts/book-cover.sh`**

```bash
#!/usr/bin/env bash
# Produce a 512x512 square thumbnail for a title cover.
# Usage: scripts/book-cover.sh <input-image> <output-path>

set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -ne 2 ]; then
  echo "Usage: scripts/book-cover.sh <input-image> <output-path>" >&2; exit 1
fi

INPUT="$1"; OUTPUT="$2"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: input not found: $INPUT" >&2; exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: ffmpeg required" >&2; exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

ffmpeg -y -i "$INPUT" \
  -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" \
  -update 1 -pix_fmt rgba "$OUTPUT"

echo "Wrote $OUTPUT"
```

- [ ] **Step 2: Update `runBookCover` in `pipeline.ts`**

```ts
export async function runBookCover(
  repoRoot: string,
  inputPath: string,
  outputPath: string,
  emit: PipelineEmit,
): Promise<void> {
  await runScript(repoRoot, ['scripts/book-cover.sh', inputPath, outputPath], 'cover', emit);
}
```

- [ ] **Step 3: Update `routes/titles.ts`'s `POST /:id/cover` to pass the cover output path**

```ts
const outPath = path.join(repoRoot, 'assets', 'titles', req.params.id, 'cover.png');
await runBookCover(repoRoot, tmpIn, outPath, () => {});
const updated = await setTitleCover(repoRoot, req.params.id, outPath);
```

- [ ] **Step 4: Commit**

```bash
git add scripts/book-cover.sh tools/book-import/server/pipeline.ts tools/book-import/server/routes/titles.ts
git commit -m "$(cat <<'EOF'
feat(scripts): retarget book-cover.sh to take output path directly

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Generator and runtime app

### Task 15: Rewrite `scripts/book-register.js`

**Files:**
- Modify: `scripts/book-register.js`
- Create: `scripts/__tests__/book-register.test.js`

The generator walks `assets/library/library.json`, then `assets/titles/*/title.json`, then `assets/readings/*/reading.json`. It emits a `BookRegistry.ts` that exposes `REGISTRY: BookRegistry` matching `src/books/types.ts`.

- [ ] **Step 1: Write generator**

`scripts/book-register.js`:

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'assets', 'library');
const TITLES = path.join(ROOT, 'assets', 'titles');
const READINGS = path.join(ROOT, 'assets', 'readings');
const OUT = path.join(ROOT, 'src', 'books', 'BookRegistry.ts');

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function relAsset(repoFile) {
  // Path from BookRegistry.ts location to the file: BookRegistry is at src/books/.
  return path.relative(path.dirname(OUT), repoFile).split(path.sep).join('/');
}

function main() {
  const library = fs.existsSync(path.join(LIB, 'library.json'))
    ? readJSON(path.join(LIB, 'library.json'))
    : { assets: [] };

  const titles = listDirs(TITLES)
    .map((id) => {
      const j = path.join(TITLES, id, 'title.json');
      if (!fs.existsSync(j)) return null;
      return readJSON(j);
    })
    .filter(Boolean);

  const readings = listDirs(READINGS)
    .map((id) => {
      const j = path.join(READINGS, id, 'reading.json');
      if (!fs.existsSync(j)) return null;
      return readJSON(j);
    })
    .filter(Boolean);

  // Build asset path map (require() per asset id).
  const assetRequires = library.assets
    .map((a) => {
      const dir = a.type === 'image'
        ? path.join(LIB, 'images', a.filename)
        : path.join(LIB, 'audio', a.filename);
      return `  '${a.id}': require('${relAsset(dir)}'),`;
    })
    .join('\n');

  // Title cover requires.
  const titleEntries = titles.map((t) => {
    const cover = t.cover
      ? `require('${relAsset(path.join(TITLES, t.id, t.cover))}')`
      : 'undefined';
    return `  { id: ${JSON.stringify(t.id)}, displayName: ${JSON.stringify(t.displayName)}, cover: ${cover} },`;
  }).join('\n');

  const readingsByTitle = {};
  for (const r of readings) {
    if (!readingsByTitle[r.titleId]) readingsByTitle[r.titleId] = [];
    readingsByTitle[r.titleId].push(r);
  }
  const readingsEntries = Object.entries(readingsByTitle).map(([titleId, rs]) => {
    const body = rs.map((r) => {
      const pages = r.pages.map(
        (p) => `      { image: ${JSON.stringify(p.image)}, audio: ${JSON.stringify(p.audio)} },`,
      ).join('\n');
      return `    {
      id: ${JSON.stringify(r.id)},
      titleId: ${JSON.stringify(r.titleId)},
      reader: ${JSON.stringify(r.reader)},
      pages: [
${pages}
      ],
    },`;
    }).join('\n');
    return `  ${JSON.stringify(titleId)}: [
${body}
  ],`;
  }).join('\n');

  const out = `// Auto-generated by scripts/book-register.js. Do not edit by hand.
import type { BookRegistry } from './types';

export const REGISTRY: BookRegistry = {
  titles: [
${titleEntries}
  ],
  readingsByTitleId: {
${readingsEntries}
  },
  assets: {
${assetRequires}
  },
};

export function validateRegistry(): string[] {
  const errors: string[] = [];
  for (const reading of Object.values(REGISTRY.readingsByTitleId).flat()) {
    if (!REGISTRY.titles.find((t) => t.id === reading.titleId)) {
      errors.push(\`Reading \${reading.id} references missing title \${reading.titleId}\`);
    }
    for (const page of reading.pages) {
      if (!REGISTRY.assets[page.image]) {
        errors.push(\`Reading \${reading.id} page references missing image \${page.image}\`);
      }
      if (!REGISTRY.assets[page.audio]) {
        errors.push(\`Reading \${reading.id} page references missing audio \${page.audio}\`);
      }
    }
  }
  return errors;
}
`;

  fs.writeFileSync(OUT, out);
  console.log(`Wrote ${OUT} (${titles.length} titles, ${readings.length} readings, ${library.assets.length} assets).`);
}

main();
```

- [ ] **Step 2: Write a generator test**

`scripts/__tests__/book-register.test.js`:

```js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

describe('book-register', () => {
  test('writes BookRegistry.ts with no titles for an empty layout', () => {
    // Use a temp repo by symlinking? Simpler: run the real generator and snapshot the output.
    const out = path.join(__dirname, '..', '..', 'src', 'books', 'BookRegistry.ts');
    execFileSync('node', [path.join(__dirname, '..', 'book-register.js')]);
    const text = fs.readFileSync(out, 'utf8');
    expect(text).toContain('export const REGISTRY');
    expect(text).toContain('titles: [');
  });
});
```

- [ ] **Step 3: Run generator and verify TypeScript compiles**

Run: `node scripts/book-register.js`
Expected: prints "Wrote ... (0 titles, 0 readings, 0 assets)." for the greenfield layout.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm test`
Expected: all main-app tests pass with the new registry shape (BookProvider already updated to consume it in Task 1).

- [ ] **Step 4: Commit**

```bash
git add scripts/book-register.js scripts/__tests__/book-register.test.js src/books/BookRegistry.ts
git commit -m "$(cat <<'EOF'
feat(scripts): rewrite book-register.js to emit new BookRegistry shape

Walks assets/library + assets/titles + assets/readings and emits
src/books/BookRegistry.ts with title-groups, readings grouped by
titleId, and an asset-id -> require() map.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Runtime app: picker, BookProvider, BookScreen

**Files:**
- Modify: `src/components/AdultPanel.tsx` (book picker — show titles, then readings)
- Modify: `src/books/BookProvider.tsx` (already done in Task 1 stub; tighten)
- Modify: `src/components/BookScreen.tsx` (consume reading.pages directly)
- Modify: `src/components/BookPage.tsx` (use asset map for image/audio)
- Modify: `__tests__/book-mode.test.tsx` (or whichever covers book picker) — update to expect title-group → reading flow

This task is integration-heavy and must be verified by running the Expo app on device. The full code listing for each file would dominate this plan; instead, this task is broken into careful sub-steps that each leave the code compiling.

- [ ] **Step 1: Update `AdultPanel.tsx`'s book picker**

Find the existing "Read a book to Ava" panel section. Replace book + reader picker with a two-step state machine:

1. Show list of `REGISTRY.titles` as buttons, with title.displayName and (if present) the cover.
2. On select, show that title's readings (`REGISTRY.readingsByTitleId[id]`) as buttons labeled with `reading.reader`.
3. On select, call the existing `enterBookMode(reading)` hook.

Re-use the existing `BookProvider.selectReading(reading)` to set the active reading.

(Engineer: open the current `AdultPanel.tsx` and replace the book-picker subtree. Keep style and layout consistent. Look at the previous commits referencing "AdultPanel" for the visual tone.)

- [ ] **Step 2: Update `BookScreen.tsx` to render from `selectedReading.pages[pageIndex]`**

Replace the page resolution logic with:

```tsx
const { selectedReading, pageIndex } = useBooks();
const { REGISTRY } = require('../books/BookRegistry');
if (!selectedReading) return null;
const page = selectedReading.pages[pageIndex];
const imageSrc = REGISTRY.assets[page.image];
const audioSrc = REGISTRY.assets[page.audio];
```

(Keep the existing gesture surface, audio playback hook, and orientation wiring.)

- [ ] **Step 3: Update `BookPage.tsx` to receive `imageSrc` and `audioSrc` props**

Change the prop types from the legacy `{ pageNum, bookId, reader }` to `{ imageSrc: number; audioSrc: number; pageKey: string }`. Internally, the component already uses `expo-image` and `expo-audio` players; just wire them to the new props.

- [ ] **Step 4: Update existing book-mode tests**

Replace any references to `BOOKS[0].pages` etc. with REGISTRY-based equivalents. If tests need fixture data, create a minimal fixture (one title, one reading, one image+audio pair) in a `__tests__/fixtures/` directory and override the module mock for `src/books/BookRegistry` in those tests.

- [ ] **Step 5: Run typecheck + tests**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "$(cat <<'EOF'
feat(app): runtime picker, BookProvider, BookScreen for new registry

Picker is now title-group -> reader (= reading). BookScreen and
BookPage render directly from the reading's pages array using the
asset-id -> require() map exposed by the registry. No more
shared-pages assumption.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Book-tool client

### Task 17: Client API module

**Files:**
- Modify: `tools/book-import/client/api.ts`

- [ ] **Step 1: Replace `api.ts` with the new surface**

```ts
export interface ImageAsset {
  id: string; type: 'image'; source: string; filename: string;
}
export interface AudioAsset {
  id: string; type: 'audio'; source: string; reader: string; filename: string;
}
export type Asset = ImageAsset | AudioAsset;

export interface TitleGroup {
  id: string; displayName: string; cover?: string;
}

export interface Reading {
  id: string; titleId: string; reader: string;
  pages: Array<{ image: string; audio: string }>;
}

export interface PipelineEvent {
  step: string; status: 'started' | 'succeeded' | 'failed';
  stdout?: string; stderr?: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, body });
  }
  return res.json();
}

export async function listAssets(): Promise<Asset[]> {
  return (await json<{ assets: Asset[] }>(await fetch('/api/library'))).assets;
}

export async function uploadImages(source: string, files: File[]): Promise<string> {
  const fd = new FormData();
  fd.append('source', source);
  for (const f of files) fd.append('files', f);
  const res = await fetch('/api/library/images', { method: 'POST', body: fd });
  const { jobId } = await json<{ jobId: string }>(res);
  return jobId;
}

export async function uploadAudio(
  source: string, reader: string, keepTail: boolean, files: File[],
): Promise<string> {
  const fd = new FormData();
  fd.append('source', source);
  fd.append('reader', reader);
  fd.append('keepTail', String(keepTail));
  for (const f of files) fd.append('files', f);
  const res = await fetch('/api/library/audio', { method: 'POST', body: fd });
  const { jobId } = await json<{ jobId: string }>(res);
  return jobId;
}

export async function deleteAsset(id: string): Promise<void> {
  const res = await fetch(`/api/library/${id}`, { method: 'DELETE' });
  await json(res);
}

export async function listTitles(): Promise<TitleGroup[]> {
  return (await json<{ titles: TitleGroup[] }>(await fetch('/api/titles'))).titles;
}

export async function createTitle(displayName: string): Promise<TitleGroup> {
  const res = await fetch('/api/titles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  return (await json<{ title: TitleGroup }>(res)).title;
}

export async function renameTitle(id: string, displayName: string): Promise<TitleGroup> {
  const res = await fetch(`/api/titles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  return (await json<{ title: TitleGroup }>(res)).title;
}

export async function uploadTitleCover(id: string, file: File): Promise<TitleGroup> {
  const fd = new FormData(); fd.append('file', file);
  const res = await fetch(`/api/titles/${id}/cover`, { method: 'POST', body: fd });
  return (await json<{ title: TitleGroup }>(res)).title;
}

export async function deleteTitle(id: string): Promise<void> {
  await json(await fetch(`/api/titles/${id}`, { method: 'DELETE' }));
}

export async function listReadings(): Promise<Reading[]> {
  return (await json<{ readings: Reading[] }>(await fetch('/api/readings'))).readings;
}

export async function createReading(reading: Omit<Reading, 'id'>): Promise<Reading> {
  const res = await fetch('/api/readings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reading),
  });
  return (await json<{ reading: Reading }>(res)).reading;
}

export async function updateReading(id: string, reading: Omit<Reading, 'id'>): Promise<Reading> {
  const res = await fetch(`/api/readings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reading),
  });
  return (await json<{ reading: Reading }>(res)).reading;
}

export async function deleteReading(id: string): Promise<void> {
  await json(await fetch(`/api/readings/${id}`, { method: 'DELETE' }));
}

export function streamJob(
  jobId: string,
  onEvent: (e: PipelineEvent) => void,
  onClose: () => void,
): () => void {
  const es = new EventSource(`/api/jobs/${jobId}/events`);
  es.onmessage = (msg) => {
    try { onEvent(JSON.parse(msg.data) as PipelineEvent); } catch {}
  };
  es.onerror = () => { es.close(); onClose(); };
  return () => es.close();
}
```

- [ ] **Step 2: Typecheck**

Run: `cd tools/book-import && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/client/api.ts
git commit -m "$(cat <<'EOF'
feat(book-tool): client API surface for library/titles/readings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Book-tool App shell with tab routing

**Files:**
- Modify: `tools/book-import/client/App.tsx`

- [ ] **Step 1: Replace `App.tsx`**

```tsx
import React, { useState } from 'react';
import { Library } from './screens/Library';
import { Titles } from './screens/Titles';
import { Readings } from './screens/Readings';

type Tab = 'library' | 'titles' | 'readings';

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('library');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, color: '#111' }}>
      <h1 style={{ margin: 0 }}>AvieBaby — Books</h1>
      <nav style={{ display: 'flex', gap: 8, margin: '16px 0 24px' }}>
        {(['library', 'titles', 'readings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              background: tab === t ? '#111' : '#e5e5ea',
              color: tab === t ? '#fff' : '#111',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === 'library' && <Library />}
      {tab === 'titles' && <Titles />}
      {tab === 'readings' && <Readings />}
    </div>
  );
};
```

- [ ] **Step 2: Create placeholder screens so the import resolves**

`tools/book-import/client/screens/Library.tsx`:
```tsx
import React from 'react';
export const Library: React.FC = () => <div>Library</div>;
```

`tools/book-import/client/screens/Titles.tsx`:
```tsx
import React from 'react';
export const Titles: React.FC = () => <div>Titles</div>;
```

`tools/book-import/client/screens/Readings.tsx`:
```tsx
import React from 'react';
export const Readings: React.FC = () => <div>Readings</div>;
```

- [ ] **Step 3: Run the dev server, click each tab**

Run: `npm run book-tool` in repo root.
Expected: page loads with three tab buttons; click each, content swaps.

Kill server.

- [ ] **Step 4: Commit**

```bash
git add tools/book-import/client/App.tsx tools/book-import/client/screens/Library.tsx tools/book-import/client/screens/Titles.tsx tools/book-import/client/screens/Readings.tsx
git commit -m "$(cat <<'EOF'
feat(book-tool): App shell with three-tab routing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Library screen (list + filters)

**Files:**
- Modify: `tools/book-import/client/screens/Library.tsx`
- Create: `tools/book-import/client/components/UploadDialog.tsx`

- [ ] **Step 1: Implement Library screen**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Asset, listAssets, deleteAsset } from '../api';
import { UploadDialog } from '../components/UploadDialog';

type TypeFilter = 'all' | 'image' | 'audio';

export const Library: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [readerFilter, setReaderFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [uploadKind, setUploadKind] = useState<'image' | 'audio' | null>(null);

  const refresh = () => { listAssets().then(setAssets).catch(console.error); };
  useEffect(refresh, []);

  const sources = useMemo(() => Array.from(new Set(assets.map((a) => a.source))).sort(), [assets]);
  const readers = useMemo(() =>
    Array.from(new Set(assets.filter((a) => a.type === 'audio').map((a: any) => a.reader))).sort(),
    [assets]);

  const filtered = assets.filter((a) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (sourceFilter && a.source !== sourceFilter) return false;
    if (readerFilter && a.type === 'audio' && (a as any).reader !== readerFilter) return false;
    return true;
  });

  const onDelete = async (id: string) => {
    if (!confirm(`Delete ${id}?`)) return;
    try { await deleteAsset(id); refresh(); }
    catch (err: any) {
      if (err.status === 409) {
        const refs = err.body.referencedBy?.map((r: any) => r.readingId).join(', ');
        alert(`Cannot delete — referenced by readings: ${refs}`);
      } else alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setUploadKind('image')} style={btnPrimary}>+ Upload images</button>
        <button onClick={() => setUploadKind('audio')} style={btnPrimary}>+ Upload audio</button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <label>Source:
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Reader:
          <select
            value={readerFilter}
            onChange={(e) => setReaderFilter(e.target.value)}
            disabled={typeFilter === 'image'}
          >
            <option value="">All</option>
            {readers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Type:
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="all">All</option>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {filtered.map((a) => (
          <div key={a.id} style={card}>
            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.id}</div>
            {a.type === 'image' ? (
              <img src={`/assets/library/images/${a.filename}`} style={{ width: '100%', borderRadius: 4 }} />
            ) : (
              <audio src={`/assets/library/audio/${a.filename}`} controls style={{ width: '100%' }} />
            )}
            <div style={{ fontSize: 13 }}>Source: {a.source}</div>
            {a.type === 'audio' && <div style={{ fontSize: 13 }}>Reader: {(a as any).reader}</div>}
            <button onClick={() => onDelete(a.id)} style={btnDanger}>Delete</button>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ gridColumn: '1/-1', color: '#666' }}>No assets match.</div>}
      </div>
      {uploadKind && (
        <UploadDialog
          kind={uploadKind}
          existingSources={sources}
          existingReaders={readers}
          onClose={() => { setUploadKind(null); refresh(); }}
        />
      )}
    </div>
  );
};

const card: React.CSSProperties = {
  border: '1px solid #ddd', borderRadius: 8, padding: 12,
  display: 'flex', flexDirection: 'column', gap: 8,
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: '#0a84ff', color: 'white',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  padding: '6px 12px', background: '#ff3b30', color: 'white',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};
```

- [ ] **Step 2: Implement Upload dialog**

`tools/book-import/client/components/UploadDialog.tsx`:

```tsx
import React, { useState } from 'react';
import { uploadImages, uploadAudio, streamJob, PipelineEvent } from '../api';

interface Props {
  kind: 'image' | 'audio';
  existingSources: string[];
  existingReaders: string[];
  onClose: () => void;
}

export const UploadDialog: React.FC<Props> = ({ kind, existingSources, existingReaders, onClose }) => {
  const [source, setSource] = useState('');
  const [reader, setReader] = useState('');
  const [keepTail, setKeepTail] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) return alert('Source required');
    if (kind === 'audio' && !reader.trim()) return alert('Reader required');
    if (files.length === 0) return alert('Pick at least one file');
    setBusy(true);
    setEvents([]);
    try {
      const jobId = kind === 'image'
        ? await uploadImages(source.trim(), files)
        : await uploadAudio(source.trim(), reader.trim(), keepTail, files);
      streamJob(
        jobId,
        (ev) => setEvents((es) => [...es, ev]),
        () => { setDone(true); setBusy(false); },
      );
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
      setBusy(false);
    }
  };

  return (
    <div style={overlay} onClick={done ? onClose : undefined}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2>Upload {kind === 'image' ? 'images' : 'audio'}</h2>
        {!done ? (
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label>Source (required):<br/>
                <input
                  list="sources"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  style={{ width: '100%' }}
                />
                <datalist id="sources">
                  {existingSources.map((s) => <option key={s} value={s} />)}
                </datalist>
              </label>
            </div>
            {kind === 'audio' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label>Reader (required):<br/>
                    <input
                      list="readers"
                      value={reader}
                      onChange={(e) => setReader(e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <datalist id="readers">
                      {existingReaders.map((r) => <option key={r} value={r} />)}
                    </datalist>
                  </label>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={keepTail}
                      onChange={(e) => setKeepTail(e.target.checked)}
                    /> Keep tail (preserve soft trailing word)
                  </label>
                </div>
              </>
            )}
            <div style={{ marginBottom: 12 }}>
              <input
                type="file"
                multiple
                accept={kind === 'image' ? 'image/*' : 'audio/*'}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
            </div>
            {events.length > 0 && (
              <pre style={progressStyle}>{events.map((e) => `${e.step}: ${e.status}`).join('\n')}</pre>
            )}
          </form>
        ) : (
          <>
            <p>Done!</p>
            <pre style={progressStyle}>{events.map((e) => `${e.step}: ${e.status}`).join('\n')}</pre>
            <button onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  background: 'white', borderRadius: 12, padding: 24, minWidth: 420, maxWidth: 640,
};
const progressStyle: React.CSSProperties = {
  background: '#f4f4f4', padding: 8, borderRadius: 4, fontSize: 11,
  maxHeight: 160, overflow: 'auto', marginTop: 8,
};
```

- [ ] **Step 3: Manual smoke**

`npm run book-tool` → Library tab → "Upload images" → pick 1-2 PNGs → enter source "Test" → upload → watch progress → close. Confirm assets appear in the grid.

- [ ] **Step 4: Commit**

```bash
git add tools/book-import/client/screens/Library.tsx tools/book-import/client/components/UploadDialog.tsx
git commit -m "$(cat <<'EOF'
feat(book-tool): Library tab with batch upload and asset filters

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Titles screen

**Files:**
- Modify: `tools/book-import/client/screens/Titles.tsx`

- [ ] **Step 1: Implement**

```tsx
import React, { useEffect, useState } from 'react';
import {
  TitleGroup, listTitles, createTitle, renameTitle, uploadTitleCover, deleteTitle,
} from '../api';

export const Titles: React.FC = () => {
  const [titles, setTitles] = useState<TitleGroup[]>([]);
  const [editing, setEditing] = useState<TitleGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const refresh = () => { listTitles().then(setTitles).catch(console.error); };
  useEffect(refresh, []);

  const onDelete = async (t: TitleGroup) => {
    if (!confirm(`Delete title "${t.displayName}"?`)) return;
    try { await deleteTitle(t.id); refresh(); }
    catch (err: any) {
      if (err.status === 409) {
        const ids = err.body.referencedBy?.map((r: any) => r.readingId).join(', ');
        alert(`Cannot delete — readings still reference this title: ${ids}`);
      } else alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setCreating(true)} style={btnPrimary}>+ New title</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {titles.map((t) => (
          <div key={t.id} style={card}>
            {t.cover && <img src={`/assets/titles/${t.id}/${t.cover}`} style={{ width: '100%', borderRadius: 4 }} />}
            <div style={{ fontSize: 16, fontWeight: 600 }}>{t.displayName}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>{t.id}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setEditing(t)} style={btnSecondary}>Edit</button>
              <button onClick={() => onDelete(t)} style={btnDanger}>Delete</button>
            </div>
          </div>
        ))}
        {titles.length === 0 && <div style={{ gridColumn: '1/-1', color: '#666' }}>No titles yet.</div>}
      </div>
      {creating && <TitleEditDialog mode="create" onClose={() => { setCreating(false); refresh(); }} />}
      {editing && <TitleEditDialog mode="edit" title={editing} onClose={() => { setEditing(null); refresh(); }} />}
    </div>
  );
};

interface DialogProps {
  mode: 'create' | 'edit';
  title?: TitleGroup;
  onClose: () => void;
}

const TitleEditDialog: React.FC<DialogProps> = ({ mode, title, onClose }) => {
  const [displayName, setDisplayName] = useState(title?.displayName ?? '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return alert('Display name required');
    setBusy(true);
    try {
      let id: string;
      if (mode === 'create') {
        const t = await createTitle(displayName.trim());
        id = t.id;
      } else {
        if (displayName.trim() !== title!.displayName) {
          await renameTitle(title!.id, displayName.trim());
        }
        id = title!.id;
      }
      if (coverFile) await uploadTitleCover(id, coverFile);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'create' ? 'New title' : `Edit "${title!.displayName}"`}</h2>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>Display name:<br/>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Cover image (optional):<br/>
              <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const card: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#0a84ff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '6px 12px', background: '#e5e5ea', color: '#111', border: 'none', borderRadius: 6, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#ff3b30', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal: React.CSSProperties = { background: 'white', borderRadius: 12, padding: 24, minWidth: 420 };
```

- [ ] **Step 2: Smoke test**

Create title "Test Title", edit name, upload a cover, delete (assuming no readings).

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/client/screens/Titles.tsx
git commit -m "$(cat <<'EOF'
feat(book-tool): Titles tab with create/rename/cover/delete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: Readings screen (list + delete)

**Files:**
- Modify: `tools/book-import/client/screens/Readings.tsx`

- [ ] **Step 1: Implement**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Reading, TitleGroup, listReadings, listTitles, deleteReading,
} from '../api';
import { ReadingEditor } from './ReadingEditor';

export const Readings: React.FC = () => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [titles, setTitles] = useState<TitleGroup[]>([]);
  const [editing, setEditing] = useState<Reading | 'new' | null>(null);

  const refresh = () => {
    listReadings().then(setReadings).catch(console.error);
    listTitles().then(setTitles).catch(console.error);
  };
  useEffect(refresh, []);

  const titleById = useMemo(() => Object.fromEntries(titles.map((t) => [t.id, t])), [titles]);
  const grouped = useMemo(() => {
    const map = new Map<string, Reading[]>();
    for (const r of readings) {
      if (!map.has(r.titleId)) map.set(r.titleId, []);
      map.get(r.titleId)!.push(r);
    }
    return map;
  }, [readings]);

  const onDelete = async (r: Reading) => {
    if (!confirm(`Delete reading ${r.id} (${r.reader})?`)) return;
    try { await deleteReading(r.id); refresh(); }
    catch (err: any) { alert(`Delete failed: ${err.message}`); }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setEditing('new')} style={btnPrimary}>+ New reading</button>
      </div>
      {Array.from(grouped.entries()).map(([titleId, list]) => (
        <section key={titleId} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px' }}>{titleById[titleId]?.displayName ?? titleId}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {list.map((r) => (
              <div key={r.id} style={card}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{r.reader}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>{r.id} · {r.pages.length} pages</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEditing(r)} style={btnSecondary}>Edit</button>
                  <button onClick={() => onDelete(r)} style={btnDanger}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {readings.length === 0 && <div style={{ color: '#666' }}>No readings yet.</div>}
      {editing && (
        <ReadingEditor
          reading={editing === 'new' ? null : editing}
          onClose={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
};

const card: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#0a84ff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '6px 12px', background: '#e5e5ea', color: '#111', border: 'none', borderRadius: 6, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#ff3b30', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' };
```

- [ ] **Step 2: Stub `ReadingEditor`**

`tools/book-import/client/screens/ReadingEditor.tsx`:
```tsx
import React from 'react';
import type { Reading } from '../api';
export const ReadingEditor: React.FC<{ reading: Reading | null; onClose: () => void }> = ({ onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
    <div style={{ background: 'white', padding: 24, borderRadius: 12 }}>ReadingEditor — TODO</div>
  </div>
);
```

- [ ] **Step 3: Verify it loads (no readings yet)**

`npm run book-tool` → Readings tab → "No readings yet." → click "New reading" → placeholder modal shows.

- [ ] **Step 4: Commit**

```bash
git add tools/book-import/client/screens/Readings.tsx tools/book-import/client/screens/ReadingEditor.tsx
git commit -m "$(cat <<'EOF'
feat(book-tool): Readings tab with title-grouped list and delete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: Reading editor with drag-and-drop

**Files:**
- Modify: `tools/book-import/client/screens/ReadingEditor.tsx`

- [ ] **Step 1: Implement editor**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Reading, TitleGroup, Asset, listTitles, listAssets,
  createReading, updateReading,
} from '../api';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  reading: Reading | null;
  onClose: () => void;
}

interface Row {
  rowId: string;
  image: string;
  audio: string;
}

let rowSeq = 0;
const makeRowId = () => `row-${++rowSeq}`;

export const ReadingEditor: React.FC<Props> = ({ reading, onClose }) => {
  const isNew = !reading;
  const [titles, setTitles] = useState<TitleGroup[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [titleId, setTitleId] = useState<string>(reading?.titleId ?? '');
  const [readerName, setReaderName] = useState<string>(reading?.reader ?? '');
  const [rows, setRows] = useState<Row[]>(
    reading?.pages.map((p) => ({ rowId: makeRowId(), image: p.image, audio: p.audio })) ?? [],
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listTitles().then(setTitles).catch(console.error);
    listAssets().then(setAssets).catch(console.error);
  }, []);

  const title = titles.find((t) => t.id === titleId);

  const imageOptions = useMemo(() => assets.filter((a): a is Asset & { type: 'image' } =>
    a.type === 'image' && (!title || a.source === title.displayName),
  ), [assets, title]);
  const audioOptions = useMemo(() => assets.filter((a): a is Asset & { type: 'audio' } =>
    a.type === 'audio' && (!title || a.source === title.displayName) &&
    (!readerName || (a as any).reader === readerName),
  ), [assets, title, readerName]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRows((rs) => {
        const oldIdx = rs.findIndex((r) => r.rowId === active.id);
        const newIdx = rs.findIndex((r) => r.rowId === over.id);
        return arrayMove(rs, oldIdx, newIdx);
      });
    }
  };

  const addRow = () => setRows((rs) => [...rs, { rowId: makeRowId(), image: '', audio: '' }]);
  const updateRow = (rowId: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const removeRow = (rowId: string) => setRows((rs) => rs.filter((r) => r.rowId !== rowId));

  const onSave = async () => {
    if (!titleId) return alert('Pick a title');
    if (!readerName.trim()) return alert('Reader required');
    for (const [i, row] of rows.entries()) {
      if (!row.image || !row.audio) return alert(`Page ${i + 1} is missing an image or audio`);
    }
    setBusy(true);
    try {
      const payload = {
        titleId, reader: readerName.trim(),
        pages: rows.map((r) => ({ image: r.image, audio: r.audio })),
      };
      if (isNew) await createReading(payload);
      else await updateReading(reading!.id, payload);
      onClose();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally { setBusy(false); }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2>{isNew ? 'New reading' : `Edit reading ${reading!.id}`}</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <label style={{ flex: 1 }}>Title:<br/>
            <select value={titleId} onChange={(e) => setTitleId(e.target.value)} style={{ width: '100%' }}>
              <option value="">— pick title —</option>
              {titles.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>Reader:<br/>
            <input value={readerName} onChange={(e) => setReaderName(e.target.value)} style={{ width: '100%' }} />
          </label>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.rowId)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflow: 'auto' }}>
              {rows.map((row, idx) => (
                <SortableRow
                  key={row.rowId}
                  row={row}
                  index={idx}
                  imageOptions={imageOptions}
                  audioOptions={audioOptions}
                  onChange={(patch) => updateRow(row.rowId, patch)}
                  onRemove={() => removeRow(row.rowId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={addRow}>+ Add page</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button onClick={onSave} disabled={busy} style={{ background: '#0a84ff', color: 'white', border: 'none', padding: '6px 16px', borderRadius: 6, cursor: 'pointer' }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface RowProps {
  row: Row;
  index: number;
  imageOptions: Array<Asset & { type: 'image' }>;
  audioOptions: Array<Asset & { type: 'audio' }>;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
}

const SortableRow: React.FC<RowProps> = ({ row, index, imageOptions, audioOptions, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.rowId });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: 8,
        background: isDragging ? '#f0f4ff' : '#f8f8fa',
        borderRadius: 6,
      }}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag handle page ${index + 1}`}
        style={{ cursor: 'grab', padding: '4px 8px', background: 'transparent', border: 'none' }}
      >☰</button>
      <span style={{ minWidth: 40, fontFamily: 'monospace' }}>{index + 1}</span>
      <select value={row.image} onChange={(e) => onChange({ image: e.target.value })} style={{ flex: 1 }}>
        <option value="">— image —</option>
        {imageOptions.map((a) => <option key={a.id} value={a.id}>{a.id} ({a.source})</option>)}
      </select>
      <select value={row.audio} onChange={(e) => onChange({ audio: e.target.value })} style={{ flex: 1 }}>
        <option value="">— audio —</option>
        {audioOptions.map((a) => <option key={a.id} value={a.id}>{a.id} ({(a as any).reader})</option>)}
      </select>
      <button onClick={onRemove} style={{ background: '#ff3b30', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px' }}>×</button>
    </div>
  );
};

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal: React.CSSProperties = { background: 'white', borderRadius: 12, padding: 24, width: 'min(900px, 95vw)', maxHeight: '90vh', overflow: 'auto' };
```

- [ ] **Step 2: Smoke test**

Upload a few image and audio assets first (Library tab). Create a title. Then open Readings → "New reading" → pick title → enter reader name → add pages → assign image+audio to each → drag rows to reorder → Save. Confirm the reading appears in the Readings list and `assets/readings/rdg-0001/reading.json` exists.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/client/screens/ReadingEditor.tsx
git commit -m "$(cat <<'EOF'
feat(book-tool): Reading editor with dnd-kit drag-and-drop reorder

Single-column row editor. Each row pairs an image asset with an
audio asset (both filtered by source+reader defaults). Pages
reorder via @dnd-kit/sortable - mouse drag or keyboard arrows on
a focused handle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 23: Preview overlay against a reading

**Files:**
- Create: `tools/book-import/client/screens/PreviewOverlay.tsx` (new — old one was deleted)
- Modify: `tools/book-import/client/screens/Readings.tsx` to add Preview button on each reading card

- [ ] **Step 1: Implement PreviewOverlay**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import type { Reading, Asset } from '../api';
import { listAssets } from '../api';

interface Props {
  reading: Reading;
  onClose: () => void;
}

export const PreviewOverlay: React.FC<Props> = ({ reading, onClose }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => { listAssets().then(setAssets).catch(console.error); }, []);

  const page = reading.pages[pageIndex];
  if (!page) return (
    <div style={overlay} onClick={onClose}>
      <div style={modal}>Reading has no pages.</div>
    </div>
  );

  const image = assets.find((a) => a.id === page.image);
  const audio = assets.find((a) => a.id === page.audio);

  const onTap = () => {
    setPageIndex((i) => (i + 1) % reading.pages.length);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>{reading.reader} — page {pageIndex + 1} of {reading.pages.length}</strong>
          <button onClick={onClose}>Close</button>
        </div>
        {image && (
          <img
            src={`/assets/library/images/${(image as any).filename}`}
            style={{ width: '100%', borderRadius: 8, cursor: 'pointer' }}
            onClick={onTap}
          />
        )}
        {audio && (
          <audio
            ref={audioRef}
            src={`/assets/library/audio/${(audio as any).filename}`}
            autoPlay
            controls
            style={{ width: '100%', marginTop: 12 }}
          />
        )}
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal: React.CSSProperties = { background: 'white', borderRadius: 12, padding: 24, width: 'min(900px, 95vw)', maxHeight: '90vh', overflow: 'auto' };
```

- [ ] **Step 2: Wire Preview button in `Readings.tsx`**

Add to the card button row:
```tsx
<button onClick={() => setPreviewing(r)} style={btnSecondary}>Preview</button>
```

Add state and rendering:
```tsx
const [previewing, setPreviewing] = useState<Reading | null>(null);
// ... at the bottom of the return JSX:
{previewing && <PreviewOverlay reading={previewing} onClose={() => setPreviewing(null)} />}
```

Import:
```tsx
import { PreviewOverlay } from './PreviewOverlay';
```

- [ ] **Step 3: Smoke test**

Create a reading with at least 2 pages, click Preview, tap image to advance, confirm audio plays.

- [ ] **Step 4: Commit**

```bash
git add tools/book-import/client/screens/PreviewOverlay.tsx tools/book-import/client/screens/Readings.tsx
git commit -m "$(cat <<'EOF'
feat(book-tool): preview overlay against a reading

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Verification

### Task 24: End-to-end manual smoke

**Files:** none (manual verification)

- [ ] **Step 1: Start with a clean tree**

Run: `git status`
Expected: clean.

Run: `git log --oneline -20`
Expected: All Tasks 1-23 visible.

- [ ] **Step 2: Reset assets and walk the full pipeline**

```bash
rm -rf assets/library assets/titles assets/readings
mkdir -p assets/library/images assets/library/audio assets/titles assets/readings
printf '{"assets": []}\n' > assets/library/library.json
node scripts/book-register.js
```

Expected output: `Wrote ... (0 titles, 0 readings, 0 assets).`

- [ ] **Step 3: Start the dev server and walk through the GUI**

Run: `npm run book-tool`

Then in the GUI:
1. Library tab → "Upload images" → pick 3 PNGs, source "Demo Book" → upload → wait for done.
2. Library tab → "Upload audio" → pick 3 MP3s, source "Demo Book", reader "Test Reader" → upload.
3. Titles tab → "+ New title" → "Demo Book" + cover image → save.
4. Readings tab → "+ New reading" → pick "Demo Book" + reader "Test Reader" → add 3 pages, assign image+audio to each → drag rows around → save.
5. Reading appears under "Demo Book" group.
6. Click Preview → page through, audio plays.

- [ ] **Step 4: Verify on-disk layout**

```bash
ls assets/library/images
ls assets/library/audio
ls assets/titles/demo-book
cat assets/titles/demo-book/title.json
ls assets/readings
cat assets/readings/rdg-0001/reading.json
cat src/books/BookRegistry.ts
```

Expected: all files present and structurally correct.

- [ ] **Step 5: Run the app on device (Expo Go)**

Run: `npm run start` and open on phone.

1. Adult panel → "Read a book to Ava" → "Demo Book" → "Test Reader".
2. Landscape orientation kicks in.
3. Pages advance on tap; long-press goes back.
4. Adult panel from corner → "Exit book" returns to play mode.

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: all main-app tests pass.

Run: `cd tools/book-import && npm test`
Expected: all tool tests pass.

- [ ] **Step 7: No commit** (verification step). If smoke uncovered anything, fix it as a separate commit.

---

### Task 25: Final code review (subagent dispatch)

After all tasks pass smoke, dispatch the `superpowers:code-reviewer` agent with a prompt that includes:
- The spec path (`docs/superpowers/specs/2026-06-13-library-and-readings-design.md`)
- The plan path (this file)
- The commit range (`git log --oneline <SHA-before-Task-1>..HEAD`)
- Instructions to check: spec coverage, integrity-check correctness, no dead code from old layout, tests cover all routes and storage modules.

Apply any issues the reviewer surfaces as follow-up commits before merging.

---

## Self-review notes

This plan was self-reviewed against the spec on 2026-06-13. Findings:

- **Spec coverage:** Every Concepts section (Asset, TitleGroup, Reading) maps to types in Task 3 and storage modules in Tasks 4-6. Each on-disk-layout path is created by either Task 1 (scaffolding) or the relevant storage module. The runtime app changes section maps to Tasks 15-16. The book-tool UI three-tab structure maps to Tasks 18-23. Error/edge cases (409s on referenced assets/titles, 400 on bad pages) covered in route tests (Tasks 8-10). Drag-and-drop is in Task 22 with explicit @dnd-kit usage and a keyboard sensor.
- **Placeholders:** Task 16 ("Engineer: open the current AdultPanel.tsx...") is a soft reference rather than a full code listing. This is deliberate — the existing picker has substantial visual styling that would dominate the plan if quoted verbatim. The subagent executing Task 16 should `Read` the current AdultPanel.tsx, find the picker subtree, and surgically swap the data source. Acceptance criterion: typecheck + smoke test on device.
- **Type consistency:** `Asset`, `TitleGroup`, `Reading`, `ReadingPage`, `LibraryFile` use the same field names across server types (Task 3), runtime types (Task 1 Step 5), and client types (Task 17). `AssetInUseError.references` and `TitleInUseError.references` both have `Array<{ readingId, titleId }>` shape — consumed by routes (Tasks 8, 9) and tests under that shape.

