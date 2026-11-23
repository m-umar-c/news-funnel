import { describe, expect, it } from 'vitest';
import { hashProvider, cosine } from '../src/providers/embeddings.js';
import { runningMean, shouldJoin } from '../src/pipeline/cluster.js';
import { buildTaste, coverage, keywordScore, rankCandidates, recency, type Candidate } from '../src/ranking/score.js';
import { PG_BODY, RUST_BODY } from './helpers.js';

async function candidate(id: number, title: string, body: string, hoursAgo: number, sources = 1): Promise<Candidate> {
  const [centroid] = await hashProvider.embed([`${title}. ${body}`]);
  const t = new Date(Date.now() - hoursAgo * 3600_000);
  return { id, title, centroid: centroid!, articleCount: sources, sourceCount: sources, sourceWeight: 1, firstSeenAt: t, lastSeenAt: t, text: body };
}

describe('hash embeddings', () => {
  it('puts similar text closer than unrelated text', async () => {
    const [a, b, c] = await hashProvider.embed([PG_BODY, PG_BODY.replace('faster index builds', 'quicker index creation'), RUST_BODY]);
    expect(cosine(a!, b!)).toBeGreaterThan(cosine(a!, c!) + 0.2);
  });

  it('returns unit vectors', async () => {
    const [v] = await hashProvider.embed(['some text about databases and indexes']);
    expect(Math.sqrt(v!.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 5);
  });
});

describe('clustering helpers', () => {
  it('joins only at or above the threshold', () => {
    expect(shouldJoin(0.7, 0.62)).toBe(true);
    expect(shouldJoin(0.61, 0.62)).toBe(false);
  });

  it('keeps the centroid normalised', () => {
    const merged = runningMean([1, 0], 3, [0, 1]);
    expect(Math.hypot(...merged)).toBeCloseTo(1, 6);
    expect(merged[0]).toBeGreaterThan(merged[1]!);
  });
});

describe('score parts', () => {
  it('halves recency every twenty hours', () => {
    expect(recency(0)).toBe(1);
    expect(recency(20)).toBeCloseTo(0.5, 5);
  });

  it('rewards coverage with diminishing returns and caps at 1', () => {
    expect(coverage(1)).toBeLessThan(coverage(2));
    expect(coverage(20)).toBe(1);
  });

  it('keyword score is the share of topic words present', () => {
    expect(keywordScore(['postgres index'], 'A new postgres release')).toBeCloseTo(0.5, 5);
    expect(keywordScore(['postgres'], 'nothing relevant here')).toBe(0);
  });
});

describe('rankCandidates', () => {
  it('ranks on-topic stories above off-topic ones', async () => {
    const pg = await candidate(1, 'Postgres release speeds up index builds', PG_BODY, 3);
    const rust = await candidate(2, 'Rust compiler release speeds up builds', RUST_BODY, 3);
    const [interest] = await hashProvider.embed(['postgres database indexes']);
    const ranked = rankCandidates([rust, pg], { interests: [{ topic: 'postgres database indexes', vector: interest! }], taste: null });
    expect(ranked[0]!.item.id).toBe(1);
    expect(ranked[0]!.components.map((c) => c.key)).toContain('interest');
  });

  it('lets a fresh on-topic story beat an old one', async () => {
    const fresh = await candidate(1, 'Postgres release speeds up index builds', PG_BODY, 2);
    const stale = await candidate(2, 'Postgres release speeds up index builds again', PG_BODY, 90);
    const [interest] = await hashProvider.embed(['postgres']);
    const ranked = rankCandidates([stale, fresh], { interests: [{ topic: 'postgres', vector: interest! }], taste: null });
    expect(ranked[0]!.item.id).toBe(1);
  });

  it('pushes stories that resemble thumbs-down further away', async () => {
    const pg = await candidate(1, 'Postgres release speeds up index builds', PG_BODY, 3);
    const rust = await candidate(2, 'Rust compiler release speeds up builds', RUST_BODY, 3);
    const taste = buildTaste([{ value: -1, centroid: rust.centroid }, { value: 1, centroid: pg.centroid }]);
    const ranked = rankCandidates([rust, pg], { interests: [], taste });
    expect(ranked[0]!.item.id).toBe(1);
    expect(ranked[1]!.components.find((c) => c.key === 'taste')!.points).toBeLessThan(0);
  });

  it('weights sum into the reported score', async () => {
    const pg = await candidate(1, 'Postgres news', PG_BODY, 5);
    const [r] = rankCandidates([pg], { interests: [], taste: null });
    expect(r!.score).toBeCloseTo(r!.components.reduce((s, c) => s + c.points, 0), 10);
  });
});

describe('buildTaste', () => {
  it('is null with no votes or when votes cancel out', () => {
    expect(buildTaste([])).toBeNull();
    expect(buildTaste([{ value: 1, centroid: [1, 0] }, { value: -1, centroid: [1, 0] }])).toBeNull();
  });
});
