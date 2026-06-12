import { Router } from 'express';
import multer from 'multer';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { listBooks, writeBookInfo, loadBookInfo } from '../registry.js';
import {
  validateBookId,
  validateReaderId,
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
  MAX_PAGES,
} from '../validation.js';
import {
  runBookPage,
  runBookVoice,
  runBookCover,
  runBookRegister,
} from '../pipeline.js';
import { createJob } from '../jobs.js';

const tmpDir = path.join(os.tmpdir(), 'aviebaby-book-import');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir });

interface AddBookFields {
  title: string;
  bookId: string;
  readerName: string;
  readerId: string;
  keepTail: string; // JSON-encoded array of booleans
}

export function makeBooksRouter(repoRoot: string): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ books: listBooks(repoRoot) });
  });

  router.post(
    '/',
    upload.fields([
      { name: 'pages', maxCount: MAX_PAGES },
      { name: 'voices', maxCount: MAX_PAGES },
      { name: 'cover', maxCount: 1 },
    ]),
    async (req, res) => {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const fields = req.body as AddBookFields;
      const pages = (files.pages || []).sort((a, b) =>
        a.originalname.localeCompare(b.originalname),
      );
      const voices = (files.voices || []).sort((a, b) =>
        a.originalname.localeCompare(b.originalname),
      );
      const cover = files.cover?.[0];

      const existingIds = listBooks(repoRoot).map((b) => b.id);
      const bookIdError = validateBookId(fields.bookId, existingIds);
      if (bookIdError) return res.status(400).json({ error: bookIdError });

      const readerIdError = validateReaderId(fields.readerId, []);
      if (readerIdError) return res.status(400).json({ error: readerIdError });

      if (pages.length === 0) return res.status(400).json({ error: 'At least one page is required.' });
      if (pages.length !== voices.length) {
        return res.status(400).json({
          error: `You have ${pages.length} pages but ${voices.length} voices; they must match.`,
        });
      }
      for (const p of pages) {
        if (p.size > MAX_IMAGE_BYTES)
          return res.status(400).json({ error: `Page "${p.originalname}" exceeds the 10 MB image limit.` });
      }
      for (const v of voices) {
        if (v.size > MAX_AUDIO_BYTES)
          return res.status(400).json({ error: `Voice "${v.originalname}" exceeds the 20 MB audio limit.` });
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

      (async () => {
        try {
          for (let i = 0; i < pages.length; i++) {
            const pageNum = i + 1;
            const isFirst = i === 0;
            await runBookPage(
              repoRoot,
              pages[i].path,
              fields.bookId,
              pageNum,
              isFirst ? fields.title : null,
              job.emit,
            );
          }
          for (let i = 0; i < voices.length; i++) {
            const pageNum = i + 1;
            const isFirst = i === 0;
            await runBookVoice(
              repoRoot,
              voices[i].path,
              fields.bookId,
              fields.readerId,
              pageNum,
              isFirst ? fields.readerName : null,
              keepTailFlags[i] === true,
              job.emit,
            );
          }
          if (cover) {
            await runBookCover(repoRoot, cover.path, fields.bookId, job.emit);
          }
          await runBookRegister(repoRoot, job.emit);
          job.finish(true);
        } catch (err) {
          job.finish(false, err instanceof Error ? err.message : String(err));
        } finally {
          for (const f of [...pages, ...voices, ...(cover ? [cover] : [])]) {
            fs.unlink(f.path, () => {});
          }
        }
      })();
    },
  );

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { confirmation } = req.body as { confirmation?: string };

    const books = listBooks(repoRoot);
    const book = books.find((b) => b.id === id);
    if (!book) return res.status(404).json({ error: `Book "${id}" not found.` });

    if (confirmation !== book.title) {
      return res.status(400).json({
        error: `Confirmation must match the book title exactly ("${book.title}").`,
      });
    }

    const job = createJob();
    res.json({ jobId: job.id });

    (async () => {
      try {
        job.emit({ step: 'delete', status: 'started' });
        const bookDir = path.join(repoRoot, 'assets', 'books', id);
        fs.rmSync(bookDir, { recursive: true, force: true });
        job.emit({ step: 'delete', status: 'succeeded' });
        await runBookRegister(repoRoot, job.emit);
        job.finish(true);
      } catch (err) {
        job.finish(false, err instanceof Error ? err.message : String(err));
      }
    })();
  });

  router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, readers } = req.body as {
      title?: string;
      readers?: Record<string, string>;
    };

    const books = listBooks(repoRoot);
    const book = books.find((b) => b.id === id);
    if (!book) return res.status(404).json({ error: `Book "${id}" not found.` });

    const info = loadBookInfo(repoRoot, id);
    if (typeof title === 'string' && title.length > 0) info.title = title;
    if (readers && typeof readers === 'object') {
      for (const [rid, name] of Object.entries(readers)) {
        if (typeof name === 'string' && name.length > 0) info.readers[rid] = name;
      }
    }
    writeBookInfo(repoRoot, id, info);

    const job = createJob();
    res.json({ jobId: job.id });

    (async () => {
      try {
        await runBookRegister(repoRoot, job.emit);
        job.finish(true);
      } catch (err) {
        job.finish(false, err instanceof Error ? err.message : String(err));
      }
    })();
  });

  return router;
}
