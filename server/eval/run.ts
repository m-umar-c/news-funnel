import { readFile } from 'node:fs/promises';
import { getEmbeddingProvider } from '../src/providers/embeddings.js';
import { keywordScore, scoreCandidate, WEIGHTS, type Candidate, type Profile } from '../src/ranking/score.js';
import { items as fixtureItems, profiles, type LabeledItem, type ProfileId } from './fixtures.js';

const K = 10;

function precisionAtK(ranked: LabeledItem[], profile: ProfileId, k: number): number {
  return ranked.slice(0, k).filter((i) => i.rel.includes(profile)).length / k;
}

function averagePrecision(ranked: LabeledItem[], profile: ProfileId): number {
  let hits = 0;
  let sum = 0;
  ranked.forEach((item, idx) => {
    if (item.rel.includes(profile)) {
      hits++;
      sum += hits / (idx + 1);
    }
  });
  return hits === 0 ? 0 : sum / hits;
}

async function main() {
  const fileArg = process.argv.indexOf('--file');
  const items: LabeledItem[] = fileArg > -1 ? JSON.parse(await readFile(process.argv[fileArg + 1]!, 'utf8')) : fixtureItems;

  const provider = getEmbeddingProvider();
  console.log(`embedding provider: ${provider.name}, ${items.length} labeled items, precision@${K}\n`);

  const vectors = await provider.embed(items.map((i) => `${i.title}. ${i.text}`));
  const now = new Date();
  const candidates = items.map((item, idx): Candidate & { item: LabeledItem } => ({
    id: idx,
    item,
    title: item.title,
    text: item.text,
    centroid: vectors[idx]!,
    articleCount: 1,
    sourceCount: 1,
    sourceWeight: 1,
    firstSeenAt: now,
    lastSeenAt: now,
  }));

  const rows: { profile: string; keyword: number[]; embedding: number[]; hybrid: number[]; random: number }[] = [];

  for (const [id, topics] of Object.entries(profiles) as [ProfileId, string[]][]) {
    const topicVectors = await provider.embed(topics);
    const profile: Profile = { interests: topics.map((topic, i) => ({ topic, vector: topicVectors[i]! })), taste: null };
    const neutral = { ...WEIGHTS, recency: 0, coverage: 0, source: 0 };

    const keyword = [...items].sort((a, b) => keywordScore(topics, `${b.title}. ${b.text}`) - keywordScore(topics, `${a.title}. ${a.text}`));
    const embedding = candidates
      .map((c) => ({ c, s: scoreCandidate(c, profile, now, { ...neutral, keyword: 0 }).score }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c.item);
    const hybrid = candidates
      .map((c) => ({ c, s: scoreCandidate(c, profile, now, neutral).score }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c.item);

    const relevant = items.filter((i) => i.rel.includes(id)).length;
    rows.push({
      profile: id,
      keyword: [precisionAtK(keyword, id, K), averagePrecision(keyword, id)],
      embedding: [precisionAtK(embedding, id, K), averagePrecision(embedding, id)],
      hybrid: [precisionAtK(hybrid, id, K), averagePrecision(hybrid, id)],
      random: relevant / items.length,
    });
  }

  const f = (n: number) => n.toFixed(2).padStart(6);
  console.log('profile      keyword P@10   embedding P@10   hybrid P@10   (base rate)');
  for (const r of rows) {
    console.log(`${r.profile.padEnd(12)} ${f(r.keyword[0]!)}         ${f(r.embedding[0]!)}           ${f(r.hybrid[0]!)}        ${f(r.random)}`);
  }
  const mean = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0) / rows.length;
  console.log(`${'mean'.padEnd(12)} ${f(mean((r) => r.keyword[0]!))}         ${f(mean((r) => r.embedding[0]!))}           ${f(mean((r) => r.hybrid[0]!))}        ${f(mean((r) => r.random))}`);
  console.log('');
  console.log('profile      keyword MAP    embedding MAP    hybrid MAP');
  for (const r of rows) {
    console.log(`${r.profile.padEnd(12)} ${f(r.keyword[1]!)}         ${f(r.embedding[1]!)}           ${f(r.hybrid[1]!)}`);
  }
  console.log(`${'mean'.padEnd(12)} ${f(mean((r) => r.keyword[1]!))}         ${f(mean((r) => r.embedding[1]!))}           ${f(mean((r) => r.hybrid[1]!))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
