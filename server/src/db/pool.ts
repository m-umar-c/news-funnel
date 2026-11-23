import pg from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export function toVector(v: number[]): string {
  return `[${v.join(',')}]`;
}

export function fromVector(s: string | null): number[] | null {
  if (!s) return null;
  return JSON.parse(s) as number[];
}
