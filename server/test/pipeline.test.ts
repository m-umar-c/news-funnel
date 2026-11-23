import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { addArticle, addSource, PG_BODY, resetDb, RUST_BODY } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

describe('storeArticle clustering', () => {
  it('groups near-identical coverage from two outlets into one thread', async () => {
    const a = await addSource('Wire One');
    const b = await addSource('Wire Two');
    const first = await addArticle(a, 'Postgres release speeds up index builds', PG_BODY, 3);
    const second = await addArticle(b, 'New Postgres version builds indexes faster', PG_BODY.replace('faster', 'quicker'), 2);
    expect(first.joined).toBe(false);
    expect(second.joined).toBe(true);
    expect(second.threadId).toBe(first.threadId);

    const [thread] = await query('SELECT article_count, first_seen_at, last_seen_at FROM story_threads WHERE id = $1', [first.threadId]);
    expect(thread.article_count).toBe(2);
    expect(new Date(thread.last_seen_at).getTime()).toBeGreaterThan(new Date(thread.first_seen_at).getTime());
  });

  it('keeps unrelated stories in separate threads', async () => {
    const a = await addSource();
    const pg = await addArticle(a, 'Postgres release speeds up index builds', PG_BODY);
    const rust = await addArticle(a, 'Rust compiler gets faster incremental builds', RUST_BODY);
    expect(rust.threadId).not.toBe(pg.threadId);
    const [{ n }] = await query('SELECT count(*)::int AS n FROM story_threads');
    expect(n).toBe(2);
  });

  it('writes a cited summary only for the thread lead', async () => {
    const a = await addSource();
    const lead = await addArticle(a, 'Postgres release speeds up index builds', PG_BODY);
    await addArticle(a, 'Postgres release builds indexes faster', PG_BODY);
    const rows = await query('SELECT article_id, method, bullets FROM summaries');
    expect(rows).toHaveLength(1);
    expect(rows[0].article_id).toBe(lead.articleId);
    expect(rows[0].method).toBe('extractive');
    expect(rows[0].bullets.items[0].sources.length).toBeGreaterThan(0);
  });

  it('refuses the same url twice', async () => {
    const a = await addSource();
    await addArticle(a, 'Same story', PG_BODY);
    await expect(addArticle(a, 'Same story', PG_BODY)).rejects.toMatchObject({ code: '23505' });
  });
});
