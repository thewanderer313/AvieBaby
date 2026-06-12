import express from 'express';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBooksRouter } from './routes/books.js';
import { getJob } from './jobs.js';
import type { PipelineEvent } from './pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const PORT = Number(process.env.PORT || 5174);
const HOST = '127.0.0.1';

const app = express();
app.use(express.json());

app.use('/api/books', makeBooksRouter(REPO_ROOT));

app.use(
  '/assets/books',
  express.static(path.join(REPO_ROOT, 'assets', 'books')),
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, repoRoot: REPO_ROOT });
});

app.get('/api/jobs/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  for (const event of job.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  const onEvent = (event: PipelineEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.step === 'done') {
      res.end();
    }
  };

  job.emitter.on('event', onEvent);
  req.on('close', () => {
    job.emitter.off('event', onEvent);
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Book import server listening on http://${HOST}:${PORT}`);
});
