import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { config } from '../config.js';
import { query } from '../db/pool.js';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const COOKIE = 'nf_token';

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: '14d' });
}

async function userFromRequest(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const id = Number(typeof payload === 'string' ? NaN : payload.sub);
    if (!Number.isInteger(id)) return null;
    const rows = await query<AuthUser>('SELECT id, email, name, role FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = (await userFromRequest(req)) ?? undefined;
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, 'Sign in required');
  req.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {});
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Admins only');
  next();
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return void res.status(400).json({ error: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}

export function parseId(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid id');
  return n;
}
