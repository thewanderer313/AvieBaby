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
