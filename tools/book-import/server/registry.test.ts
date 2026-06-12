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
