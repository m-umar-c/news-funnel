import type { PoolClient } from 'pg';
import { config } from '../config.js';
import { pool, query, toVector } from '../db/pool.js';
import { mapLimit } from '../lib/async.js';
import { normalizeUrl, sha1 } from '../lib/text.js';
import { getEmbeddingProvider } from '../providers/embeddings.js';
import { attachToThread, createThread, nearestThread, shouldJoin } from './cluster.js';
import { extractArticle, fetchCandidates, type Candidate, type SourceRow } from './fetchers.js';
import { summarize } from './summarize.js';

const LOCK_KEY = 7421001;
const PER_SOURCE_LIMIT = 30;
const MIN_CONTENT = 280;

export interface RunStats {
  fetched: number;
  inserted: number;
  clustered: number;
  errors: { source: string; message: string }[];
}

export function embeddingInput(title: string, content: string): string {
  return `${title}. ${content.slice(0, 1800)}`;
}

export async function storeArticle(
  client: PoolClient,
  sourceId: number,
  c: Candidate & { urlHash: string },
  embedding: number[],
  createSummary = true,
): Promise<{ articleId: number; threadId: number; joined: boolean }> {
  const match = await nearestThread(client, embedding);
  let threadId: number;
  let joined = false;
  if (match && shouldJoin(match.similarity)) {
    threadId = match.id;
    joined = true;
    await attachToThread(client, threadId, embedding, c.publishedAt);
  } else {
    threadId = await createThread(client, c.title, embedding, c.publishedAt);
  }
  const { rows } = await client.query(
    `INSERT INTO articles (source_id, thread_id, url, url_hash, title, author, published_at, content, embedding)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector) RETURNING id`,
    [sourceId, threadId, c.url, c.urlHash, c.title, c.author, c.publishedAt, c.content, toVector(embedding)],
  );
  const articleId = rows[0].id as number;

  if (!joined && createSummary) {
    const result = await summarize(c.title, c.content);
    if (result.bullets.length > 0) {
      await client.query(
        `INSERT INTO summaries (thread_id, article_id, method, model, bullets, validation)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [threadId, articleId, result.method, result.model, JSON.stringify({ sentences: result.sentences, items: result.bullets }), JSON.stringify(result.validation)],
      );
    }
  }
  return { articleId, threadId, joined };
}

async function processSource(source: SourceRow, stats: RunStats): Promise<void> {
  const provider = getEmbeddingProvider();
  const cutoff = Date.now() - config.ARTICLE_MAX_AGE_DAYS * 86400_000;

  const candidates = (await fetchCandidates(source))
    .filter((c) => c.publishedAt.getTime() > cutoff)
    .slice(0, PER_SOURCE_LIMIT);
  stats.fetched += candidates.length;

  const withHash = candidates.flatMap((c) => {
    try {
      const url = normalizeUrl(c.url);
      return [{ ...c, url, urlHash: sha1(url) }];
    } catch {
      return [];
    }
  });
  if (withHash.length === 0) return;

  const known = new Set(
    (await query<{ url_hash: string }>('SELECT url_hash FROM articles WHERE url_hash = ANY($1)', [withHash.map((c) => c.urlHash)])).map((r) => r.url_hash),
  );
  const fresh = withHash.filter((c) => !known.has(c.urlHash));

  const ready = (
    await mapLimit(fresh, 4, async (c) => {
      let content = c.content;
      if (content.length < MIN_CONTENT) {
        try {
          content = await extractArticle(c.url);
        } catch {
          return null;
        }
      }
      return content.length >= MIN_CONTENT ? { ...c, content: content.slice(0, 20000) } : null;
    })
  ).filter((c): c is NonNullable<typeof c> => c !== null);

  for (const c of ready) {
    const [embedding] = await provider.embed([embeddingInput(c.title, c.content)]);
    if (!embedding) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await storeArticle(client, source.id, c, embedding);
      await client.query('COMMIT');
      stats.inserted++;
      if (res.joined) stats.clustered++;
    } catch (err) {
      await client.query('ROLLBACK');
      if ((err as { code?: string }).code !== '23505') throw err;
    } finally {
      client.release();
    }
  }
}

export async function runIngest(trigger: 'schedule' | 'manual' | 'cli' = 'schedule'): Promise<RunStats | null> {
  const lock = await pool.connect();
  try {
    const got = (await lock.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY])).rows[0].ok;
    if (!got) return null;

    const run = (await query<{ id: number }>('INSERT INTO ingest_runs (trigger) VALUES ($1) RETURNING id', [trigger]))[0]!;
    const stats: RunStats = { fetched: 0, inserted: 0, clustered: 0, errors: [] };
    const sources = await query<SourceRow>('SELECT id, name, kind, url FROM sources WHERE enabled ORDER BY id');

    for (const source of sources) {
      try {
        await processSource(source, stats);
        await query('UPDATE sources SET last_fetched_at = now(), last_error = NULL WHERE id = $1', [source.id]);
      } catch (err) {
        const message = (err as Error).message;
        stats.errors.push({ source: source.name, message });
        await query('UPDATE sources SET last_fetched_at = now(), last_error = $2 WHERE id = $1', [source.id, message]);
      }
    }

    await query(
      `UPDATE ingest_runs SET finished_at = now(), fetched = $2, inserted = $3, clustered = $4, errors = $5 WHERE id = $1`,
      [run.id, stats.fetched, stats.inserted, stats.clustered, JSON.stringify(stats.errors)],
    );
    return stats;
  } finally {
    await lock.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    lock.release();
  }
}
