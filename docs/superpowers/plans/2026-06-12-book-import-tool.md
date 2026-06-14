# Book Import Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only web GUI launched with `npm run book-tool` that wraps the existing book asset pipeline scripts so Ryan can see, add, edit, preview, and delete books in the AvieBaby catalog without running shell commands per page.

**Architecture:** Two-process local dev tool. An Express server on `127.0.0.1:5174` exposes a REST API that shells out to the existing `book-page.sh` / `book-voice.sh` / `book-cover.sh` / `book-register.js` scripts via `child_process.spawn`. A Vite-built React single-page frontend on `127.0.0.1:5175` (proxied through Express) provides the UI. Both processes start together via a single root npm script that also auto-opens the browser.

**Tech Stack:** Node 20+, Express 4, Multer (multipart), `child_process.spawn`, React 18, TypeScript, Vite 5, native HTML5 drag-and-drop, Jest for pure-logic tests.

**Spec:** `docs/superpowers/specs/2026-06-12-book-import-tool-design.md`

---

## File Structure

Created in execution order:

```
tools/book-import/
├── package.json                        Local deps (express, multer, vite, react, ...)
├── tsconfig.json                       TS config for both server and client
├── vite.config.ts                      Vite dev server (port 5175, proxies /api to 5174)
├── jest.config.js
├── README.md                           Smoke checklist
├── .gitignore                          dist/, node_modules/
├── server/
│   ├── index.ts                        Express boot, browser-open, route wiring
│   ├── validation.ts                   Pure logic: id derivation, file/count validation
│   ├── validation.test.ts
│   ├── registry.ts                     Scan assets/books/, build API response shape
│   ├── registry.test.ts                With fixture directory
│   ├── pipeline.ts                     spawn() wrappers for book-page.sh / book-voice.sh / book-cover.sh / book-register.js
│   ├── jobs.ts                         SSE channel + per-job event log
│   └── routes/
│       ├── books.ts                    GET / POST / DELETE / PATCH /api/books
│       ├── readers.ts                  POST /api/books/:id/readers
│       └── pages.ts                    POST /api/books/:id/pages + PUT replacements
└── client/
    ├── index.html
    ├── main.tsx                        React entry
    ├── App.tsx                         Top-level state routing (no router)
    ├── api.ts                          fetch wrappers + shared types
    ├── screens/
    │   ├── BookList.tsx
    │   ├── AddBookWizard.tsx
    │   ├── EditBook.tsx
    │   └── PreviewOverlay.tsx
    └── components/
        ├── DropZone.tsx                Generic drag-and-drop file dropzone
        ├── PageTile.tsx                Thumbnail + page number + reorder handle
        ├── VoiceTile.tsx               Audio file tile with ▶ play + duration + keep-tail toggle
        ├── ProgressOverlay.tsx         SSE-consuming progress feedback
        └── DeleteConfirm.tsx           Type-the-title confirmation modal
```

Root `package.json` gets a new `"book-tool"` script.

---

## Task 1: Scaffold tools/book-import workspace

**Files:**
- Create: `tools/book-import/package.json`, `tools/book-import/tsconfig.json`, `tools/book-import/.gitignore`
- Create stub directories: `tools/book-import/server/`, `tools/book-import/client/screens/`, `tools/book-import/client/components/`

- [ ] **Step 1: Create the directory structure and package.json**

```bash
mkdir -p tools/book-import/server/routes
mkdir -p tools/book-import/client/screens
mkdir -p tools/book-import/client/components
```

Create `tools/book-import/package.json`:

