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

export async function setAssetArchived(
  repoRoot: string,
  id: string,
  archived: boolean,
): Promise<Asset> {
  const lib = loadLibrary(repoRoot);
  const idx = lib.assets.findIndex((a) => a.id === id);
  if (idx === -1) throw new AssetNotFoundError(`No asset with id ${id}`);
  const next = { ...lib.assets[idx], archived } as Asset;
  lib.assets[idx] = next;
  writeLibraryAtomic(repoRoot, lib);
  return next;
}
