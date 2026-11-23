import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool, query } from '../db/pool.js';
import { COOKIE, HttpError, optionalAuth, signToken } from '../lib/http.js';

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });

const registerBody = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(100),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

function setSession(req: any, res: any, userId: number) {
  res.cookie(COOKIE, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: 14 * 86400_000,
  });
}

authRouter.post('/register', limiter, async (req, res) => {
  const body = registerBody.parse(req.body);
  const hash = await bcrypt.hash(body.password, 11);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
    const count = Number((await client.query('SELECT count(*) FROM users')).rows[0].count);
    const { rows } = await client.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role`,
      [body.email, body.name, hash, count === 0 ? 'admin' : 'member'],
    );
    await client.query('COMMIT');
    setSession(req, res, rows[0].id);
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if ((err as { code?: string }).code === '23505') throw new HttpError(409, 'That email is already registered');
    throw err;
  } finally {
    client.release();
  }
});

authRouter.post('/login', limiter, async (req, res) => {
  const body = loginBody.parse(req.body);
  const rows = await query('SELECT id, email, name, role, password_hash FROM users WHERE email = $1', [body.email]);
  const row = rows[0];
  const ok = row ? await bcrypt.compare(body.password, row.password_hash) : await bcrypt.compare(body.password, '$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!row || !ok) throw new HttpError(401, 'Wrong email or password');
  setSession(req, res, row.id);
  res.json({ user: { id: row.id, email: row.email, name: row.name, role: row.role } });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.status(204).end();
});

authRouter.get('/me', optionalAuth, (req, res) => {
  res.json({ user: req.user ?? null });
});