```json
{
  "name": "aviebaby-book-import",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "dev:server": "tsx server/index.ts",
    "dev:client": "vite",
    "build:client": "vite build",
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^8.2.2",
    "jest": "^29.7.0",
    "open": "^10.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "ts-jest": "^29.1.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

`tools/book-import/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "allowImportingTsExtensions": false,
    "types": ["node", "jest"]
  },
  "include": ["server", "client"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .gitignore**

`tools/book-import/.gitignore`:

```
node_modules/
dist/
*.log
.tmp-uploads/
```

- [ ] **Step 4: Create jest.config.js**

`tools/book-import/jest.config.js`:

```js
/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
};
```

- [ ] **Step 5: Install and verify**

```bash
cd tools/book-import
npm install
npm run typecheck
```

Expected: install completes; typecheck passes (no source files yet so it's trivially clean).

- [ ] **Step 6: Commit**

```bash
git add tools/book-import/package.json tools/book-import/tsconfig.json tools/book-import/.gitignore tools/book-import/jest.config.js tools/book-import/package-lock.json
git commit -m "Scaffold tools/book-import workspace"
```

---

## Task 2: Validation module (TDD)

**Files:**
- Create: `tools/book-import/server/validation.ts`, `tools/book-import/server/validation.test.ts`

- [ ] **Step 1: Write the failing test**

`tools/book-import/server/validation.test.ts`:

```ts
import {
  toId,
  validateBookId,
  validateReaderId,
  validateFileSize,
  validateCountMatch,
} from './validation';

describe('toId', () => {
  test('lowercases and dashes', () => {
    expect(toId('Goodnight Moon')).toBe('goodnight-moon');
  });
  test('strips apostrophes', () => {
    expect(toId("Don't Let the Pigeon Drive the Bus")).toBe(
      'dont-let-the-pigeon-drive-the-bus',
    );
  });
  test('collapses spaces and dashes', () => {
    expect(toId('Brown Bear,  Brown - Bear')).toBe('brown-bear-brown-bear');
  });
  test('trims leading/trailing dashes', () => {
    expect(toId('  - Goodnight - ')).toBe('goodnight');
  });
  test('strips non-alphanumeric except dash', () => {
    expect(toId('Hello!@#World')).toBe('helloworld');
  });
});

describe('validateBookId', () => {
  test('accepts a valid id', () => {
    expect(validateBookId('goodnight-moon', [])).toBeNull();
  });
  test('rejects empty', () => {
    expect(validateBookId('', [])).toContain('required');
  });
  test('rejects id starting with a number', () => {
    expect(validateBookId('1book', [])).toContain('letter');
  });
  test('rejects id with uppercase', () => {
    expect(validateBookId('Book', [])).toContain('lowercase');
  });
  test('rejects collision', () => {
    expect(validateBookId('moon', ['moon', 'sun'])).toContain('already exists');
  });
});

describe('validateReaderId', () => {
  test('accepts a valid id', () => {
    expect(validateReaderId('uncle-ryan', [])).toBeNull();
  });
  test('rejects collision within book', () => {
    expect(validateReaderId('ryan', ['ryan'])).toContain('already');
  });
});

describe('validateFileSize', () => {
  test('accepts under the limit', () => {
    expect(validateFileSize(1024, 10 * 1024 * 1024, 'image')).toBeNull();
  });
  test('rejects over the limit', () => {
    expect(validateFileSize(11 * 1024 * 1024, 10 * 1024 * 1024, 'image')).toContain('too large');
  });
});

describe('validateCountMatch', () => {
  test('accepts equal counts', () => {
    expect(validateCountMatch(5, 5, 'pages', 'voices')).toBeNull();
  });
  test('rejects mismatched counts', () => {
    expect(validateCountMatch(5, 3, 'pages', 'voices')).toContain('5 pages');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
cd tools/book-import
npm test -- validation
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`tools/book-import/server/validation.ts`:

```ts
const ID_REGEX = /^[a-z][a-z0-9-]*$/;

export function toId(input: string): string {
  return input
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateBookId(id: string, existingIds: string[]): string | null {
  if (!id) return 'Book id is required.';
  if (!/^[a-z]/.test(id)) return 'Book id must start with a letter.';
  if (id !== id.toLowerCase()) return 'Book id must be lowercase.';
  if (!ID_REGEX.test(id)) {
    return 'Book id may only contain lowercase letters, digits, and dashes.';
  }
  if (id.length > 50) return 'Book id must be 50 characters or fewer.';
  if (existingIds.includes(id)) return `Book id "${id}" already exists.`;
  return null;
}

export function validateReaderId(id: string, existingReaderIds: string[]): string | null {
  if (!id) return 'Reader id is required.';
  if (!ID_REGEX.test(id)) {
    return 'Reader id may only contain lowercase letters, digits, and dashes.';
  }
  if (existingReaderIds.includes(id)) return `Reader id "${id}" is already in this book.`;
  return null;
}

export function validateFileSize(
  bytes: number,
  limitBytes: number,
  kind: string,
): string | null {
  if (bytes > limitBytes) {
    const limitMb = Math.round(limitBytes / 1024 / 1024);
    return `${kind} file is too large (limit ${limitMb} MB).`;
  }
  return null;
}

export function validateCountMatch(
  a: number,
  b: number,
  aName: string,
  bName: string,
): string | null {
  if (a !== b) {
    return `You have ${a} ${aName} but ${b} ${bName}; they must match.`;
  }
  return null;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 99;
```

- [ ] **Step 4: Run tests**

```bash
npm test -- validation
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/book-import/server/validation.ts tools/book-import/server/validation.test.ts
git commit -m "tools/book-import: validation module with id/file/count checks"
```

---

## Task 3: Registry parsing module (TDD)

**Files:**
- Create: `tools/book-import/server/registry.ts`, `tools/book-import/server/registry.test.ts`, `tools/book-import/server/__fixtures__/`

- [ ] **Step 1: Build a fixture**

```bash
mkdir -p tools/book-import/server/__fixtures__/assets/books/sample-book/pages
mkdir -p tools/book-import/server/__fixtures__/assets/books/sample-book/voices/ryan
mkdir -p tools/book-import/server/__fixtures__/assets/books/sample-book/voices/kristen
```

Create three empty placeholder files (just touch):

```bash
touch tools/book-import/server/__fixtures__/assets/books/sample-book/pages/page-01.png
touch tools/book-import/server/__fixtures__/assets/books/sample-book/pages/page-02.png
touch tools/book-import/server/__fixtures__/assets/books/sample-book/voices/ryan/page-01.mp3
touch tools/book-import/server/__fixtures__/assets/books/sample-book/voices/ryan/page-02.mp3
touch tools/book-import/server/__fixtures__/assets/books/sample-book/voices/kristen/page-01.mp3
touch tools/book-import/server/__fixtures__/assets/books/sample-book/voices/kristen/page-02.mp3
touch tools/book-import/server/__fixtures__/assets/books/sample-book/cover.png
```

Create `tools/book-import/server/__fixtures__/assets/books/sample-book/book.json`:

```json
{
  "title": "Sample Book",
  "readers": {
    "ryan": "Uncle Ryan",
    "kristen": "Mommy"
  }
}
```

- [ ] **Step 2: Write the failing test**

`tools/book-import/server/registry.test.ts`:

```ts
import { listBooks } from './registry';
import * as path from 'node:path';

const FIXTURE_ROOT = path.join(__dirname, '__fixtures__');

describe('listBooks', () => {
  test('reads the fixture directory', () => {
    const books = listBooks(FIXTURE_ROOT);
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe('sample-book');
    expect(books[0].title).toBe('Sample Book');
    expect(books[0].hasCover).toBe(true);
    expect(books[0].pageCount).toBe(2);
    expect(books[0].readers).toEqual([
      { id: 'kristen', name: 'Mommy' },
      { id: 'ryan', name: 'Uncle Ryan' },
    ]);
  });

  test('returns empty array if assets/books does not exist', () => {
    expect(listBooks('/nonexistent/path')).toEqual([]);
  });

  test('falls back to id as title when book.json is missing', () => {
    const tmpRoot = path.join(__dirname, '__fixtures_tmp__');
    const fs = require('node:fs');
    fs.mkdirSync(path.join(tmpRoot, 'assets/books/no-meta/pages'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'assets/books/no-meta/pages/page-01.png'), '');
    const books = listBooks(tmpRoot);
    expect(books[0].title).toBe('no-meta');
    expect(books[0].readers).toEqual([]);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});
```

- [ ] **Step 3: Run, confirm failure**

```bash
npm test -- registry
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`tools/book-import/server/registry.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BookSummary {
  id: string;
  title: string;
  pageCount: number;
  hasCover: boolean;
  readers: Array<{ id: string; name: string }>;
}

export function listBooks(repoRoot: string): BookSummary[] {
  const assetsDir = path.join(repoRoot, 'assets', 'books');
  if (!fs.existsSync(assetsDir)) return [];

  const bookIds = fs
    .readdirSync(assetsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  return bookIds.map((bookId) => readOne(assetsDir, bookId));
}

function readOne(assetsDir: string, bookId: string): BookSummary {
  const bookDir = path.join(assetsDir, bookId);
  const info = readBookInfo(bookDir);
  const pagesDir = path.join(bookDir, 'pages');
  const voicesDir = path.join(bookDir, 'voices');
  const coverPath = path.join(bookDir, 'cover.png');

  const pageCount = fs.existsSync(pagesDir)
    ? fs.readdirSync(pagesDir).filter((f) => /^page-\d{2}\.png$/.test(f)).length
    : 0;

  const readerIds = fs.existsSync(voicesDir)
    ? fs
        .readdirSync(voicesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];

  return {
    id: bookId,
    title: info.title || bookId,
    pageCount,
    hasCover: fs.existsSync(coverPath),
    readers: readerIds.map((rid) => ({
      id: rid,
      name: info.readers[rid] || rid,
    })),
  };
}

interface BookInfo {
  title: string;
  readers: Record<string, string>;
}

function readBookInfo(bookDir: string): BookInfo {
  const infoPath = path.join(bookDir, 'book.json');
  if (!fs.existsSync(infoPath)) return { title: '', readers: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    return {
      title: typeof raw.title === 'string' ? raw.title : '',
      readers:
        raw.readers && typeof raw.readers === 'object' && !Array.isArray(raw.readers)
          ? raw.readers
          : {},
    };
  } catch {
    return { title: '', readers: {} };
  }
}

export function writeBookInfo(
  repoRoot: string,
  bookId: string,
  info: BookInfo,
): void {
  const infoPath = path.join(repoRoot, 'assets', 'books', bookId, 'book.json');
  fs.mkdirSync(path.dirname(infoPath), { recursive: true });
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n');
}

export function loadBookInfo(repoRoot: string, bookId: string): BookInfo {
  return readBookInfo(path.join(repoRoot, 'assets', 'books', bookId));
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- registry
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/book-import/server/registry.ts tools/book-import/server/registry.test.ts tools/book-import/server/__fixtures__/
git commit -m "tools/book-import: registry parsing with fixture-based tests"
```

---

## Task 4: Pipeline module — script-shelling wrappers

**Files:**
- Create: `tools/book-import/server/pipeline.ts`

These are wrappers around the existing shell scripts. We don't unit-test them (they shell out; would need a mock filesystem). Smoke-tested via the integration with the routes.

- [ ] **Step 1: Implement**

`tools/book-import/server/pipeline.ts`:

```ts
import { spawn } from 'node:child_process';

export interface PipelineEvent {
  step: string;
  status: 'started' | 'succeeded' | 'failed';
  stdout?: string;
  stderr?: string;
}

export type PipelineEmit = (event: PipelineEvent) => void;

function runScript(
  repoRoot: string,
  args: string[],
  step: string,
  emit: PipelineEmit,
): Promise<void> {
  emit({ step, status: 'started' });
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', args, { cwd: repoRoot });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', (err) => {
      emit({ step, status: 'failed', stderr: err.message });
      reject(err);
    });
    proc.on('close', (code) => {
      if (code === 0) {
        emit({ step, status: 'succeeded', stdout });
        resolve();
      } else {
        emit({ step, status: 'failed', stdout, stderr });
        reject(new Error(`${step} failed (exit ${code}): ${stderr.trim()}`));
      }
    });
  });
}

export async function runBookPage(
  repoRoot: string,
  inputPath: string,
  bookId: string,
  pageNum: number,
  title: string | null,
  emit: PipelineEmit,
): Promise<void> {
  const args = ['scripts/book-page.sh'];
  if (title) args.push('--title', title);
  args.push(inputPath, bookId, String(pageNum));
  await runScript(repoRoot, args, `page-${pageNum}`, emit);
}

export async function runBookVoice(
  repoRoot: string,
  inputPath: string,
  bookId: string,
  readerId: string,
  pageNum: number,
  readerName: string | null,
  keepTail: boolean,
  emit: PipelineEmit,
): Promise<void> {
  const args = ['scripts/book-voice.sh'];
  if (keepTail) args.push('--keep-tail');
  if (readerName) args.push('--reader-name', readerName);
  args.push(inputPath, bookId, readerId, String(pageNum));
  await runScript(
    repoRoot,
    args,
    `voice-${readerId}-${pageNum}`,
    emit,
  );
}

export async function runBookCover(
  repoRoot: string,
  inputPath: string,
  bookId: string,
  emit: PipelineEmit,
): Promise<void> {
  await runScript(
    repoRoot,
    ['scripts/book-cover.sh', inputPath, bookId],
    'cover',
    emit,
  );
}

export async function runBookRegister(
  repoRoot: string,
  emit: PipelineEmit,
): Promise<void> {
  emit({ step: 'register', status: 'started' });
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['scripts/book-register.js'], { cwd: repoRoot });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        emit({ step: 'register', status: 'succeeded', stdout });
        resolve();
      } else {
        emit({ step: 'register', status: 'failed', stdout, stderr });
        reject(new Error(`register failed (exit ${code}): ${stderr.trim()}`));
      }
    });
  });
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/server/pipeline.ts
git commit -m "tools/book-import: pipeline wrappers for the shell scripts"
```

---

## Task 5: Jobs module — SSE channel

**Files:**
- Create: `tools/book-import/server/jobs.ts`

The frontend listens on SSE to get per-step pipeline events. The jobs module is a small in-memory map of `jobId -> EventEmitter`.

- [ ] **Step 1: Implement**

`tools/book-import/server/jobs.ts`:

```ts
import { EventEmitter } from 'node:events';
import type { PipelineEvent } from './pipeline.js';

interface Job {
  emitter: EventEmitter;
  events: PipelineEvent[];
  finished: boolean;
}

const jobs = new Map<string, Job>();
let _next = 1;

export function createJob(): { id: string; emit: (e: PipelineEvent) => void; finish: (ok: boolean, error?: string) => void } {
  const id = `job-${_next++}`;
  const emitter = new EventEmitter();
  const events: PipelineEvent[] = [];
  jobs.set(id, { emitter, events, finished: false });

  const emit = (e: PipelineEvent) => {
    events.push(e);
    emitter.emit('event', e);
  };
  const finish = (ok: boolean, error?: string) => {
    const finalEvent: PipelineEvent = {
      step: 'done',
      status: ok ? 'succeeded' : 'failed',
      stderr: error,
    };
    events.push(finalEvent);
    emitter.emit('event', finalEvent);
    const job = jobs.get(id);
    if (job) job.finished = true;
    setTimeout(() => jobs.delete(id), 5 * 60 * 1000); // GC after 5 min
  };
  return { id, emit, finish };
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/server/jobs.ts
git commit -m "tools/book-import: in-memory job channel for SSE progress"
```

---

## Task 6: Express server scaffold + GET endpoints

**Files:**
- Create: `tools/book-import/server/index.ts`, `tools/book-import/server/routes/books.ts`

- [ ] **Step 1: Implement the books routes for GET only**

`tools/book-import/server/routes/books.ts`:

```ts
import { Router } from 'express';
import { listBooks } from '../registry.js';

export function makeBooksRouter(repoRoot: string): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ books: listBooks(repoRoot) });
  });

  return router;
}
```

- [ ] **Step 2: Implement the server entry**

`tools/book-import/server/index.ts`:

```ts
import express from 'express';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBooksRouter } from './routes/books.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const PORT = Number(process.env.PORT || 5174);
const HOST = '127.0.0.1';

const app = express();
app.use(express.json());

app.use('/api/books', makeBooksRouter(REPO_ROOT));

app.use(
  '/assets/books',
  express.static(path.join(REPO_ROOT, 'assets', 'books')),
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, repoRoot: REPO_ROOT });
});

app.listen(PORT, HOST, () => {
  console.log(`Book import server listening on http://${HOST}:${PORT}`);
});
```

- [ ] **Step 3: Smoke-test**

```bash
cd tools/book-import
npm run dev:server &
sleep 1
curl -s http://127.0.0.1:5174/api/health
curl -s http://127.0.0.1:5174/api/books
kill %1
```

Expected: health endpoint returns `{"ok":true,...}`. `/api/books` returns `{"books":[]}` (or the current registered books if any).

- [ ] **Step 4: Commit**

```bash
git add tools/book-import/server/index.ts tools/book-import/server/routes/books.ts
git commit -m "tools/book-import: Express scaffold + GET /api/books + static /assets/books"
```

---

## Task 7: POST /api/books — add a book

**Files:**
- Modify: `tools/book-import/server/routes/books.ts`

- [ ] **Step 1: Add the POST handler**

Update `tools/book-import/server/routes/books.ts`:

```ts
import { Router } from 'express';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { listBooks, writeBookInfo, loadBookInfo } from '../registry.js';
import {
  validateBookId,
  validateReaderId,
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
  MAX_PAGES,
} from '../validation.js';
import {
  runBookPage,
  runBookVoice,
  runBookCover,
  runBookRegister,
} from '../pipeline.js';
import { createJob } from '../jobs.js';

const tmpDir = path.join(os.tmpdir(), 'aviebaby-book-import');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir });

interface AddBookFields {
  title: string;
  bookId: string;
  readerName: string;
  readerId: string;
  keepTail: string; // JSON-encoded array of booleans
}

export function makeBooksRouter(repoRoot: string): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ books: listBooks(repoRoot) });
  });

  router.post(
    '/',
    upload.fields([
      { name: 'pages', maxCount: MAX_PAGES },
      { name: 'voices', maxCount: MAX_PAGES },
      { name: 'cover', maxCount: 1 },
    ]),
    async (req, res) => {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const fields = req.body as AddBookFields;
      const pages = (files.pages || []).sort((a, b) =>
        a.originalname.localeCompare(b.originalname),
      );
      const voices = (files.voices || []).sort((a, b) =>
        a.originalname.localeCompare(b.originalname),
      );
      const cover = files.cover?.[0];

      const existingIds = listBooks(repoRoot).map((b) => b.id);
      const bookIdError = validateBookId(fields.bookId, existingIds);
      if (bookIdError) return res.status(400).json({ error: bookIdError });

      const readerIdError = validateReaderId(fields.readerId, []);
      if (readerIdError) return res.status(400).json({ error: readerIdError });

      if (pages.length === 0) return res.status(400).json({ error: 'At least one page is required.' });
      if (pages.length !== voices.length) {
        return res.status(400).json({
          error: `You have ${pages.length} pages but ${voices.length} voices; they must match.`,
        });
      }
      for (const p of pages) {
        if (p.size > MAX_IMAGE_BYTES)
          return res.status(400).json({ error: `Page "${p.originalname}" exceeds the 10 MB image limit.` });
      }
      for (const v of voices) {
        if (v.size > MAX_AUDIO_BYTES)
          return res.status(400).json({ error: `Voice "${v.originalname}" exceeds the 20 MB audio limit.` });
      }

      const keepTailFlags: boolean[] = (() => {
        try {
          const parsed = JSON.parse(fields.keepTail || '[]');
          return Array.isArray(parsed) ? parsed.map(Boolean) : [];
        } catch {
          return [];
        }
      })();

      const job = createJob();
      res.json({ jobId: job.id });

      (async () => {
        try {
          for (let i = 0; i < pages.length; i++) {
            const pageNum = i + 1;
            const isFirst = i === 0;
            await runBookPage(
              repoRoot,
              pages[i].path,
              fields.bookId,
              pageNum,
              isFirst ? fields.title : null,
              job.emit,
            );
          }
          for (let i = 0; i < voices.length; i++) {
            const pageNum = i + 1;
            const isFirst = i === 0;
            await runBookVoice(
              repoRoot,
              voices[i].path,
              fields.bookId,
              fields.readerId,
              pageNum,
              isFirst ? fields.readerName : null,
              keepTailFlags[i] === true,
              job.emit,
            );
          }
          if (cover) {
            await runBookCover(repoRoot, cover.path, fields.bookId, job.emit);
          }
          await runBookRegister(repoRoot, job.emit);
          job.finish(true);
        } catch (err) {
          job.finish(false, err instanceof Error ? err.message : String(err));
        } finally {
          for (const f of [...pages, ...voices, ...(cover ? [cover] : [])]) {
            fs.unlink(f.path, () => {});
          }
        }
      })();
    },
  );

  return router;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/server/routes/books.ts
