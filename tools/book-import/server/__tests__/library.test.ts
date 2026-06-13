import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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
  mkdirSync(path.join(libDir, 'images'), { recursive: true });
  mkdirSync(path.join(libDir, 'audio'), { recursive: true });
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
      deleteAsset(repo, asset.id, () => [{ readingId: 'rdg-0001', titleId: 't' }]),
    ).rejects.toThrow(AssetInUseError);
  });

  test('deleteAsset throws AssetNotFoundError for unknown id', async () => {
    await expect(deleteAsset(repo, 'img-9999', () => [])).rejects.toThrow(AssetNotFoundError);
  });
});
