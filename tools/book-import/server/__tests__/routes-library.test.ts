import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeLibraryRouter } from '../routes/library.js';

function setupApp(): { app: express.Express; repo: string } {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-routes-lib-'));
  mkdirSync(path.join(repo, 'assets', 'library', 'images'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'library', 'audio'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'readings'), { recursive: true });
  writeFileSync(path.join(repo, 'assets', 'library', 'library.json'), '{"assets":[]}');
  const app = express();
  app.use(express.json());
  app.use('/api/library', makeLibraryRouter(repo));
  return { app, repo };
}

describe('library routes', () => {
  let app: express.Express; let repo: string;
  beforeEach(() => { ({ app, repo } = setupApp()); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('GET /api/library returns empty assets list', async () => {
    const res = await request(app).get('/api/library');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ assets: [] });
  });

  test('DELETE /api/library/:id returns 404 for missing asset', async () => {
    const res = await request(app).delete('/api/library/img-9999');
    expect(res.status).toBe(404);
  });
});
