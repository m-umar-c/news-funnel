import { pool, query, toVector } from '../db/pool.js';
import { getEmbeddingProvider } from '../providers/embeddings.js';
import { embeddingInput } from './ingest.js';

// run after switching EMBEDDING_PROVIDER: vectors from different models are not comparable
async function main() {
  const provider = getEmbeddingProvider();
  const articles = await query<{ id: number; title: string; content: string }>('SELECT id, title, content FROM articles ORDER BY id');
  console.log(`re-embedding ${articles.length} articles with ${provider.name}`);
  for (const a of articles) {
    const [v] = await provider.embed([embeddingInput(a.title, a.content)]);
    await query('UPDATE articles SET embedding = $2::vector WHERE id = $1', [a.id, toVector(v!)]);
  }
  await query(`UPDATE story_threads t SET centroid = sub.c FROM (
      SELECT thread_id, avg(embedding) AS c FROM articles WHERE thread_id IS NOT NULL GROUP BY thread_id
    ) sub WHERE sub.thread_id = t.id`);
  const interests = await query<{ id: number; topic: string }>('SELECT id, topic FROM interests');
  for (const i of interests) {
    const [v] = await provider.embed([i.topic]);
    await query('UPDATE interests SET embedding = $2::vector WHERE id = $1', [i.id, toVector(v!)]);
  }
  await query('UPDATE users SET taste = NULL');
  console.log('done; user taste vectors were reset');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
