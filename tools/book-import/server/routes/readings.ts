import express from 'express';
import {
  loadReadings, loadReading, createReading, updateReading, deleteReading,
  ReadingNotFoundError, ReadingValidationError,
} from '../readings.js';
import { loadLibrary, findAsset } from '../library.js';
import { withReadingLock } from '../locks.js';
import { runBookRegister } from '../pipeline.js';

export function makeReadingsRouter(repoRoot: string): express.Router {
  const r = express.Router();
  const assetExists = (id: string) => findAsset(loadLibrary(repoRoot), id) !== null;

  r.get('/', (_req, res) => {
    res.json({ readings: loadReadings(repoRoot) });
  });

  r.get('/:id', (req, res) => {
    const reading = loadReading(repoRoot, req.params.id);
    if (!reading) return res.status(404).json({ error: 'not found' });
    res.json({ reading });
  });

  r.post('/', async (req, res, next) => {
    try {
      const { titleId, reader, pages } = req.body ?? {};
      const reading = await createReading(
        repoRoot,
        { titleId, reader, pages: Array.isArray(pages) ? pages : [] },
        assetExists,
      );
      try { await runBookRegister(repoRoot, () => {}); } catch {}
      res.status(201).json({ reading });
    } catch (err) {
      if (err instanceof ReadingValidationError) return res.status(400).json({ error: (err as Error).message });
      next(err);
    }
  });

  r.patch('/:id', async (req, res, next) => {
    try {
      const { titleId, reader, pages } = req.body ?? {};
      const reading = await withReadingLock(req.params.id, () =>
        updateReading(
          repoRoot, req.params.id,
          { titleId, reader, pages: Array.isArray(pages) ? pages : [] },
          assetExists,
        ),
      );
      try { await runBookRegister(repoRoot, () => {}); } catch {}
      res.json({ reading });
    } catch (err) {
      if (err instanceof ReadingNotFoundError) return res.status(404).json({ error: (err as Error).message });
      if (err instanceof ReadingValidationError) return res.status(400).json({ error: (err as Error).message });
      next(err);
    }
  });

  r.delete('/:id', async (req, res, next) => {
    try {
      await withReadingLock(req.params.id, () => deleteReading(repoRoot, req.params.id));
      try { await runBookRegister(repoRoot, () => {}); } catch {}
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ReadingNotFoundError) return res.status(404).json({ error: (err as Error).message });
      next(err);
    }
  });

  return r;
}
