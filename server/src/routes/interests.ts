import { Router } from 'express';
import { z } from 'zod';
import { query, toVector } from '../db/pool.js';
import { HttpError, parseId, requireAuth } from '../lib/http.js';
import { embedOne } from '../providers/embeddings.js';

export const interestsRouter = Router();
interestsRouter.use(requireAuth);

interestsRouter.get('/', async (req, res) => {
  const rows = await query('SELECT id, topic FROM interests WHERE user_id = $1 ORDER BY id', [req.user!.id]);
  res.json({ interests: rows });
});

const body = z.object({ topic: z.string().trim().min(2).max(80) });

interestsRouter.post('/', async (req, res) => {
  const { topic } = body.parse(req.body);
  const [{ n }] = await query('SELECT count(*)::int AS n FROM interests WHERE user_id = $1', [req.user!.id]);
  if (n >= 20) throw new HttpError(400, 'You can follow up to 20 topics');
  const vec = await embedOne(topic);
  const rows = await query(
    `INSERT INTO interests (user_id, topic, embedding) VALUES ($1,$2,$3::vector)
     ON CONFLICT (user_id, topic) DO UPDATE SET topic = EXCLUDED.topic RETURNING id, topic`,
    [req.user!.id, topic, toVector(vec)],
  );
  res.status(201).json({ interest: rows[0] });
});

interestsRouter.delete('/taste', async (req, res) => {
  await query('UPDATE users SET taste = NULL WHERE id = $1', [req.user!.id]);
  await query('DELETE FROM feedback WHERE user_id = $1', [req.user!.id]);
  res.status(204).end();
});

interestsRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM interests WHERE id = $1 AND user_id = $2', [parseId(req.params.id), req.user!.id]);
  res.status(204).end();
});
