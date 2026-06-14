import express from 'express';
import multer from 'multer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadTitles, loadTitle, createTitle, renameTitle, setTitleCover, deleteTitle, slugify,
  TitleNotFoundError, TitleIdConflictError, TitleInUseError,
} from '../titles.js';
import { readingsReferencingTitle } from '../readings.js';
import { withTitleLock } from '../locks.js';
import { runBookCover, runBookRegister } from '../pipeline.js';

const upload = multer({ storage: multer.memoryStorage() });

export function makeTitlesRouter(repoRoot: string): express.Router {
  const r = express.Router();
  const safeId = (id: string) => /^[a-z0-9-]+$/.test(id);

  r.get('/', (_req, res) => {
    res.json({ titles: loadTitles(repoRoot) });
  });

  r.get('/:id', (req, res) => {
    if (!safeId(req.params.id)) return res.status(404).json({ error: 'not found' });
    const t = loadTitle(repoRoot, req.params.id);
    if (!t) return res.status(404).json({ error: 'not found' });
    res.json({ title: t });
  });

  r.post('/', async (req, res, next) => {
    try {
      const displayName = String(req.body.displayName ?? '').trim();
      if (!displayName) return res.status(400).json({ error: 'displayName required' });
      const t = await withTitleLock(slugify(displayName), () => createTitle(repoRoot, displayName));
      try { await runBookRegister(repoRoot, () => {}); } catch {}
      res.status(201).json({ title: t });
    } catch (err) {
      if (err instanceof TitleIdConflictError) return res.status(409).json({ error: err.message });
      next(err);
    }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      if (!safeId(req.params.id)) return res.status(404).json({ error: 'not found' });
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
      if (!safeId(req.params.id)) return res.status(404).json({ error: 'not found' });
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'file required' });
      const tmpIn = path.join(os.tmpdir(), `cover-in-${Date.now()}-${file.originalname}`);
      fs.writeFileSync(tmpIn, file.buffer);
      const t = await withTitleLock(req.params.id, async () => {
        const outPath = path.join(repoRoot, 'assets', 'titles', req.params.id, 'cover.png');
        await runBookCover(repoRoot, tmpIn, outPath, () => {});
        const updated = await setTitleCover(repoRoot, req.params.id, outPath);
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
      if (!safeId(req.params.id)) return res.status(404).json({ error: 'not found' });
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
