import pg from 'pg';

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://funnel:funnel@localhost:5432/funnel_test';
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE ${dbName}`);
  await client.end();

  process.env.DATABASE_URL = url;
  const { migrate } = await import('../src/db/migrate.js');
  const { pool } = await import('../src/db/pool.js');
  await migrate(false);
  await pool.end();
}
