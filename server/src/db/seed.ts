import { pool } from './pool.js';

export const defaultSources = [
  { name: 'Hacker News', kind: 'hn', url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40', weight: 1.1 },
  { name: 'Lobsters', kind: 'rss', url: 'https://lobste.rs/rss', weight: 1.0 },
  { name: 'Ars Technica', kind: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', weight: 1.0 },
  { name: 'The Verge', kind: 'rss', url: 'https://www.theverge.com/rss/index.xml', weight: 0.9 },
  { name: 'TechCrunch', kind: 'rss', url: 'https://techcrunch.com/feed/', weight: 0.9 },
  { name: 'GitHub Blog', kind: 'rss', url: 'https://github.blog/feed/', weight: 1.0 },
  { name: 'Cloudflare Blog', kind: 'rss', url: 'https://blog.cloudflare.com/rss/', weight: 1.0 },
] as const;

export const defaultTeams = [
  { name: 'Platform & Infra', slug: 'platform', topics: ['kubernetes and cloud infrastructure', 'databases and postgres', 'observability and incident response'] },
  { name: 'Frontend', slug: 'frontend', topics: ['react and javascript frameworks', 'web performance', 'browsers and css'] },
  { name: 'AI Engineering', slug: 'ai', topics: ['large language models', 'ai coding assistants', 'machine learning research'] },
  { name: 'Security', slug: 'security', topics: ['vulnerabilities and exploits', 'data breaches', 'authentication and encryption'] },
];

export async function seed() {
  for (const s of defaultSources) {
    await pool.query(
      `INSERT INTO sources (name, kind, url, weight) VALUES ($1,$2,$3,$4) ON CONFLICT (url) DO NOTHING`,
      [s.name, s.kind, s.url, s.weight],
    );
  }
  for (const t of defaultTeams) {
    await pool.query(
      `INSERT INTO teams (name, slug, topics) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING`,
      [t.name, t.slug, t.topics],
    );
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
