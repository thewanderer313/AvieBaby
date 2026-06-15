import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadLibrary, deleteAsset, setAssetArchived, renameAsset,
  AssetNotFoundError, AssetInUseError,
} from '../library.js';
import { readingsReferencingAsset } from '../readings.js';
import { withLibraryLock } from '../locks.js';
import { createJob } from '../jobs.js';
import { runBookPage, runBookVoice, runBookRegister } from '../pipeline.js';

const upload = multer({ storage: multer.memoryStorage() });

export function makeLibraryRouter(repoRoot: string): express.Router {
  const r = express.Router();

  r.get('/', (_req, res) => {
    res.json(loadLibrary(repoRoot));
  });

  r.post(
    '/images',
    upload.array('files'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const source = String(req.body.source ?? '').trim();
        if (!source) return res.status(400).json({ error: 'source required' });
        if (files.length === 0) return res.status(400).json({ error: 'no files' });

        const job = createJob();
        res.status(202).json({ jobId: job.id });

        void withLibraryLock(async () => {
          try {
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              const tmpIn = path.join(os.tmpdir(), `img-in-${Date.now()}-${i}-${f.originalname}`);
              fs.writeFileSync(tmpIn, f.buffer);
              const lib = loadLibrary(repoRoot);
              const id = `img-${String(
                Math.max(0, ...lib.assets.filter((a) => a.id.startsWith('img-')).map((a) => Number(a.id.slice(4)))) + 1,
              ).padStart(4, '0')}`;
              const outPath = path.join(repoRoot, 'assets', 'library', 'images', `${id}.png`);
              await runBookPage(repoRoot, tmpIn, outPath, job.emit);
              lib.assets.push({ id, type: 'image', source, filename: `${id}.png`, originalName: f.originalname });
              fs.writeFileSync(
                path.join(repoRoot, 'assets', 'library', 'library.json'),
                JSON.stringify(lib, null, 2) + '\n',
              );
              fs.rmSync(tmpIn, { force: true });
            }
            await runBookRegister(repoRoot, job.emit);
            job.finish(true);
          } catch (err) {
            job.emit({ step: 'pipeline', status: 'failed', stderr: (err as Error).message });
            job.finish(false, (err as Error).message);
          }
        });
      } catch (err) {
        next(err);
      }
    },
  );

  r.post(
    '/audio',
    upload.array('files'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const source = String(req.body.source ?? '').trim();
        const reader = String(req.body.reader ?? '').trim();
        const keepTail = String(req.body.keepTail ?? 'false') === 'true';
        if (!source) return res.status(400).json({ error: 'source required' });
        if (!reader) return res.status(400).json({ error: 'reader required' });
        if (files.length === 0) return res.status(400).json({ error: 'no files' });

        const job = createJob();
        res.status(202).json({ jobId: job.id });

        void withLibraryLock(async () => {
          try {
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              const tmpIn = path.join(os.tmpdir(), `aud-in-${Date.now()}-${i}-${f.originalname}`);
              fs.writeFileSync(tmpIn, f.buffer);
              const lib = loadLibrary(repoRoot);
              const id = `aud-${String(
                Math.max(0, ...lib.assets.filter((a) => a.id.startsWith('aud-')).map((a) => Number(a.id.slice(4)))) + 1,
              ).padStart(4, '0')}`;
              const outPath = path.join(repoRoot, 'assets', 'library', 'audio', `${id}.mp3`);
              await runBookVoice(repoRoot, tmpIn, outPath, keepTail, job.emit);
              lib.assets.push({ id, type: 'audio', source, reader, filename: `${id}.mp3`, originalName: f.originalname });
              fs.writeFileSync(
                path.join(repoRoot, 'assets', 'library', 'library.json'),
                JSON.stringify(lib, null, 2) + '\n',
              );
              fs.rmSync(tmpIn, { force: true });
            }
            await runBookRegister(repoRoot, job.emit);
            job.finish(true);
          } catch (err) {
            job.emit({ step: 'pipeline', status: 'failed', stderr: (err as Error).message });
            job.finish(false, (err as Error).message);
          }
        });
      } catch (err) {
        next(err);
      }
    },
  );

  r.patch('/:id', express.json(), async (req, res, next) => {
    try {
      const { archived, originalName } = req.body ?? {};
      const hasArchived = typeof archived === 'boolean';
      const hasName = typeof originalName === 'string';
      if (!hasArchived && !hasName) {
        return res.status(400).json({ error: 'archived (boolean) or originalName (string) required' });
      }
      if (hasName && originalName.trim().length === 0) {
        return res.status(400).json({ error: 'originalName cannot be empty' });
      }
      let asset = null;
      await withLibraryLock(async () => {
        if (hasArchived) asset = await setAssetArchived(repoRoot, req.params.id, archived);
        if (hasName) asset = await renameAsset(repoRoot, req.params.id, originalName.trim());
      });
      res.json({ asset });
    } catch (err) {
      if (err instanceof AssetNotFoundError) return res.status(404).json({ error: err.message });
      next(err);
    }
  });

  r.delete('/:id', async (req, res, next) => {
    try {
      await withLibraryLock(async () => {
        await deleteAsset(repoRoot, req.params.id, (id) => readingsReferencingAsset(repoRoot, id));
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof AssetNotFoundError) return res.status(404).json({ error: err.message });
      if (err instanceof AssetInUseError)
        return res.status(409).json({ error: err.message, referencedBy: err.references });
      next(err);
    }
  });

  return r;
}
