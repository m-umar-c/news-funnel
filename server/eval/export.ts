import { writeFile } from 'node:fs/promises';
import { pool, query } from '../src/db/pool.js';

// dumps recent stories in the same shape as eval/fixtures.ts so you can label real data:
// fill in "rel" with any of backend, frontend, security, then run: npm run eval -- --file eval/export.json
async function main() {
  const rows = await query(
    `SELECT t.id, t.title, left(a.content, 500) AS text
       FROM story_threads t JOIN LATERAL (SELECT content FROM articles WHERE thread_id = t.id ORDER BY published_at LIMIT 1) a ON true
      ORDER BY t.last_seen_at DESC LIMIT 120`,
  );
  const out = rows.map((r) => ({ id: `t${r.id}`, title: r.title, text: r.text, rel: [] as string[] }));
  await writeFile('eval/export.json', JSON.stringify(out, null, 2));
  console.log(`wrote ${out.length} stories to eval/export.json`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
