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
