import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/pool.js';
import { addArticle, addSource, PG_BODY, resetDb, RUST_BODY } from './helpers.js';

const app = createApp();

async function signUp(name: string, email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name, email, password: 'correct horse battery' });
  expect(res.status).toBe(201);
  return { agent, user: res.body.user };
}

beforeAll(resetDb);
beforeEach(resetDb);
afterAll(() => pool.end());

describe('auth', () => {
  it('makes the first account an admin and later ones members', async () => {
    const first = await signUp('Ada', 'ada@example.com');
    const second = await signUp('Bo', 'bo@example.com');
    expect(first.user.role).toBe('admin');
    expect(second.user.role).toBe('member');
  });

  it('rejects duplicate emails and short passwords', async () => {
    await signUp('Ada', 'ada@example.com');
    const dup = await request(app).post('/api/auth/register').send({ name: 'Ada 2', email: 'ADA@example.com', password: 'correct horse battery' });
    expect(dup.status).toBe(409);
    const weak = await request(app).post('/api/auth/register').send({ name: 'X', email: 'x@example.com', password: 'short' });
    expect(weak.status).toBe(400);
  });

  it('logs in with the right password only', async () => {
    await signUp('Ada', 'ada@example.com');
    const bad = await request(app).post('/api/auth/login').send({ email: 'ada@example.com', password: 'nope nope nope' });
    expect(bad.status).toBe(401);
    const good = await request(app).post('/api/auth/login').send({ email: 'ada@example.com', password: 'correct horse battery' });
    expect(good.status).toBe(200);
    expect(good.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);
  });

  it('reports the current user from the cookie', async () => {
    const { agent } = await signUp('Ada', 'ada@example.com');
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.email).toBe('ada@example.com');
    expect((await request(app).get('/api/auth/me')).body.user).toBeNull();
  });

  it('protects personal routes', async () => {
    expect((await request(app).get('/api/interests')).status).toBe(401);
    expect((await request(app).post('/api/threads/1/feedback').send({ value: 1 })).status).toBe(401);
  });
});

