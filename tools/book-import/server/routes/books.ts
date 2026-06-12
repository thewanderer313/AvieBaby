import { Router } from 'express';
import { listBooks } from '../registry.js';

export function makeBooksRouter(repoRoot: string): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ books: listBooks(repoRoot) });
  });

  return router;
}
