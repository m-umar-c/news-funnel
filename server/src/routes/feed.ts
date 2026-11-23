import { Router } from 'express';
import { z } from 'zod';
import { fromVector, query, toVector } from '../db/pool.js';
import { HttpError, optionalAuth, parseId, requireAuth } from '../lib/http.js';
import { loadCandidates } from '../ranking/candidates.js';
import { loadProfile } from '../ranking/profile.js';
import { bestMatchingSentence, buildTaste, rankCandidates, scoreCandidate } from '../ranking/score.js';

export const feedRouter = Router();

const feedQuery = z.object({
  scope: z.enum(['for-you', 'latest']).default('for-you'),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

feedRouter.get('/feed', optionalAuth, async (req, res) => {
  const q = feedQuery.parse(req.query);
  const userId = req.user?.id ?? null;
  const candidates = await loadCandidates({ userId });
  const profile = userId ? await loadProfile(userId) : { interests: [], taste: null };
  const personalised = q.scope === 'for-you' && (profile.interests.length > 0 || profile.taste !== null);

  const now = new Date();
  let items;
  if (personalised) {
    items = rankCandidates(candidates.filter((c) => c.myFeedback !== -1), profile, now).map((r) => ({
      c: r.item,
      score: r.score,
      topic: r.topic,
      components: r.components,
    }));
  } else {
    items = candidates.map((c) => ({ c, score: 0, topic: null as string | null, components: [] as any[] }));
    if (q.scope === 'for-you') {
      items.sort((a, b) => b.c.sourceCount * 2 + b.c.articleCount - (a.c.sourceCount * 2 + a.c.articleCount) || b.c.lastSeenAt.getTime() - a.c.lastSeenAt.getTime());
    }
  }

  const page = items.slice(q.offset, q.offset + q.limit).map((x) => ({
    id: x.c.id,
    title: x.c.title,
    lede: x.c.lede,
    sources: x.c.sources,
    articleCount: x.c.articleCount,
    sourceCount: x.c.sourceCount,
    firstSeenAt: x.c.firstSeenAt,
    lastSeenAt: x.c.lastSeenAt,
    myFeedback: x.c.myFeedback,
    score: personalised ? Number(x.score.toFixed(3)) : null,
    topic: x.topic,
  }));

  res.json({ personalised, total: items.length, items: page });
});

feedRouter.get('/threads/:id', optionalAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const userId = req.user?.id ?? null;
  const [cand] = await loadCandidates({ threadId: id, userId });
  if (!cand) throw new HttpError(404, 'Story not found');

  const articles = await query(
    `SELECT a.id, a.title, a.url, a.author, a.published_at, left(a.content, 600) AS snippet, s.name AS source
       FROM articles a JOIN sources s ON s.id = a.source_id
      WHERE a.thread_id = $1 ORDER BY a.published_at ASC`,
    [id],
  );
  const [summary] = await query(
    `SELECT s.method, s.model, s.bullets, s.validation, s.article_id FROM summaries s WHERE s.thread_id = $1`,
    [id],
  );

  let why = null;
  if (userId) {
    const profile = await loadProfile(userId);
    if (profile.interests.length || profile.taste) {
      const ranked = scoreCandidate(cand, profile, new Date());
      let evidence: { sentence: string; article: string } | null = null;
      if (ranked.topic) {
        const lead = articles.find((a) => a.id === summary?.article_id) ?? articles[0];
        if (lead) {
          const [full] = await query('SELECT content FROM articles WHERE id = $1', [lead.id]);
          const sentence = bestMatchingSentence(ranked.topic, `${lead.title}. ${full.content}`);
          if (sentence) evidence = { sentence, article: lead.title };
        }
      }
      why = { score: Number(ranked.score.toFixed(3)), topic: ranked.topic, components: ranked.components, evidence };
    }
  }

  res.json({
    thread: {
      id: cand.id,
      title: cand.title,
      firstSeenAt: cand.firstSeenAt,
      lastSeenAt: cand.lastSeenAt,
      articleCount: cand.articleCount,
      sourceCount: cand.sourceCount,
      myFeedback: cand.myFeedback,
      thumbsUp: cand.thumbsUp,
    },
    articles,
    summary: summary
      ? {
          method: summary.method,
          model: summary.model,
          sentences: summary.bullets.sentences,
          bullets: summary.bullets.items,
          validation: summary.validation,
          articleId: summary.article_id,
        }
      : null,
    why,
  });
});

const feedbackBody = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

feedRouter.post('/threads/:id/feedback', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const { value } = feedbackBody.parse(req.body);
  const userId = req.user!.id;
  const exists = await query('SELECT 1 FROM story_threads WHERE id = $1', [id]);
  if (exists.length === 0) throw new HttpError(404, 'Story not found');

  if (value === 0) {
    await query('DELETE FROM feedback WHERE user_id = $1 AND thread_id = $2', [userId, id]);
  } else {
    await query(
      `INSERT INTO feedback (user_id, thread_id, value) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, thread_id) DO UPDATE SET value = EXCLUDED.value, created_at = now()`,
      [userId, id, value],
    );
  }

  const votes = await query(
    `SELECT f.value, t.centroid::text AS centroid FROM feedback f JOIN story_threads t ON t.id = f.thread_id
      WHERE f.user_id = $1 ORDER BY f.created_at DESC LIMIT 200`,
    [userId],
  );
  const taste = buildTaste(votes.map((v) => ({ value: v.value as 1 | -1, centroid: fromVector(v.centroid)! })));
  await query('UPDATE users SET taste = $2::vector WHERE id = $1', [userId, taste ? toVector(taste) : null]);

  res.json({ myFeedback: value === 0 ? null : value });
});