describe('admin', () => {
  it('blocks members from managing sources', async () => {
    await signUp('Ada', 'ada@example.com');
    const member = await signUp('Bo', 'bo@example.com');
    const res = await member.agent.post('/api/admin/sources').send({ name: 'Feed', kind: 'rss', url: 'https://1.1.1.1/rss' });
    expect(res.status).toBe(403);
  });

  it('refuses source urls that point at private addresses', async () => {
    const admin = await signUp('Ada', 'ada@example.com');
    const res = await admin.agent.post('/api/admin/sources').send({ name: 'Internal', kind: 'rss', url: 'http://169.254.169.254/latest/meta-data' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/private/);
  });

  it('adds, updates and removes a source', async () => {
    const admin = await signUp('Ada', 'ada@example.com');
    const created = await admin.agent.post('/api/admin/sources').send({ name: 'Public feed', kind: 'rss', url: 'https://1.1.1.1/rss', weight: 1.5 });
    expect(created.status).toBe(201);
    const id = created.body.source.id;
    const patched = await admin.agent.patch(`/api/admin/sources/${id}`).send({ enabled: false });
    expect(patched.body.source.enabled).toBe(false);
    expect((await admin.agent.delete(`/api/admin/sources/${id}`)).status).toBe(204);
    expect((await admin.agent.get('/api/admin/sources')).body.sources).toHaveLength(0);
  });
});

describe('feed', () => {
  async function seedStories() {
    const src = await addSource('Wire One');
    const other = await addSource('Wire Two');
    await addArticle(src, 'Postgres release speeds up index builds', PG_BODY, 4);
    await addArticle(other, 'Postgres release builds indexes faster', PG_BODY, 3);
    await addArticle(src, 'Rust compiler gets faster incremental builds', RUST_BODY, 2);
  }

  it('lists threads newest first for anonymous visitors', async () => {
    await seedStories();
    const res = await request(app).get('/api/feed?scope=latest');
    expect(res.status).toBe(200);
    expect(res.body.personalised).toBe(false);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].title).toMatch(/Rust/);
    const pg = res.body.items.find((i: any) => /Postgres/.test(i.title));
    expect(pg.sourceCount).toBe(2);
    expect(pg.articleCount).toBe(2);
  });

  it('ranks by interests and explains why', async () => {
    await seedStories();
    const { agent } = await signUp('Ada', 'ada@example.com');
    await agent.post('/api/interests').send({ topic: 'postgres indexes' }).expect(201);
    const feed = await agent.get('/api/feed');
    expect(feed.body.personalised).toBe(true);
    expect(feed.body.items[0].title).toMatch(/Postgres/);

    const detail = await agent.get(`/api/threads/${feed.body.items[0].id}`);
    expect(detail.body.articles).toHaveLength(2);
    expect(detail.body.summary.bullets.length).toBeGreaterThan(0);
    expect(detail.body.why.components.map((c: any) => c.key)).toEqual(expect.arrayContaining(['interest', 'recency', 'coverage']));
    expect(detail.body.why.evidence.sentence).toMatch(/index/i);
  });

  it('hides threads the reader thumbed down and stores a taste vector', async () => {
    await seedStories();
    const { agent, user } = await signUp('Ada', 'ada@example.com');
    await agent.post('/api/interests').send({ topic: 'software' }).expect(201);
    const before = await agent.get('/api/feed');
    const rust = before.body.items.find((i: any) => /Rust/.test(i.title));

    await agent.post(`/api/threads/${rust.id}/feedback`).send({ value: -1 }).expect(200);
    const after = await agent.get('/api/feed');
    expect(after.body.items.find((i: any) => i.id === rust.id)).toBeUndefined();
    const [row] = await query('SELECT taste IS NOT NULL AS has_taste FROM users WHERE id = $1', [user.id]);
    expect(row.has_taste).toBe(true);

    await agent.post(`/api/threads/${rust.id}/feedback`).send({ value: 0 }).expect(200);
    const restored = await agent.get('/api/feed');
    expect(restored.body.items.find((i: any) => i.id === rust.id)).toBeDefined();
    const [cleared] = await query('SELECT taste IS NULL AS no_taste FROM users WHERE id = $1', [user.id]);
    expect(cleared.no_taste).toBe(true);
  });

  it('returns 404 for a missing story and 400 for a bad id', async () => {
    expect((await request(app).get('/api/threads/9999')).status).toBe(404);
    expect((await request(app).get('/api/threads/abc')).status).toBe(400);
  });

  it('adds and removes an interest', async () => {
    const { agent } = await signUp('Ada', 'ada@example.com');
    const created = await agent.post('/api/interests').send({ topic: 'rust' });
    expect(created.status).toBe(201);
    await agent.delete(`/api/interests/${created.body.interest.id}`).expect(204);
    expect((await agent.get('/api/interests')).body.interests).toHaveLength(0);
  });
});

describe('teams', () => {
  it('builds a digest from team topics and renders markdown', async () => {
    const src = await addSource();
    await addArticle(src, 'Postgres release speeds up index builds', PG_BODY, 3);
    await addArticle(src, 'Rust compiler gets faster incremental builds', RUST_BODY, 2);
    await query(`INSERT INTO teams (name, slug, topics) VALUES ('Data', 'data', ARRAY['postgres indexes and vacuum'])`);

    const json = await request(app).get('/api/teams/data/digest');
    expect(json.status).toBe(200);
    expect(json.body.items[0].title).toMatch(/Postgres/);

    const md = await request(app).get('/api/teams/data/digest.md');
    expect(md.headers['content-type']).toMatch(/markdown/);
    expect(md.text).toMatch(/^# Data digest/);
    expect(md.text).toMatch(/Postgres release/);
  });

  it('lets members join and leave, but only admins create teams', async () => {
    await query(`INSERT INTO teams (name, slug, topics) VALUES ('Data', 'data', ARRAY['postgres'])`);
    const admin = await signUp('Ada', 'ada@example.com');
    const member = await signUp('Bo', 'bo@example.com');

    await member.agent.post('/api/teams/data/join').expect(204);
    let list = await member.agent.get('/api/teams');
    expect(list.body.teams[0]).toMatchObject({ joined: true, members: 1 });
    await member.agent.delete('/api/teams/data/join').expect(204);
    list = await member.agent.get('/api/teams');
    expect(list.body.teams[0]).toMatchObject({ joined: false, members: 0 });

    expect((await member.agent.post('/api/teams').send({ name: 'Mobile', topics: ['ios'] })).status).toBe(403);
    const made = await admin.agent.post('/api/teams').send({ name: 'Mobile Apps', topics: ['ios and android'] });
    expect(made.status).toBe(201);
    expect(made.body.team.slug).toBe('mobile-apps');
  });
});
