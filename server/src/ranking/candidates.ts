import { query, fromVector } from '../db/pool.js';
import type { Candidate } from './score.js';

export interface FeedCandidate extends Candidate {
  sources: string[];
  lede: string | null;
  myFeedback: number | null;
  thumbsUp: number;
}

export async function loadCandidates(opts: { days?: number; limit?: number; userId?: number | null; threadId?: number | null } = {}): Promise<FeedCandidate[]> {
  const rows = await query(
    `SELECT t.id, t.title, t.centroid::text AS centroid, t.article_count, t.first_seen_at, t.last_seen_at,
            agg.source_count, agg.source_weight, agg.sources,
            s.bullets->'items'->0->>'text' AS lede,
            (SELECT string_agg(b->>'text', ' ') FROM jsonb_array_elements(s.bullets->'items') b) AS summary_text,
            fb.value AS my_feedback,
            COALESCE(up.n, 0) AS thumbs_up
       FROM story_threads t
       JOIN LATERAL (
         SELECT count(DISTINCT a.source_id) AS source_count,
                avg(src.weight) AS source_weight,
                array_agg(DISTINCT src.name) AS sources
           FROM articles a JOIN sources src ON src.id = a.source_id
          WHERE a.thread_id = t.id
       ) agg ON agg.source_count > 0
       LEFT JOIN summaries s ON s.thread_id = t.id
       LEFT JOIN feedback fb ON fb.thread_id = t.id AND fb.user_id = $3
       LEFT JOIN LATERAL (SELECT count(*) AS n FROM feedback f WHERE f.thread_id = t.id AND f.value = 1) up ON true
      WHERE ($4::int IS NOT NULL OR t.last_seen_at > now() - make_interval(days => $1))
        AND ($4::int IS NULL OR t.id = $4)
      ORDER BY t.last_seen_at DESC
      LIMIT $2`,
    [opts.days ?? 7, opts.limit ?? 600, opts.userId ?? null, opts.threadId ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    centroid: fromVector(r.centroid)!,
    articleCount: r.article_count,
    sourceCount: Number(r.source_count),
    sourceWeight: Number(r.source_weight),
    firstSeenAt: new Date(r.first_seen_at),
    lastSeenAt: new Date(r.last_seen_at),
    sources: r.sources,
    lede: r.lede,
    text: r.summary_text ?? '',
    myFeedback: r.my_feedback,
    thumbsUp: Number(r.thumbs_up),
  }));
}
