import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { query } from './db/pool.js';
import { errorHandler } from './lib/http.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { feedRouter } from './routes/feed.js';
import { interestsRouter } from './routes/interests.js';
import { teamsRouter } from './routes/teams.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    await query('SELECT 1');
    res.json({ ok: true });
  });

  app.get('/api/stats', async (_req, res) => {
    const [row] = await query(`
      SELECT (SELECT count(*)::int FROM articles) AS articles,
             (SELECT count(*)::int FROM story_threads) AS threads,
             (SELECT count(*)::int FROM sources WHERE enabled) AS sources,
             (SELECT max(finished_at) FROM ingest_runs) AS last_ingest`);
    res.json(row);
  });

  app.use('/api/auth', authRouter);
  app.use('/api/interests', interestsRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', feedRouter);
  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found' }));

  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
    app.use((_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
