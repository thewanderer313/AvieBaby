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
