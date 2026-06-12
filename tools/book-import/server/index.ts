import express from 'express';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBooksRouter } from './routes/books.js';

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

app.listen(PORT, HOST, () => {
  console.log(`Book import server listening on http://${HOST}:${PORT}`);
});