git commit -m "tools/book-import: POST /api/books — add-book pipeline"
```

---

## Task 8: GET /api/jobs/:id/events — SSE stream

**Files:**
- Modify: `tools/book-import/server/index.ts`

- [ ] **Step 1: Add the SSE endpoint**

In `tools/book-import/server/index.ts`, after the existing route registrations and before `app.listen`:

```ts
import { getJob } from './jobs.js';

app.get('/api/jobs/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  for (const event of job.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  const onEvent = (event: { step: string; status: string }) => {
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
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/server/index.ts
git commit -m "tools/book-import: SSE endpoint for job progress"
```

---

## Task 9: DELETE /api/books/:id

**Files:**
- Modify: `tools/book-import/server/routes/books.ts`

- [ ] **Step 1: Add the DELETE handler**

Inside `makeBooksRouter`, after the POST handler:

```ts
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { confirmation } = req.body as { confirmation?: string };

  const books = listBooks(repoRoot);
  const book = books.find((b) => b.id === id);
  if (!book) return res.status(404).json({ error: `Book "${id}" not found.` });

  if (confirmation !== book.title) {
    return res.status(400).json({
      error: `Confirmation must match the book title exactly ("${book.title}").`,
    });
  }

  const job = createJob();
  res.json({ jobId: job.id });

  (async () => {
    try {
      job.emit({ step: 'delete', status: 'started' });
      const bookDir = path.join(repoRoot, 'assets', 'books', id);
      fs.rmSync(bookDir, { recursive: true, force: true });
      job.emit({ step: 'delete', status: 'succeeded' });
      await runBookRegister(repoRoot, job.emit);
      job.finish(true);
    } catch (err) {
      job.finish(false, err instanceof Error ? err.message : String(err));
    }
  })();
});
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/server/routes/books.ts
git commit -m "tools/book-import: DELETE /api/books/:id with typed confirmation"
```

---

## Task 10: PATCH /api/books/:id

**Files:**
- Modify: `tools/book-import/server/routes/books.ts`

- [ ] **Step 1: Add the PATCH handler**

Inside `makeBooksRouter`, after the DELETE handler:

```ts
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, readers } = req.body as {
    title?: string;
    readers?: Record<string, string>;
  };

  const books = listBooks(repoRoot);
  const book = books.find((b) => b.id === id);
  if (!book) return res.status(404).json({ error: `Book "${id}" not found.` });

  const info = loadBookInfo(repoRoot, id);
  if (typeof title === 'string' && title.length > 0) info.title = title;
  if (readers && typeof readers === 'object') {
    for (const [rid, name] of Object.entries(readers)) {
      if (typeof name === 'string' && name.length > 0) info.readers[rid] = name;
    }
  }
  writeBookInfo(repoRoot, id, info);

  const job = createJob();
  res.json({ jobId: job.id });

  (async () => {
    try {
      await runBookRegister(repoRoot, job.emit);
      job.finish(true);
    } catch (err) {
      job.finish(false, err instanceof Error ? err.message : String(err));
    }
  })();
});
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/server/routes/books.ts
git commit -m "tools/book-import: PATCH /api/books/:id for title and reader-name edits"
```

---

## Task 11: POST /api/books/:id/readers

**Files:**
- Create: `tools/book-import/server/routes/readers.ts`
- Modify: `tools/book-import/server/index.ts`

- [ ] **Step 1: Implement the route**

`tools/book-import/server/routes/readers.ts`:

```ts
import { Router } from 'express';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { listBooks } from '../registry.js';
import { validateReaderId, MAX_AUDIO_BYTES, MAX_PAGES } from '../validation.js';
import { runBookVoice, runBookRegister } from '../pipeline.js';
import { createJob } from '../jobs.js';

