import type { PoolClient } from 'pg';
import { config } from '../config.js';
import { toVector } from '../db/pool.js';

export interface ThreadMatch {
  id: number;
  similarity: number;
}

export function shouldJoin(similarity: number, threshold = config.CLUSTER_THRESHOLD): boolean {
  return similarity >= threshold;
}

export function runningMean(centroid: number[], count: number, incoming: number[]): number[] {
  const merged = centroid.map((c, i) => (c * count + incoming[i]!) / (count + 1));
  let sum = 0;
  for (const x of merged) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return merged.map((x) => x / norm);
}

export async function nearestThread(client: PoolClient, embedding: number[], windowHours = 72): Promise<ThreadMatch | null> {
  const { rows } = await client.query(
    `SELECT id, 1 - (centroid <=> $1::vector) AS similarity
       FROM story_threads
      WHERE last_seen_at > now() - make_interval(hours => $2)
      ORDER BY centroid <=> $1::vector
      LIMIT 1`,
    [toVector(embedding), windowHours],
  );
  const row = rows[0];
  return row ? { id: row.id, similarity: Number(row.similarity) } : null;
}

export async function attachToThread(
  client: PoolClient,
  threadId: number,
  embedding: number[],
  publishedAt: Date,
): Promise<void> {
  const { rows } = await client.query(
    `SELECT centroid::text AS centroid, article_count FROM story_threads WHERE id = $1 FOR UPDATE`,
    [threadId],
  );
  const row = rows[0];
  const merged = runningMean(JSON.parse(row.centroid), row.article_count, embedding);
  await client.query(
    `UPDATE story_threads
        SET centroid = $2::vector,
            article_count = article_count + 1,
            first_seen_at = LEAST(first_seen_at, $3),
            last_seen_at = GREATEST(last_seen_at, $3)
      WHERE id = $1`,
    [threadId, toVector(merged), publishedAt],
  );
}

export async function createThread(
  client: PoolClient,
  title: string,
  embedding: number[],
  publishedAt: Date,
): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO story_threads (title, centroid, first_seen_at, last_seen_at)
     VALUES ($1, $2::vector, $3, $3) RETURNING id`,
    [title, toVector(embedding), publishedAt],
  );
  return rows[0].id;
}
