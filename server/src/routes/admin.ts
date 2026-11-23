import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { assertPublicUrl } from '../lib/safeFetch.js';
import { HttpError, parseId, requireAdmin } from '../lib/http.js';
import { runIngest } from '../pipeline/ingest.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const sourceBody = z.object({
  name: z.string().trim().min(2).max(60),
  kind: z.enum(['rss', 'hn']),
  url: z.string().trim().url().max(500),
  weight: z.number().min(0).max(2).default(1),
  enabled: z.boolean().default(true),
});

async function checkUrl(url: string) {
  try {
    await assertPublicUrl(url);
  } catch (err) {
    throw new HttpError(400, `Source URL rejected: ${(err as Error).message}`);
  }
}

adminRouter.get('/sources', async (_req, res) => {
  const rows = await query(
    `SELECT s.id, s.name, s.kind, s.url, s.weight, s.enabled, s.last_fetched_at, s.last_error,
            (SELECT count(*)::int FROM articles a WHERE a.source_id = s.id) AS articles
       FROM sources s ORDER BY s.id`,
  );
  res.json({ sources: rows });
});

adminRouter.post('/sources', async (req, res) => {
  const body = sourceBody.parse(req.body);
  await checkUrl(body.url);
  try {
    const [row] = await query(
      'INSERT INTO sources (name, kind, url, weight, enabled) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, kind, url, weight, enabled',
      [body.name, body.kind, body.url, body.weight, body.enabled],
    );
    res.status(201).json({ source: row });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new HttpError(409, 'That source URL is already added');
    throw err;
  }
});

const patchBody = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  weight: z.number().min(0).max(2).optional(),
  enabled: z.boolean().optional(),
});

adminRouter.patch('/sources/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const body = patchBody.parse(req.body);
  const [row] = await query(
    `UPDATE sources SET name = COALESCE($2, name), weight = COALESCE($3, weight), enabled = COALESCE($4, enabled)
      WHERE id = $1 RETURNING id, name, kind, url, weight, enabled`,
    [id, body.name ?? null, body.weight ?? null, body.enabled ?? null],
  );
  if (!row) throw new HttpError(404, 'Source not found');
  res.json({ source: row });
});

adminRouter.delete('/sources/:id', async (req, res) => {
  await query('DELETE FROM sources WHERE id = $1', [parseId(req.params.id)]);
  res.status(204).end();
});

adminRouter.post('/ingest', async (_req, res) => {
  const [running] = await query(`SELECT 1 FROM ingest_runs WHERE finished_at IS NULL AND started_at > now() - interval '30 minutes'`);
  if (running) throw new HttpError(409, 'An ingest run is already in progress');
  runIngest('manual').catch((err) => console.error('manual ingest failed', err));
  res.status(202).json({ started: true });
});

adminRouter.get('/runs', async (_req, res) => {
  const rows = await query(
    `SELECT id, trigger, started_at, finished_at, fetched, inserted, clustered, errors
       FROM ingest_runs ORDER BY id DESC LIMIT 15`,
  );
  res.json({ runs: rows });
});