const tmpDir = path.join(os.tmpdir(), 'aviebaby-book-import');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir });

export function makeReadersRouter(repoRoot: string): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/',
    upload.fields([{ name: 'voices', maxCount: MAX_PAGES }]),
    async (req, res) => {
      const bookId = req.params.id;
      const fields = req.body as {
        readerName: string;
        readerId: string;
        keepTail?: string;
      };
      const files = req.files as Record<string, Express.Multer.File[]>;
      const voices = (files.voices || []).sort((a, b) =>
        a.originalname.localeCompare(b.originalname),
      );

      const books = listBooks(repoRoot);
      const book = books.find((b) => b.id === bookId);
      if (!book) return res.status(404).json({ error: `Book "${bookId}" not found.` });

      const existing = book.readers.map((r) => r.id);
      const readerIdError = validateReaderId(fields.readerId, existing);
      if (readerIdError) return res.status(400).json({ error: readerIdError });

      if (voices.length !== book.pageCount) {
        return res.status(400).json({
          error: `Book has ${book.pageCount} pages; you uploaded ${voices.length} voices.`,
        });
      }
      for (const v of voices) {
        if (v.size > MAX_AUDIO_BYTES) {
          return res.status(400).json({ error: `Voice "${v.originalname}" exceeds the 20 MB limit.` });
        }
      }

      const keepTailFlags: boolean[] = (() => {
        try {
          const parsed = JSON.parse(fields.keepTail || '[]');
          return Array.isArray(parsed) ? parsed.map(Boolean) : [];
        } catch {
          return [];
        }
      })();

      const job = createJob();
      res.json({ jobId: job.id });

      (async () => {
        try {
          for (let i = 0; i < voices.length; i++) {
            const isFirst = i === 0;
            await runBookVoice(
              repoRoot,
              voices[i].path,
              bookId,
              fields.readerId,
              i + 1,
              isFirst ? fields.readerName : null,
              keepTailFlags[i] === true,
              job.emit,
            );
          }
          await runBookRegister(repoRoot, job.emit);
          job.finish(true);
        } catch (err) {
          job.finish(false, err instanceof Error ? err.message : String(err));
        } finally {
          for (const f of voices) fs.unlink(f.path, () => {});
        }
      })();
    },
  );

  return router;
}
```

- [ ] **Step 2: Wire it into `index.ts`**

Add to `tools/book-import/server/index.ts`:

```ts
import { makeReadersRouter } from './routes/readers.js';
// ...
app.use('/api/books/:id/readers', makeReadersRouter(REPO_ROOT));
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add tools/book-import/server/routes/readers.ts tools/book-import/server/index.ts
git commit -m "tools/book-import: POST /api/books/:id/readers for new readers"
```

---

## Task 12: Pages routes — append + replace

**Files:**
- Create: `tools/book-import/server/routes/pages.ts`
- Modify: `tools/book-import/server/index.ts`

- [ ] **Step 1: Implement**

`tools/book-import/server/routes/pages.ts`:

```ts
import { Router } from 'express';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { listBooks } from '../registry.js';
import { MAX_IMAGE_BYTES, MAX_AUDIO_BYTES, MAX_PAGES } from '../validation.js';
import { runBookPage, runBookVoice, runBookRegister } from '../pipeline.js';
import { createJob } from '../jobs.js';

const tmpDir = path.join(os.tmpdir(), 'aviebaby-book-import');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir });

