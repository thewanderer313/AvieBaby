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
