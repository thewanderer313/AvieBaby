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
