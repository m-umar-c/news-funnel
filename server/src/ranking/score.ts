import { contentWords, splitSentences, tokenize } from '../lib/text.js';
import { cosine, normalize } from '../providers/embeddings.js';

export interface Interest {
  topic: string;
  vector: number[];
}

export interface Profile {
  interests: Interest[];
  taste: number[] | null;
}

export interface Candidate {
  id: number;
  title: string;
  centroid: number[];
  articleCount: number;
  sourceCount: number;
  sourceWeight: number;
  text?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface Component {
  key: 'interest' | 'keyword' | 'taste' | 'recency' | 'coverage' | 'source';
  label: string;
  raw: number;
  weight: number;
  points: number;
  detail?: string;
}

export interface Ranked<T extends Candidate = Candidate> {
  item: T;
  score: number;
  topic: string | null;
  components: Component[];
}

export const WEIGHTS = { interest: 1.0, keyword: 0.3, taste: 0.45, recency: 0.4, coverage: 0.2, source: 0.1 };
const HALF_LIFE_HOURS = 20;

const scale = (sim: number, lo: number, hi: number) => Math.max(0, Math.min(1, (sim - lo) / (hi - lo)));

export function recency(ageHours: number): number {
  return Math.pow(0.5, Math.max(0, ageHours) / HALF_LIFE_HOURS);
}

export function coverage(sourceCount: number): number {
  return Math.min(1, Math.log2(1 + sourceCount) / Math.log2(5));
}

export function scoreCandidate<T extends Candidate>(c: T, profile: Profile, now: Date, weights = WEIGHTS): Ranked<T> {
  const ageHours = (now.getTime() - c.lastSeenAt.getTime()) / 3600_000;
  const components: Component[] = [];

  let topic: string | null = null;
  let best = -1;
  for (const i of profile.interests) {
    const sim = cosine(c.centroid, i.vector);
    if (sim > best) {
      best = sim;
      topic = i.topic;
    }
  }
  if (topic !== null) {
    const raw = scale(best, 0.1, 0.36);
    components.push({
      key: 'interest',
      label: 'Matches your interests',
      raw,
      weight: weights.interest,
      points: raw * weights.interest,
      detail: `closest topic "${topic}" (cosine ${best.toFixed(2)})`,
    });
  }

  if (profile.interests.length > 0) {
    const text = `${c.title}. ${c.text ?? ''}`;
    let hit = 0;
    let hitTopic = '';
    for (const i of profile.interests) {
      const k = keywordScore([i.topic], text);
      if (k > hit) {
        hit = k;
        hitTopic = i.topic;
      }
    }
    if (hit > 0) {
      components.push({
        key: 'keyword',
        label: 'Topic words in the text',
        raw: hit,
        weight: weights.keyword,
        points: hit * weights.keyword,
        detail: `${Math.round(hit * 100)}% of the words in "${hitTopic}" appear`,
      });
    }
  }

  if (profile.taste) {
    const sim = cosine(c.centroid, profile.taste);
    const raw = Math.max(-1, Math.min(1, sim / 0.4));
    components.push({
      key: 'taste',
      label: 'Resembles what you rated',
      raw,
      weight: weights.taste,
      points: raw * weights.taste,
      detail: `similarity to your thumbs ${sim.toFixed(2)}`,
    });
  }

  const rec = recency(ageHours);
  components.push({
    key: 'recency',
    label: 'Recent',
    raw: rec,
    weight: weights.recency,
    points: rec * weights.recency,
    detail: ageHours < 1 ? 'updated within the hour' : `last update ${Math.round(ageHours)}h ago`,
  });

  const cov = coverage(c.sourceCount);
  components.push({
    key: 'coverage',
    label: 'Multiple outlets',
    raw: cov,
    weight: weights.coverage,
    points: cov * weights.coverage,
    detail: `${c.sourceCount} ${c.sourceCount === 1 ? 'source' : 'sources'}, ${c.articleCount} ${c.articleCount === 1 ? 'article' : 'articles'}`,
  });

  const src = Math.max(0, Math.min(1, c.sourceWeight / 2));
  components.push({
    key: 'source',
    label: 'Source weight',
    raw: src,
    weight: weights.source,
    points: src * weights.source,
  });

  const strong = (components.find((x) => x.key === 'interest')?.raw ?? 0) >= 0.2;
  return { item: c, score: components.reduce((s, x) => s + x.points, 0), topic: strong ? topic : null, components };
}

export function rankCandidates<T extends Candidate>(items: T[], profile: Profile, now = new Date(), weights = WEIGHTS): Ranked<T>[] {
  return items.map((c) => scoreCandidate(c, profile, now, weights)).sort((a, b) => b.score - a.score);
}

export function buildTaste(votes: { value: 1 | -1; centroid: number[] }[]): number[] | null {
  if (votes.length === 0) return null;
  const sum = new Array<number>(votes[0]!.centroid.length).fill(0);
  votes.forEach((v, i) => {
    const decay = Math.pow(0.97, i);
    for (let d = 0; d < sum.length; d++) sum[d]! += v.value * decay * v.centroid[d]!;
  });
  const mag = Math.sqrt(sum.reduce((s, x) => s + x * x, 0));
  return mag < 0.05 ? null : normalize(sum);
}

export function keywordScore(topics: string[], text: string): number {
  const bag = new Map<string, number>();
  for (const t of contentWords(text)) bag.set(t, (bag.get(t) ?? 0) + 1);
  let score = 0;
  for (const topic of topics) {
    const words = [...new Set(contentWords(topic))];
    if (words.length === 0) continue;
    const hits = words.filter((w) => bag.has(w)).length;
    score += hits / words.length;
  }
  return score;
}

export function bestMatchingSentence(topic: string, text: string): string | null {
  const words = new Set(contentWords(topic));
  if (words.size === 0) return null;
  let best: { s: string; n: number } | null = null;
  for (const s of splitSentences(text).slice(0, 60)) {
    const have = new Set(contentWords(s));
    let n = 0;
    for (const w of words) if (have.has(w)) n++;
    if (n > 0 && (!best || n > best.n)) best = { s, n };
  }
  return best && best.s.length <= 400 ? best.s : best ? best.s.slice(0, 397) + '…' : null;
}

export { tokenize };
