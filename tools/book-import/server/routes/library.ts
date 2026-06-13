import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadLibrary, addImageAsset, addAudioAsset, deleteAsset,
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
              lib.assets.push({ id, type: 'image', source, filename: `${id}.png` });
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
              await runBookVoice(
                repoRoot, tmpIn, '__staging__', '__r__', i + 1, null, keepTail, job.emit,
              );
              const stagedPath = path.join(
                repoRoot, 'assets', 'books', '__staging__', 'voices',
                '__r__', `page-${String(i + 1).padStart(2, '0')}.mp3`,
              );
              await addAudioAsset(repoRoot, source, reader, stagedPath);
              fs.rmSync(stagedPath, { force: true });
              fs.rmSync(tmpIn, { force: true });
            }
            fs.rmSync(path.join(repoRoot, 'assets', 'books'), { recursive: true, force: true });
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