export function makePagesRouter(repoRoot: string): Router {
  const router = Router({ mergeParams: true });

  // Append new pages at the end.
  router.post(
    '/',
    upload.any(),
    async (req, res) => {
      const bookId = req.params.id;
      const books = listBooks(repoRoot);
      const book = books.find((b) => b.id === bookId);
      if (!book) return res.status(404).json({ error: `Book "${bookId}" not found.` });

      const files = req.files as Express.Multer.File[];
      const pages = files
        .filter((f) => f.fieldname.startsWith('page-'))
        .sort((a, b) => a.fieldname.localeCompare(b.fieldname));
      const voicesByReader: Record<string, Express.Multer.File[]> = {};
      for (const f of files) {
        const match = f.fieldname.match(/^voice-([^-]+)-\d+$/);
        if (match) {
          const rid = match[1];
          if (!voicesByReader[rid]) voicesByReader[rid] = [];
          voicesByReader[rid].push(f);
        }
      }
      for (const rid of Object.keys(voicesByReader)) {
        voicesByReader[rid].sort((a, b) => a.fieldname.localeCompare(b.fieldname));
      }

      if (pages.length === 0)
        return res.status(400).json({ error: 'At least one page image required.' });
      for (const r of book.readers) {
        const got = voicesByReader[r.id]?.length || 0;
        if (got !== pages.length) {
          return res.status(400).json({
            error: `Reader "${r.id}" needs ${pages.length} new voice clips; got ${got}.`,
          });
        }
      }

      const startingPage = book.pageCount + 1;
      const job = createJob();
      res.json({ jobId: job.id });

      (async () => {
        try {
          for (let i = 0; i < pages.length; i++) {
            await runBookPage(
              repoRoot,
              pages[i].path,
              bookId,
              startingPage + i,
              null,
              job.emit,
            );
          }
          for (const r of book.readers) {
            const voices = voicesByReader[r.id];
            for (let i = 0; i < voices.length; i++) {
              await runBookVoice(
                repoRoot,
                voices[i].path,
                bookId,
                r.id,
                startingPage + i,
                null,
                false,
                job.emit,
              );
            }
          }
          await runBookRegister(repoRoot, job.emit);
          job.finish(true);
        } catch (err) {
          job.finish(false, err instanceof Error ? err.message : String(err));
        } finally {
          for (const f of files) fs.unlink(f.path, () => {});
        }
      })();
    },
  );

  // Replace a single page image.
  router.put('/:n/image', upload.single('image'), async (req, res) => {
    const bookId = req.params.id;
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGES)
      return res.status(400).json({ error: 'Page number out of range.' });

    const books = listBooks(repoRoot);
    const book = books.find((b) => b.id === bookId);
    if (!book) return res.status(404).json({ error: `Book "${bookId}" not found.` });
    if (n > book.pageCount)
      return res.status(400).json({ error: `Page ${n} does not exist in this book.` });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Missing image file.' });
    if (file.size > MAX_IMAGE_BYTES)
      return res.status(400).json({ error: 'Image too large.' });

    const job = createJob();
    res.json({ jobId: job.id });

    (async () => {
      try {
        await runBookPage(repoRoot, file.path, bookId, n, null, job.emit);
        await runBookRegister(repoRoot, job.emit);
        job.finish(true);
      } catch (err) {
        job.finish(false, err instanceof Error ? err.message : String(err));
      } finally {
        fs.unlink(file.path, () => {});
      }
    })();
  });

  // Replace a single audio file.
  router.put('/:n/voices/:readerId', upload.single('voice'), async (req, res) => {
    const bookId = req.params.id;
    const readerId = req.params.readerId;
    const n = Number(req.params.n);
    const keepTail = req.body.keepTail === 'true';
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGES)
      return res.status(400).json({ error: 'Page number out of range.' });

    const books = listBooks(repoRoot);
    const book = books.find((b) => b.id === bookId);
    if (!book) return res.status(404).json({ error: `Book "${bookId}" not found.` });
    if (!book.readers.find((r) => r.id === readerId))
      return res.status(404).json({ error: `Reader "${readerId}" not in this book.` });
    if (n > book.pageCount)
      return res.status(400).json({ error: `Page ${n} does not exist.` });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Missing voice file.' });
    if (file.size > MAX_AUDIO_BYTES)
      return res.status(400).json({ error: 'Voice too large.' });

    const job = createJob();
    res.json({ jobId: job.id });

    (async () => {
      try {
        await runBookVoice(
          repoRoot,
          file.path,
          bookId,
          readerId,
          n,
          null,
          keepTail,
          job.emit,
        );
        await runBookRegister(repoRoot, job.emit);
        job.finish(true);
      } catch (err) {
        job.finish(false, err instanceof Error ? err.message : String(err));
      } finally {
        fs.unlink(file.path, () => {});
      }
    })();
  });

  return router;
}
```

- [ ] **Step 2: Wire into `index.ts`**

Add:

```ts
import { makePagesRouter } from './routes/pages.js';
// ...
app.use('/api/books/:id/pages', makePagesRouter(REPO_ROOT));
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add tools/book-import/server/routes/pages.ts tools/book-import/server/index.ts
git commit -m "tools/book-import: append pages + replace single page/audio"
```

---

## Task 13: Vite + frontend scaffold

**Files:**
- Create: `tools/book-import/vite.config.ts`, `tools/book-import/client/index.html`, `tools/book-import/client/main.tsx`, `tools/book-import/client/App.tsx`, `tools/book-import/client/api.ts`

- [ ] **Step 1: Vite config**

`tools/book-import/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  server: {
    port: 5175,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:5174',
      '/assets': 'http://127.0.0.1:5174',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 2: HTML entry**

`tools/book-import/client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AvieBaby — Book Import</title>
    <style>
      body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: #f5f5f7; color: #1c1c1e; }
      * { box-sizing: border-box; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: React entry**

`tools/book-import/client/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 4: App shell**

`tools/book-import/client/App.tsx`:

```tsx
import React, { useState } from 'react';
import { BookList } from './screens/BookList';
import { AddBookWizard } from './screens/AddBookWizard';
import { EditBook } from './screens/EditBook';
import { PreviewOverlay } from './screens/PreviewOverlay';

type Screen =
  | { name: 'list' }
  | { name: 'add' }
  | { name: 'edit'; bookId: string }
  | { name: 'preview'; bookId: string };

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>({ name: 'list' });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ margin: 0 }}>AvieBaby — Books</h1>
      {screen.name === 'list' && (
        <BookList
          onAdd={() => setScreen({ name: 'add' })}
          onEdit={(id) => setScreen({ name: 'edit', bookId: id })}
          onPreview={(id) => setScreen({ name: 'preview', bookId: id })}
        />
      )}
      {screen.name === 'add' && (
        <AddBookWizard onDone={() => setScreen({ name: 'list' })} />
      )}
      {screen.name === 'edit' && (
        <EditBook bookId={screen.bookId} onDone={() => setScreen({ name: 'list' })} />
      )}
      {screen.name === 'preview' && (
        <PreviewOverlay bookId={screen.bookId} onClose={() => setScreen({ name: 'list' })} />
      )}
    </div>
  );
};
```

- [ ] **Step 5: API client**

`tools/book-import/client/api.ts`:

```ts
export interface BookSummary {
  id: string;
  title: string;
  pageCount: number;
  hasCover: boolean;
  readers: Array<{ id: string; name: string }>;
}

export async function listBooks(): Promise<BookSummary[]> {
  const res = await fetch('/api/books');
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.books as BookSummary[];
}

export interface PipelineEvent {
  step: string;
  status: 'started' | 'succeeded' | 'failed';
  stdout?: string;
  stderr?: string;
}

export async function postBook(formData: FormData): Promise<string> {
  const res = await fetch('/api/books', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  const { jobId } = await res.json();
  return jobId as string;
}

export function streamJob(jobId: string, onEvent: (e: PipelineEvent) => void): EventSource {
  const es = new EventSource(`/api/jobs/${jobId}/events`);
  es.onmessage = (m) => {
    const event: PipelineEvent = JSON.parse(m.data);
    onEvent(event);
    if (event.step === 'done') es.close();
  };
  return es;
}

export async function deleteBook(id: string, confirmation: string): Promise<string> {
  const res = await fetch(`/api/books/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function patchBook(
  id: string,
  patch: { title?: string; readers?: Record<string, string> },
): Promise<string> {
  const res = await fetch(`/api/books/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function addReader(bookId: string, formData: FormData): Promise<string> {
  const res = await fetch(`/api/books/${bookId}/readers`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function appendPages(bookId: string, formData: FormData): Promise<string> {
  const res = await fetch(`/api/books/${bookId}/pages`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function replacePage(bookId: string, n: number, image: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', image);
  const res = await fetch(`/api/books/${bookId}/pages/${n}/image`, {
    method: 'PUT',
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function replaceVoice(
  bookId: string,
  n: number,
  readerId: string,
  voice: File,
  keepTail: boolean,
): Promise<string> {
  const fd = new FormData();
  fd.append('voice', voice);
  fd.append('keepTail', keepTail ? 'true' : 'false');
  const res = await fetch(`/api/books/${bookId}/pages/${n}/voices/${readerId}`, {
    method: 'PUT',
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}
```

- [ ] **Step 6: Create placeholder screen files**

So the imports don't fail before the screens are written:

```bash
mkdir -p tools/book-import/client/screens
mkdir -p tools/book-import/client/components
```

Create empty stub `tools/book-import/client/screens/BookList.tsx`:

```tsx
import React from 'react';
export const BookList: React.FC<{
  onAdd: () => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
}> = () => <div>Book list — stub</div>;
```

Create similar stubs for `AddBookWizard.tsx`, `EditBook.tsx`, `PreviewOverlay.tsx`:

```tsx
import React from 'react';
export const AddBookWizard: React.FC<{ onDone: () => void }> = ({ onDone }) => (
  <div>Add — stub <button onClick={onDone}>Back</button></div>
);
```

```tsx
import React from 'react';
export const EditBook: React.FC<{ bookId: string; onDone: () => void }> = ({ bookId, onDone }) => (
  <div>Edit {bookId} — stub <button onClick={onDone}>Back</button></div>
);
```

```tsx
import React from 'react';
export const PreviewOverlay: React.FC<{ bookId: string; onClose: () => void }> = ({ bookId, onClose }) => (
  <div>Preview {bookId} — stub <button onClick={onClose}>Close</button></div>
);
```

- [ ] **Step 7: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add tools/book-import/vite.config.ts tools/book-import/client/
git commit -m "tools/book-import: Vite + React scaffold with screen stubs"
```

---

## Task 14: Shared components — DropZone, PageTile, VoiceTile, ProgressOverlay, DeleteConfirm

**Files:**
- Create: `tools/book-import/client/components/DropZone.tsx`, `PageTile.tsx`, `VoiceTile.tsx`, `ProgressOverlay.tsx`, `DeleteConfirm.tsx`

- [ ] **Step 1: DropZone**

`tools/book-import/client/components/DropZone.tsx`:

```tsx
import React, { useRef, useState } from 'react';

interface Props {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
}

export const DropZone: React.FC<Props> = ({ accept, multiple = true, onFiles, label }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (files: FileList | null) => {
    if (!files) return;
    onFiles(Array.from(files));
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${over ? '#0a84ff' : '#c7c7cc'}`,
        background: over ? '#e8f4ff' : '#fff',
        borderRadius: 12,
        padding: 24,
        textAlign: 'center',
        cursor: 'pointer',
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 14, color: '#555' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Drag files here or click to pick</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
};
```

- [ ] **Step 2: PageTile**

`tools/book-import/client/components/PageTile.tsx`:

```tsx
import React from 'react';

interface Props {
  file: File;
  pageNumber: number;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

export const PageTile: React.FC<Props> = ({ file, pageNumber, onRemove, onDragStart, onDragOver, onDrop }) => {
  const url = React.useMemo(() => URL.createObjectURL(file), [file]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        marginBottom: 8,
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e5e5ea',
      }}
    >
      <div style={{ width: 32, textAlign: 'center', fontWeight: 700 }}>{pageNumber}</div>
      <img src={url} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />
      <div style={{ flex: 1, fontSize: 13 }}>{file.name}</div>
      <button onClick={onRemove}>×</button>
    </div>
  );
};
```

- [ ] **Step 3: VoiceTile**

`tools/book-import/client/components/VoiceTile.tsx`:

```tsx
import React from 'react';

interface Props {
  file: File;
  pageNumber: number;
  keepTail: boolean;
  onToggleKeepTail: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

export const VoiceTile: React.FC<Props> = ({
  file, pageNumber, keepTail, onToggleKeepTail, onRemove, onDragStart, onDragOver, onDrop,
}) => {
  const url = React.useMemo(() => URL.createObjectURL(file), [file]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        marginBottom: 8,
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e5e5ea',
      }}
    >
      <div style={{ width: 32, textAlign: 'center', fontWeight: 700 }}>{pageNumber}</div>
      <audio src={url} controls style={{ width: 240 }} />
      <div style={{ flex: 1, fontSize: 13 }}>{file.name}</div>
      <label style={{ fontSize: 12 }}>
        <input type="checkbox" checked={keepTail} onChange={onToggleKeepTail} /> keep-tail
      </label>
      <button onClick={onRemove}>×</button>
    </div>
  );
};
```

- [ ] **Step 4: ProgressOverlay**

`tools/book-import/client/components/ProgressOverlay.tsx`:

```tsx
import React from 'react';
import type { PipelineEvent } from '../api';

interface Props {
  events: PipelineEvent[];
  done: boolean;
  error: string | null;
  onClose: () => void;
}

export const ProgressOverlay: React.FC<Props> = ({ events, done, error, onClose }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}
  >
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>{done ? (error ? 'Failed' : 'Done') : 'Processing...'}</h3>
      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
        {events.map((e, i) => (
          <div key={i} style={{ color: e.status === 'failed' ? '#c00' : '#333' }}>
            {e.step}: {e.status}
          </div>
        ))}
      </div>
      {error && <div style={{ marginTop: 12, color: '#c00' }}>{error}</div>}
      {done && (
        <button onClick={onClose} style={{ marginTop: 16 }}>
          Close
        </button>
      )}
    </div>
  </div>
);
```

- [ ] **Step 5: DeleteConfirm**

`tools/book-import/client/components/DeleteConfirm.tsx`:

```tsx
import React, { useState } from 'react';

interface Props {
  title: string;
  pageCount: number;
  readerCount: number;
  onConfirm: (typedTitle: string) => void;
  onCancel: () => void;
}

export const DeleteConfirm: React.FC<Props> = ({ title, pageCount, readerCount, onConfirm, onCancel }) => {
  const [typed, setTyped] = useState('');
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480 }}>
        <h3 style={{ marginTop: 0 }}>Delete "{title}"?</h3>
        <p>This will permanently delete {pageCount} page{pageCount === 1 ? '' : 's'} and {readerCount} reader recording{readerCount === 1 ? '' : 's'}. This cannot be undone.</p>
        <p>Type the book's title to confirm:</p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          style={{ width: '100%', padding: 8, fontSize: 14 }}
          placeholder={title}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>Cancel</button>
          <button
            onClick={() => onConfirm(typed)}
            disabled={typed !== title}
            style={{ background: typed === title ? '#c00' : '#888', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add tools/book-import/client/components/
git commit -m "tools/book-import: shared UI components (DropZone, Tiles, Progress, DeleteConfirm)"
```

---

## Task 15: BookList screen

**Files:**
- Modify: `tools/book-import/client/screens/BookList.tsx`

- [ ] **Step 1: Implement**

Replace `tools/book-import/client/screens/BookList.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { listBooks, deleteBook, streamJob, BookSummary, PipelineEvent } from '../api';
import { DeleteConfirm } from '../components/DeleteConfirm';
import { ProgressOverlay } from '../components/ProgressOverlay';

interface Props {
  onAdd: () => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
}

export const BookList: React.FC<Props> = ({ onAdd, onEdit, onPreview }) => {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [deleting, setDeleting] = useState<BookSummary | null>(null);
  const [jobEvents, setJobEvents] = useState<PipelineEvent[]>([]);
  const [jobDone, setJobDone] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  const refresh = () => listBooks().then(setBooks).catch(console.error);
  useEffect(() => { refresh(); }, []);

  const runJob = (jobId: string) => {
    setJobEvents([]);
    setJobDone(false);
    setJobError(null);
    streamJob(jobId, (e) => {
      setJobEvents((prev) => [...prev, e]);
      if (e.step === 'done') {
        setJobDone(true);
        if (e.status === 'failed') setJobError(e.stderr || 'Pipeline failed');
        refresh();
      }
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
        <button onClick={onAdd} style={{ padding: '8px 16px', background: '#0a84ff', color: '#fff', border: 'none', borderRadius: 8 }}>
          + Add a book
        </button>
      </div>
      {books.length === 0 && <p>No books yet. Add one to get started.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {books.map((b) => (
          <div key={b.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e5ea' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {b.hasCover && (
                <img src={`/assets/books/${b.id}/cover.png`} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px' }}>{b.title}</h3>
                <div style={{ fontSize: 13, color: '#555' }}>
                  {b.pageCount} page{b.pageCount === 1 ? '' : 's'} • {b.readers.map((r) => r.name).join(', ') || 'no readers'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => onPreview(b.id)}>Preview</button>
              <button onClick={() => onEdit(b.id)}>Edit</button>
              <button onClick={() => setDeleting(b)} style={{ color: '#c00' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {deleting && (
        <DeleteConfirm
          title={deleting.title}
          pageCount={deleting.pageCount}
          readerCount={deleting.readers.length}
          onCancel={() => setDeleting(null)}
          onConfirm={async (typed) => {
            try {
              const jobId = await deleteBook(deleting.id, typed);
              setDeleting(null);
              runJob(jobId);
            } catch (e) {
              alert(e instanceof Error ? e.message : String(e));
            }
          }}
        />
      )}
      {(jobEvents.length > 0 || jobDone) && (
        <ProgressOverlay
          events={jobEvents}
          done={jobDone}
          error={jobError}
          onClose={() => { setJobEvents([]); setJobDone(false); setJobError(null); }}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/client/screens/BookList.tsx
git commit -m "tools/book-import: BookList screen with delete flow"
```

---

## Task 16: AddBookWizard screen

**Files:**
- Modify: `tools/book-import/client/screens/AddBookWizard.tsx`

- [ ] **Step 1: Implement**

Replace `tools/book-import/client/screens/AddBookWizard.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { postBook, streamJob, PipelineEvent } from '../api';
import { DropZone } from '../components/DropZone';
import { PageTile } from '../components/PageTile';
import { VoiceTile } from '../components/VoiceTile';
import { ProgressOverlay } from '../components/ProgressOverlay';

function toId(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const AddBookWizard: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [title, setTitle] = useState('');
  const [bookId, setBookId] = useState('');
  const [readerName, setReaderName] = useState('');
  const [readerId, setReaderId] = useState('');
  const [pages, setPages] = useState<File[]>([]);
  const [voices, setVoices] = useState<File[]>([]);
  const [keepTail, setKeepTail] = useState<boolean[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autoBookId = useMemo(() => toId(title), [title]);
  const autoReaderId = useMemo(() => toId(readerName), [readerName]);
  const effectiveBookId = bookId || autoBookId;
  const effectiveReaderId = readerId || autoReaderId;

  const canSubmit =
    title && readerName && effectiveBookId && effectiveReaderId &&
    pages.length > 0 && voices.length === pages.length;

  const dragSrc = React.useRef<number | null>(null);
  const reorder = <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    return next;
  };

  const submit = async () => {
    setSubmitting(true);
    const fd = new FormData();
    fd.append('title', title);
    fd.append('bookId', effectiveBookId);
    fd.append('readerName', readerName);
    fd.append('readerId', effectiveReaderId);
    fd.append('keepTail', JSON.stringify(keepTail));
    pages.forEach((p, i) => fd.append('pages', p, `page-${String(i + 1).padStart(2, '0')}-${p.name}`));
    voices.forEach((v, i) => fd.append('voices', v, `voice-${String(i + 1).padStart(2, '0')}-${v.name}`));
    if (cover) fd.append('cover', cover);

    try {
      const jobId = await postBook(fd);
      streamJob(jobId, (e) => {
        setEvents((prev) => [...prev, e]);
        if (e.step === 'done') {
          setDone(true);
          if (e.status === 'failed') setError(e.stderr || 'Failed');
        }
      });
    } catch (e) {
      setSubmitting(false);
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <button onClick={onDone}>← Back</button>
      <h2>Add a book</h2>
      <label>Title<br /><input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} /></label>
      <label style={{ display: 'block', marginTop: 8 }}>Book id<br />
        <input value={bookId} onChange={(e) => setBookId(e.target.value)} placeholder={autoBookId} style={{ width: '100%', padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>Reader display name<br />
        <input value={readerName} onChange={(e) => setReaderName(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>Reader id<br />
        <input value={readerId} onChange={(e) => setReaderId(e.target.value)} placeholder={autoReaderId} style={{ width: '100%', padding: 8 }} />
      </label>

      <h3>Pages</h3>
      <DropZone
        accept="image/*"
        onFiles={(f) => setPages((prev) => [...prev, ...f])}
        label="Page images"
      />
      {pages.map((p, i) => (
        <PageTile
          key={i}
          file={p}
          pageNumber={i + 1}
          onRemove={() => setPages((prev) => prev.filter((_, j) => j !== i))}
          onDragStart={() => { dragSrc.current = i; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragSrc.current === null) return;
            setPages((prev) => reorder(prev, dragSrc.current!, i));
            dragSrc.current = null;
          }}
        />
      ))}

      <h3>Voices ({voices.length} / {pages.length})</h3>
      <DropZone
        accept="audio/*"
        onFiles={(f) => {
          setVoices((prev) => [...prev, ...f]);
          setKeepTail((prev) => [...prev, ...f.map(() => false)]);
        }}
        label="Voice recordings (one per page, in order)"
      />
      {voices.map((v, i) => (
        <VoiceTile
          key={i}
          file={v}
          pageNumber={i + 1}
          keepTail={keepTail[i] || false}
          onToggleKeepTail={() => setKeepTail((prev) => prev.map((k, j) => j === i ? !k : k))}
          onRemove={() => {
            setVoices((prev) => prev.filter((_, j) => j !== i));
            setKeepTail((prev) => prev.filter((_, j) => j !== i));
          }}
          onDragStart={() => { dragSrc.current = i; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragSrc.current === null) return;
            setVoices((prev) => reorder(prev, dragSrc.current!, i));
            setKeepTail((prev) => reorder(prev, dragSrc.current!, i));
            dragSrc.current = null;
          }}
        />
      ))}

      <h3>Cover (optional)</h3>
      <DropZone accept="image/*" multiple={false} onFiles={(f) => setCover(f[0])} label="Cover image" />
      {cover && <div>{cover.name}</div>}

      <div style={{ marginTop: 24 }}>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          style={{ background: canSubmit ? '#0a84ff' : '#888', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8 }}
        >
          Import book
        </button>
      </div>

      {(events.length > 0 || done) && (
        <ProgressOverlay
          events={events}
          done={done}
          error={error}
          onClose={onDone}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/client/screens/AddBookWizard.tsx
git commit -m "tools/book-import: AddBookWizard screen"
```

---

## Task 17: EditBook screen — title/reader rename + page/audio replace

**Files:**
- Modify: `tools/book-import/client/screens/EditBook.tsx`

- [ ] **Step 1: Implement**

Replace `tools/book-import/client/screens/EditBook.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import {
  listBooks, BookSummary, patchBook, replacePage, replaceVoice,
  addReader, appendPages, streamJob, PipelineEvent,
} from '../api';
import { ProgressOverlay } from '../components/ProgressOverlay';
import { DropZone } from '../components/DropZone';

interface Props { bookId: string; onDone: () => void; }

export const EditBook: React.FC<Props> = ({ bookId, onDone }) => {
  const [book, setBook] = useState<BookSummary | null>(null);
  const [title, setTitle] = useState('');
  const [readerNames, setReaderNames] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-reader sub-flow state
  const [addingReader, setAddingReader] = useState(false);
  const [newReaderName, setNewReaderName] = useState('');
  const [newReaderId, setNewReaderId] = useState('');
  const [newReaderVoices, setNewReaderVoices] = useState<File[]>([]);

  // Append-pages sub-flow state
  const [addingPages, setAddingPages] = useState(false);
  const [newPages, setNewPages] = useState<File[]>([]);
  const [newVoicesByReader, setNewVoicesByReader] = useState<Record<string, File[]>>({});

  const refresh = () => listBooks().then((books) => {
    const b = books.find((x) => x.id === bookId);
    if (b) {
      setBook(b);
      setTitle(b.title);
      const names: Record<string, string> = {};
      for (const r of b.readers) names[r.id] = r.name;
      setReaderNames(names);
    }
  });
  useEffect(() => { refresh(); }, [bookId]);

  const runJob = (jobId: string) => {
    setEvents([]); setDone(false); setError(null);
    streamJob(jobId, (e) => {
      setEvents((prev) => [...prev, e]);
      if (e.step === 'done') {
        setDone(true);
        if (e.status === 'failed') setError(e.stderr || 'Failed');
        refresh();
      }
    });
  };

  const saveMetadata = async () => {
    try {
      const jobId = await patchBook(bookId, { title, readers: readerNames });
      runJob(jobId);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const onReplacePage = async (n: number, file: File) => {
    try { runJob(await replacePage(bookId, n, file)); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const onReplaceVoice = async (n: number, rid: string, file: File, keepTail: boolean) => {
    try { runJob(await replaceVoice(bookId, n, rid, file, keepTail)); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const submitNewReader = async () => {
    if (!book) return;
    if (newReaderVoices.length !== book.pageCount) {
      alert(`Need ${book.pageCount} voice clips; got ${newReaderVoices.length}.`);
      return;
    }
    const fd = new FormData();
    fd.append('readerName', newReaderName);
    fd.append('readerId', newReaderId);
    fd.append('keepTail', JSON.stringify(newReaderVoices.map(() => false)));
    newReaderVoices.forEach((v, i) =>
      fd.append('voices', v, `voice-${String(i + 1).padStart(2, '0')}-${v.name}`),
    );
    try {
      const jobId = await addReader(bookId, fd);
      setAddingReader(false);
      setNewReaderName(''); setNewReaderId(''); setNewReaderVoices([]);
      runJob(jobId);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const submitNewPages = async () => {
    if (!book) return;
    for (const r of book.readers) {
      if ((newVoicesByReader[r.id]?.length || 0) !== newPages.length) {
        alert(`Reader ${r.name} needs ${newPages.length} new voice clips.`);
        return;
      }
    }
    const fd = new FormData();
    newPages.forEach((p, i) => fd.append(`page-${String(i + 1).padStart(2, '0')}`, p));
    for (const r of book.readers) {
      newVoicesByReader[r.id].forEach((v, i) =>
        fd.append(`voice-${r.id}-${String(i + 1).padStart(2, '0')}`, v),
      );
    }
    try {
      const jobId = await appendPages(bookId, fd);
      setAddingPages(false);
      setNewPages([]); setNewVoicesByReader({});
      runJob(jobId);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  if (!book) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={onDone}>← Back</button>
      <h2>Edit: {book.title}</h2>

      <h3>Title</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} />

      <h3>Readers</h3>
      {book.readers.map((r) => (
        <div key={r.id} style={{ marginBottom: 8 }}>
          <label>
            {r.id}:{' '}
            <input
              value={readerNames[r.id] || ''}
              onChange={(e) => setReaderNames((prev) => ({ ...prev, [r.id]: e.target.value }))}
              style={{ padding: 4 }}
            />
          </label>
        </div>
      ))}
      <button onClick={saveMetadata}>Save title and reader names</button>
      <button onClick={() => setAddingReader(true)} style={{ marginLeft: 8 }}>+ Add a reader</button>

      <h3>Pages</h3>
      {Array.from({ length: book.pageCount }).map((_, idx) => {
        const pageNum = idx + 1;
        const pageNN = String(pageNum).padStart(2, '0');
        return (
          <div key={pageNum} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, padding: 8, background: '#fff', borderRadius: 8 }}>
            <div style={{ width: 32, textAlign: 'center', fontWeight: 700 }}>{pageNum}</div>
            <img src={`/assets/books/${bookId}/pages/page-${pageNN}.png?t=${events.length}`} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />
            <label style={{ fontSize: 12 }}>
              Replace image:{' '}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onReplacePage(pageNum, e.target.files[0])} />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {book.readers.map((r) => (
                <div key={r.id} style={{ fontSize: 12 }}>
                  <strong>{r.name}:</strong>{' '}
                  <audio src={`/assets/books/${bookId}/voices/${r.id}/page-${pageNN}.mp3?t=${events.length}`} controls style={{ height: 24 }} />
                  <input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && onReplaceVoice(pageNum, r.id, e.target.files[0], false)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button onClick={() => setAddingPages(true)} style={{ marginTop: 16 }}>+ Add pages at the end</button>

      {addingReader && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Add a new reader</h3>
            <label>Name<br /><input value={newReaderName} onChange={(e) => setNewReaderName(e.target.value)} style={{ width: '100%', padding: 8 }} /></label>
            <label style={{ display: 'block', marginTop: 8 }}>Id<br /><input value={newReaderId} onChange={(e) => setNewReaderId(e.target.value)} style={{ width: '100%', padding: 8 }} /></label>
            <p>Upload {book.pageCount} voice clip{book.pageCount === 1 ? '' : 's'}, one per page in order:</p>
            <DropZone accept="audio/*" onFiles={(f) => setNewReaderVoices((prev) => [...prev, ...f])} label={`Voices (${newReaderVoices.length}/${book.pageCount})`} />
            {newReaderVoices.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <strong>Page {i + 1}:</strong>
                <span style={{ flex: 1, fontSize: 12 }}>{v.name}</span>
                <button onClick={() => setNewReaderVoices((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setAddingReader(false)}>Cancel</button>
              <button onClick={submitNewReader} disabled={newReaderVoices.length !== book.pageCount || !newReaderName || !newReaderId} style={{ background: '#0a84ff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {addingPages && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 720, maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Add pages at the end</h3>
            <DropZone accept="image/*" onFiles={(f) => setNewPages((prev) => [...prev, ...f])} label={`New page images (${newPages.length})`} />
            {book.readers.map((r) => (
              <div key={r.id} style={{ marginTop: 16 }}>
                <h4>Voices for {r.name}</h4>
                <DropZone
                  accept="audio/*"
                  onFiles={(f) => setNewVoicesByReader((prev) => ({ ...prev, [r.id]: [...(prev[r.id] || []), ...f] }))}
                  label={`Voices for ${r.name} (${(newVoicesByReader[r.id]?.length || 0)}/${newPages.length})`}
                />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setAddingPages(false)}>Cancel</button>
              <button
                onClick={submitNewPages}
                disabled={newPages.length === 0 || book.readers.some((r) => (newVoicesByReader[r.id]?.length || 0) !== newPages.length)}
                style={{ background: '#0a84ff', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {(events.length > 0 || done) && (
        <ProgressOverlay
          events={events}
          done={done}
          error={error}
          onClose={() => { setEvents([]); setDone(false); setError(null); }}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/client/screens/EditBook.tsx
git commit -m "tools/book-import: EditBook screen with rename, replace, add-reader, append-pages"
```

---

## Task 18: PreviewOverlay screen

**Files:**
- Modify: `tools/book-import/client/screens/PreviewOverlay.tsx`

- [ ] **Step 1: Implement**

Replace `tools/book-import/client/screens/PreviewOverlay.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { listBooks, BookSummary } from '../api';

interface Props { bookId: string; onClose: () => void; }

export const PreviewOverlay: React.FC<Props> = ({ bookId, onClose }) => {
  const [book, setBook] = useState<BookSummary | null>(null);
  const [readerId, setReaderId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    listBooks().then((books) => {
      const b = books.find((x) => x.id === bookId);
      if (b) {
        setBook(b);
        if (b.readers.length > 0) setReaderId(b.readers[0].id);
      }
    });
  }, [bookId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [currentPage, readerId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!book) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentPage((p) => (p + 1) % book.pageCount);
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage((p) => Math.max(0, p - 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [book, onClose]);

  if (!book || !readerId) return <div>Loading preview...</div>;

  const pageNN = String(currentPage + 1).padStart(2, '0');

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 12, background: '#1c1c1e', color: '#fff', display: 'flex', gap: 12, alignItems: 'center' }}>
        <strong>{book.title}</strong>
        {book.readers.length > 1 && (
          <select value={readerId} onChange={(e) => { setReaderId(e.target.value); setCurrentPage(0); }} style={{ padding: 4 }}>
            {book.readers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <span style={{ marginLeft: 'auto' }}>Page {currentPage + 1} / {book.pageCount}</span>
        <button onClick={onClose} style={{ background: '#3a3a3c', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4 }}>× Close</button>
      </div>
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        onClick={() => book && setCurrentPage((p) => (p + 1) % book.pageCount)}
        onContextMenu={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(0, p - 1)); }}
      >
        <img
          src={`/assets/books/${bookId}/pages/page-${pageNN}.png`}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
      <audio ref={audioRef} src={`/assets/books/${bookId}/voices/${readerId}/page-${pageNN}.mp3`} autoPlay />
      <div style={{ padding: 8, background: '#1c1c1e', color: '#888', fontSize: 12, textAlign: 'center' }}>
        Click image or → to advance • Right-click or ← to go back • Esc to close
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add tools/book-import/client/screens/PreviewOverlay.tsx
git commit -m "tools/book-import: PreviewOverlay screen with tap/arrow navigation"
```

---

## Task 19: Dev runner + browser open + root npm script

**Files:**
- Create: `tools/book-import/scripts/dev.mjs`
- Modify: root `package.json`

- [ ] **Step 1: Create the dev runner**

```bash
mkdir -p tools/book-import/scripts
```

`tools/book-import/scripts/dev.mjs`:

```js
#!/usr/bin/env node
import { spawn } from 'node:child_process';
import open from 'open';

const server = spawn('npm', ['run', 'dev:server'], { stdio: 'inherit', shell: true });
const client = spawn('npm', ['run', 'dev:client'], { stdio: 'inherit', shell: true });

const SERVER_URL = 'http://127.0.0.1:5174/';
setTimeout(() => {
  open(SERVER_URL).catch(() => {
    console.log(`Open ${SERVER_URL} in your browser.`);
  });
}, 1500);

const shutdown = () => {
  server.kill();
  client.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

Wait — the URL needs to be the Vite client, not the API. Let me check the architecture again.

The frontend runs on Vite at 5175. The API runs on Express at 5174. Vite proxies /api and /assets through to 5174. So users open Vite (5175) in their browser.

Update the URL:

```js
const CLIENT_URL = 'http://127.0.0.1:5175/';
setTimeout(() => {
  open(CLIENT_URL).catch(() => {
    console.log(`Open ${CLIENT_URL} in your browser.`);
  });
}, 1500);
```

- [ ] **Step 2: Add root book-tool script**

Modify root `package.json` to add a new script:

```json
{
  "scripts": {
    "...existing": "...",
    "book-tool": "cd tools/book-import && npm run dev"
  }
}
```

(Add as a new line in the existing `scripts` object — don't replace what's there.)

- [ ] **Step 3: Test the runner**

```bash
npm run book-tool
```

Expected: opens the default browser to `http://127.0.0.1:5175/`. The book list page shows current registered books (or "No books yet"). Ctrl+C stops both processes cleanly.

- [ ] **Step 4: Commit**

```bash
git add tools/book-import/scripts/dev.mjs package.json
git commit -m "tools/book-import: dev runner + root book-tool script"
```

---

## Task 20: README smoke checklist

**Files:**
- Create: `tools/book-import/README.md`

- [ ] **Step 1: Write README**

`tools/book-import/README.md`:

```md
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
```

- [ ] **Step 2: Commit**

```bash
git add tools/book-import/README.md
git commit -m "tools/book-import: README with smoke checklist and architecture summary"
```

---

## Self-Review

Checked against spec sections:

- **Goal / non-goals** — Task 1 (scaffold) sets the boundary; Task 20 (README) documents it.
- **Architecture (Express + Vite, 5174/5175)** — Tasks 6 (server), 13 (Vite), 19 (runner).
- **Book list screen** — Task 15.
- **Add-book wizard** — Task 16 (title + book/reader id derivation via `toId`, drop zones for pages/voices/cover, drag-reorder, keep-tail per voice, progress overlay).
- **Edit-book screen** — Task 17 (title/reader rename, replace single page image, replace single audio, add-reader sub-flow, append-pages sub-flow).
- **Preview overlay** — Task 18 (full-screen, contentFit:contain, click + arrow + escape, reader picker, loops at end).
- **Backend API** — GET (Task 6), POST add (Task 7), SSE (Task 8), DELETE (Task 9), PATCH (Task 10), POST readers (Task 11), POST + PUT pages (Task 12), static serving (Task 6).
- **Validation rules** — Task 2 (TDD'd pure logic) + enforced in each route handler.
- **Files** — Repo layout in Task 1 matches the spec.
- **Tech stack** — Express + Multer + spawn + React + Vite per Task 1's package.json.
- **Error handling** — pipeline scripts that fail bubble up via SSE; tmp files always cleaned in the `finally`.
- **Testing strategy** — TDD on validation (Task 2) + registry (Task 3); manual smoke checklist (Task 20).
- **Out-of-scope items** — none of the deferred ops (reorder, mid-book remove) get a task.

No placeholders, no TBDs. Type names (`BookSummary`, `PipelineEvent`, `toId`, `validateBookId`, etc.) consistent across server and client. Function signatures for the pipeline (`runBookPage`, `runBookVoice`, `runBookCover`, `runBookRegister`) match between definition (Task 4) and usage (Tasks 7, 9, 10, 11, 12).

One thing the spec implies but the plan resolves explicitly: **the SSE stream is opened by the client only after receiving `{ jobId }` from the POST/PUT/DELETE response.** All client API helpers return `string` (the jobId) so the caller knows when the job exists.
