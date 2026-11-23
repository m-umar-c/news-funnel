import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { HttpError, optionalAuth, requireAdmin, requireAuth } from '../lib/http.js';
import { loadCandidates } from '../ranking/candidates.js';
import { rankCandidates } from '../ranking/score.js';
import { embedOne } from '../providers/embeddings.js';

export const teamsRouter = Router();

const topicCache = new Map<string, number[]>();

async function topicVector(topic: string): Promise<number[]> {
  const hit = topicCache.get(topic);
  if (hit) return hit;
  const v = await embedOne(topic);
  topicCache.set(topic, v);
  return v;
}

async function findTeam(slug: string | string[] | undefined) {
  const [team] = await query('SELECT id, name, slug, topics FROM teams WHERE slug = $1', [Array.isArray(slug) ? slug[0] : slug]);
  if (!team) throw new HttpError(404, 'Team not found');
  return team as { id: number; name: string; slug: string; topics: string[] };
}

export async function buildDigest(team: { topics: string[] }, hours: number, size: number) {
  const candidates = await loadCandidates({ days: Math.max(1, Math.ceil(hours / 24)), limit: 400 });
  const cutoff = Date.now() - hours * 3600_000;
  const recent = candidates.filter((c) => c.lastSeenAt.getTime() >= cutoff);
  const interests = await Promise.all(team.topics.map(async (topic) => ({ topic, vector: await topicVector(topic) })));
  const ranked = rankCandidates(recent, { interests, taste: null });
  return ranked
    .filter((r) => (r.components.find((c) => c.key === 'interest')?.raw ?? 0) > 0.35)
    .slice(0, size)
    .map((r) => ({
      id: r.item.id,
      title: r.item.title,
      lede: r.item.lede,
      sources: r.item.sources,
      articleCount: r.item.articleCount,
      sourceCount: r.item.sourceCount,
      lastSeenAt: r.item.lastSeenAt,
      topic: r.topic,
      score: Number(r.score.toFixed(3)),
    }));
}

teamsRouter.get('/', optionalAuth, async (req, res) => {
  const rows = await query(
    `SELECT t.id, t.name, t.slug, t.topics,
            (SELECT count(*)::int FROM team_members m WHERE m.team_id = t.id) AS members,
            EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = t.id AND m.user_id = $1) AS joined
       FROM teams t ORDER BY t.name`,
    [req.user?.id ?? null],
  );
  res.json({ teams: rows });
});

const digestQuery = z.object({
  hours: z.coerce.number().int().min(6).max(168).default(48),
  size: z.coerce.number().int().min(3).max(25).default(10),
});

teamsRouter.get('/:slug/digest', async (req, res) => {
  const team = await findTeam(req.params.slug);
  const q = digestQuery.parse(req.query);
  res.json({ team, hours: q.hours, items: await buildDigest(team, q.hours, q.size) });
});

teamsRouter.get('/:slug/digest.md', async (req, res) => {
  const team = await findTeam(req.params.slug);
  const q = digestQuery.parse(req.query);
  const items = await buildDigest(team, q.hours, q.size);
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`# ${team.name} digest, ${date}`, '', `Topics: ${team.topics.join('; ')}`, ''];
  items.forEach((it, i) => {
    lines.push(`${i + 1}. **${it.title}**  `);
    lines.push(`   ${it.sourceCount} ${it.sourceCount === 1 ? 'source' : 'sources'}: ${it.sources.join(', ')}`);
    if (it.lede) lines.push(`   ${it.lede}`);
    lines.push('');
  });
  if (items.length === 0) lines.push('Nothing matched these topics in the selected window.');
  res.type('text/markdown').send(lines.join('\n'));
});

teamsRouter.post('/:slug/join', requireAuth, async (req, res) => {
  const team = await findTeam(req.params.slug);
  await query('INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [team.id, req.user!.id]);
  res.status(204).end();
});

teamsRouter.delete('/:slug/join', requireAuth, async (req, res) => {
  const team = await findTeam(req.params.slug);
  await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [team.id, req.user!.id]);
  res.status(204).end();
});

const teamBody = z.object({
  name: z.string().trim().min(2).max(50),
  topics: z.array(z.string().trim().min(2).max(80)).min(1).max(8),
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

teamsRouter.post('/', requireAdmin, async (req, res) => {
  const body = teamBody.parse(req.body);
  const slug = slugify(body.name);
  if (!slug) throw new HttpError(400, 'Name needs letters or numbers');
  try {
    const [row] = await query('INSERT INTO teams (name, slug, topics) VALUES ($1,$2,$3) RETURNING id, name, slug, topics', [body.name, slug, body.topics]);
    res.status(201).json({ team: row });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new HttpError(409, 'A team with that name already exists');
    throw err;
  }
});

teamsRouter.put('/:slug', requireAdmin, async (req, res) => {
  const body = teamBody.parse(req.body);
  const team = await findTeam(req.params.slug);
  const [row] = await query('UPDATE teams SET name = $2, topics = $3 WHERE id = $1 RETURNING id, name, slug, topics', [team.id, body.name, body.topics]);
  res.json({ team: row });
});

teamsRouter.delete('/:slug', requireAdmin, async (req, res) => {
  const team = await findTeam(req.params.slug);
  await query('DELETE FROM teams WHERE id = $1', [team.id]);
  res.status(204).end();
});
