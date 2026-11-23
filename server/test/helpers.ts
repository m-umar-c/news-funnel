import { pool, query } from '../src/db/pool.js';
import { sha1 } from '../src/lib/text.js';
import { storeArticle } from '../src/pipeline/ingest.js';
import { embeddingInput } from '../src/pipeline/ingest.js';
import { hashProvider } from '../src/providers/embeddings.js';

export async function resetDb() {
  await pool.query('TRUNCATE feedback, interests, team_members, teams, summaries, articles, story_threads, sources, ingest_runs, users RESTART IDENTITY CASCADE');
}

export async function addSource(name = 'Test Wire', weight = 1): Promise<number> {
  const rows = await query('INSERT INTO sources (name, kind, url, weight) VALUES ($1,$2,$3,$4) RETURNING id', [
    name,
    'rss',
    `https://${name.toLowerCase().replace(/\W+/g, '')}.example.com/feed`,
    weight,
  ]);
  return rows[0].id;
}

export async function addArticle(sourceId: number, title: string, body: string, hoursAgo = 1) {
  const url = `https://news.example.com/${sha1(title).slice(0, 10)}`;
  const content = body;
  const [embedding] = await hashProvider.embed([embeddingInput(title, content)]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await storeArticle(
      client,
      sourceId,
      { url, urlHash: sha1(url), title, author: null, publishedAt: new Date(Date.now() - hoursAgo * 3600_000), content },
      embedding!,
    );
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export const PG_BODY =
  'The PostgreSQL project released a new version with faster index builds for large tables. Developers reported that vacuum no longer blocks writes on busy databases. The release notes describe improved query planner statistics for joins across many tables. Operators can now upgrade replicas with less downtime during failover.';
export const RUST_BODY =
  'The Rust compiler team shipped a release that speeds up incremental builds. Cargo now caches dependency graphs between runs. The borrow checker accepts more patterns involving closures and async functions. Maintainers also stabilised several standard library traits for iterators.';
