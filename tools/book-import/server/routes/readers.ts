import { Router } from 'express';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { listBooks } from '../registry.js';
import { validateReaderId, MAX_AUDIO_BYTES, MAX_PAGES } from '../validation.js';
import { runBookVoice, runBookRegister } from '../pipeline.js';
import { createJob } from '../jobs.js';
import { withBookLock } from '../locks.js';

const tmpDir = path.join(os.tmpdir(), 'aviebaby-book-import');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir });

export function makeReadersRouter(repoRoot: string): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/',
    upload.fields([{ name: 'voices', maxCount: MAX_PAGES }]),
    async (req, res) => {
      const bookId = req.params.id;
      const fields = req.body as {
        readerName: string;
        readerId: string;
        keepTail?: string;
      };
      const files = req.files as Record<string, Express.Multer.File[]>;
      const voices = (files.voices || []).sort((a, b) =>
        a.originalname.localeCompare(b.originalname),
      );

      const books = listBooks(repoRoot);
      const book = books.find((b) => b.id === bookId);
      if (!book) return res.status(404).json({ error: `Book "${bookId}" not found.` });

      const existing = book.readers.map((r) => r.id);
      const readerIdError = validateReaderId(fields.readerId, existing);
      if (readerIdError) return res.status(400).json({ error: readerIdError });

      if (voices.length !== book.pageCount) {
        return res.status(400).json({
          error: `Book has ${book.pageCount} pages; you uploaded ${voices.length} voices.`,
        });
      }
      for (const v of voices) {
        if (v.size > MAX_AUDIO_BYTES) {
          return res.status(400).json({ error: `Voice "${v.originalname}" exceeds the 20 MB limit.` });
        }
      }

      const keepTailFlags: boolean[] = (() => {
        try {
          const parsed = JSON.parse(fields.keepTail || '[]');
          return Array.isArray(parsed) ? parsed.map(Boolean) : [];
        } catch {
          return [];
        }
      })();

      const job = createJob();
      res.json({ jobId: job.id });

      withBookLock(bookId, async () => {
        try {
          for (let i = 0; i < voices.length; i++) {
            const isFirst = i === 0;
            await runBookVoice(
              repoRoot,
              voices[i].path,
              bookId,
              fields.readerId,
              i + 1,
              isFirst ? fields.readerName : null,
              keepTailFlags[i] === true,
              job.emit,
            );
          }
          await runBookRegister(repoRoot, job.emit);
          job.finish(true);
        } catch (err) {
          job.finish(false, err instanceof Error ? err.message : String(err));
        } finally {
          for (const f of voices) fs.unlink(f.path, () => {});
        }
      }).catch(() => {/* finish() already reported the error */});
    },
  );

  return router;
}
