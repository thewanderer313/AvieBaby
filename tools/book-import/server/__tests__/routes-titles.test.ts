import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeTitlesRouter } from '../routes/titles.js';

function setup(): { app: express.Express; repo: string } {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-routes-titles-'));
  mkdirSync(path.join(repo, 'assets', 'titles'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'readings'), { recursive: true });
  const app = express();
  app.use(express.json());
  app.use('/api/titles', makeTitlesRouter(repo));
  return { app, repo };
}

describe('title routes', () => {
  let app: express.Express; let repo: string;
  beforeEach(() => { ({ app, repo } = setup()); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('GET /api/titles empty list', async () => {
    const res = await request(app).get('/api/titles');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ titles: [] });
  });

  test('POST /api/titles creates', async () => {
    const res = await request(app).post('/api/titles').send({ displayName: 'Goodnight Moon' });
    expect(res.status).toBe(201);
    expect(res.body.title.id).toBe('goodnight-moon');
  });

  test('POST /api/titles 400 on empty displayName', async () => {
    const res = await request(app).post('/api/titles').send({ displayName: '' });
    expect(res.status).toBe(400);
  });

  test('POST /api/titles 409 on duplicate slug', async () => {
    await request(app).post('/api/titles').send({ displayName: 'X' });
    const res = await request(app).post('/api/titles').send({ displayName: 'X' });
    expect(res.status).toBe(409);
  });

  test('PATCH /api/titles/:id renames', async () => {
    await request(app).post('/api/titles').send({ displayName: 'Original' });
    const res = await request(app).patch('/api/titles/original').send({ displayName: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title.displayName).toBe('New');
  });

  test('DELETE /api/titles/:id succeeds when no readings reference it', async () => {
    await request(app).post('/api/titles').send({ displayName: 'X' });
    const res = await request(app).delete('/api/titles/x');
    expect(res.status).toBe(200);
  });

  test('DELETE /api/titles/:id 404 unknown', async () => {
    const res = await request(app).delete('/api/titles/nope');
    expect(res.status).toBe(404);
  });
});
