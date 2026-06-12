import { Router } from 'express';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { listBooks } from '../registry.js';
import { MAX_IMAGE_BYTES, MAX_AUDIO_BYTES, MAX_PAGES } from '../validation.js';
import { runBookPage, runBookVoice, runBookRegister } from '../pipeline.js';
import { createJob } from '../jobs.js';
import { withBookLock } from '../locks.js';

const tmpDir = path.join(os.tmpdir(), 'aviebaby-book-import');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir });

export function makePagesRouter(repoRoot: string): Router {
  const router = Router({ mergeParams: true });

  // Append new pages at the end.
  router.post(
    '/',
    upload.any(),
    async (req, res) => {
      const bookId = req.params.id;
      const books = listBooks(repoRoot);
      const book = books.find((b) => b.id === bookId);
      if (!book) return res.status(404).json({ error: `Book "${bookId}" not found.` });

      const files = req.files as Express.Multer.File[];
      const pages = files
        .filter((f) => f.fieldname.startsWith('page-'))
        .sort((a, b) => a.fieldname.localeCompare(b.fieldname));
      const voicesByReader: Record<string, Express.Multer.File[]> = {};
      for (const f of files) {
        // Greedy capture: voice-<reader-id>-<page-num>. Reader IDs can contain dashes
        // (e.g., "uncle-ryan"), so we match the page number as the trailing digit
        // segment and treat everything between "voice-" and "-NN" as the reader id.
        const match = f.fieldname.match(/^voice-(.+)-(\d+)$/);
        if (match) {
          const rid = match[1];
          if (!voicesByReader[rid]) voicesByReader[rid] = [];
          voicesByReader[rid].push(f);
        }
      }
      for (const rid of Object.keys(voicesByReader)) {
        voicesByReader[rid].sort((a, b) => a.fieldname.localeCompare(b.fieldname));
      }

      if (pages.length === 0)
        return res.status(400).json({ error: 'At least one page image required.' });
      for (const r of book.readers) {
        const got = voicesByReader[r.id]?.length || 0;
        if (got !== pages.length) {
          return res.status(400).json({
            error: `Reader "${r.id}" needs ${pages.length} new voice clips; got ${got}.`,
          });
        }
      }

      const startingPage = book.pageCount + 1;
      const job = createJob();
      res.json({ jobId: job.id });

      withBookLock(bookId, async () => {
        try {
          for (let i = 0; i < pages.length; i++) {
            await runBookPage(
              repoRoot,
              pages[i].path,
              bookId,
              startingPage + i,
              null,
              job.emit,
            );
          }
          for (const r of book.readers) {
            const voices = voicesByReader[r.id];
            for (let i = 0; i < voices.length; i++) {
              await runBookVoice(
                repoRoot,
                voices[i].path,
                bookId,
                r.id,
                startingPage + i,
                null,
                false,
                job.emit,
              );
            }
          }
          await runBookRegister(repoRoot, job.emit);
          job.finish(true);
        } catch (err) {
          job.finish(false, err instanceof Error ? err.message : String(err));
        } finally {
          for (const f of files) fs.unlink(f.path, () => {});
        }
      }).catch(() => {/* finish() already reported the error */});
    },
  );

  // Replace a single page image.
  router.put('/:n/image', upload.single('image'), async (req, res) => {
    const bookId = req.params.id;
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGES)
      return res.status(400).json({ error: 'Page number out of range.' });

    const books = listBooks(repoRoot);
    const book = books.find((b) => b.id === bookId);
    if (!book) return res.status(404).json({ error: `Book "${bookId}" not found.` });
    if (n > book.pageCount)
      return res.status(400).json({ error: `Page ${n} does not exist in this book.` });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Missing image file.' });
    if (file.size > MAX_IMAGE_BYTES)
      return res.status(400).json({ error: 'Image too large.' });

    const job = createJob();
    res.json({ jobId: job.id });

    withBookLock(bookId, async () => {
      try {
        await runBookPage(repoRoot, file.path, bookId, n, null, job.emit);
        await runBookRegister(repoRoot, job.emit);
        job.finish(true);
      } catch (err) {
        job.finish(false, err instanceof Error ? err.message : String(err));
      } finally {
        fs.unlink(file.path, () => {});
      }
    }).catch(() => {/* finish() already reported the error */});
  });

  // Replace a single audio file.
  router.put('/:n/voices/:readerId', upload.single('voice'), async (req, res) => {
    const bookId = req.params.id;
    const readerId = req.params.readerId;
    const n = Number(req.params.n);
    const keepTail = req.body.keepTail === 'true';
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGES)
      return res.status(400).json({ error: 'Page number out of range.' });

    const books = listBooks(repoRoot);
    const book = books.find((b) => b.id === bookId);
    if (!book) return res.status(404).json({ error: `Book "${bookId}" not found.` });
    if (!book.readers.find((r) => r.id === readerId))
      return res.status(404).json({ error: `Reader "${readerId}" not in this book.` });
    if (n > book.pageCount)
      return res.status(400).json({ error: `Page ${n} does not exist.` });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Missing voice file.' });
    if (file.size > MAX_AUDIO_BYTES)
      return res.status(400).json({ error: 'Voice too large.' });

    const job = createJob();
    res.json({ jobId: job.id });

    withBookLock(bookId, async () => {
      try {
        await runBookVoice(
          repoRoot,
          file.path,
          bookId,
          readerId,
          n,
          null,
          keepTail,
          job.emit,
        );
        await runBookRegister(repoRoot, job.emit);
        job.finish(true);
      } catch (err) {
        job.finish(false, err instanceof Error ? err.message : String(err));
      } finally {
        fs.unlink(file.path, () => {});
      }
    }).catch(() => {/* finish() already reported the error */});
  });

  return router;
}
