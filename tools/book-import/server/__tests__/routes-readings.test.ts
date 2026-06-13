import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeReadingsRouter } from '../routes/readings.js';

function setup(): { app: express.Express; repo: string } {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'aviebaby-routes-rdg-'));
  mkdirSync(path.join(repo, 'assets', 'readings'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'library', 'images'), { recursive: true });
  mkdirSync(path.join(repo, 'assets', 'library', 'audio'), { recursive: true });
  writeFileSync(
    path.join(repo, 'assets', 'library', 'library.json'),
    JSON.stringify({
      assets: [
        { id: 'img-0001', type: 'image', source: 'X', filename: 'img-0001.png' },
        { id: 'aud-0001', type: 'audio', source: 'X', reader: 'R', filename: 'aud-0001.mp3' },
      ],
    }),
  );
  const app = express();
  app.use(express.json());
  app.use('/api/readings', makeReadingsRouter(repo));
  return { app, repo };
}

describe('reading routes', () => {
  let app: express.Express; let repo: string;
  beforeEach(() => { ({ app, repo } = setup()); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  test('GET /api/readings empty', async () => {
    const res = await request(app).get('/api/readings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ readings: [] });
  });

  test('POST /api/readings creates', async () => {
    const res = await request(app).post('/api/readings').send({
      titleId: 'x', reader: 'R',
      pages: [{ image: 'img-0001', audio: 'aud-0001' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.reading.id).toBe('rdg-0001');
  });

  test('POST /api/readings 400 missing fields', async () => {
    const res = await request(app).post('/api/readings').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/readings 400 invalid asset id', async () => {
    const res = await request(app).post('/api/readings').send({
      titleId: 'x', reader: 'R',
      pages: [{ image: 'img-9999', audio: 'aud-0001' }],
    });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/readings/:id replaces', async () => {
    const create = await request(app).post('/api/readings').send({
      titleId: 'x', reader: 'R', pages: [],
    });
    const id = create.body.reading.id;
    const res = await request(app).patch(`/api/readings/${id}`).send({
      titleId: 'y', reader: 'M', pages: [{ image: 'img-0001', audio: 'aud-0001' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.reading.titleId).toBe('y');
    expect(res.body.reading.pages).toHaveLength(1);
  });

  test('DELETE /api/readings/:id', async () => {
    const create = await request(app).post('/api/readings').send({
      titleId: 'x', reader: 'R', pages: [],
    });
    const id = create.body.reading.id;
    const res = await request(app).delete(`/api/readings/${id}`);
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/readings');
    expect(list.body.readings).toHaveLength(0);
  });
});
