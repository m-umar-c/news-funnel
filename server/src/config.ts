import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default('postgres://funnel:funnel@localhost:5432/funnel'),
  JWT_SECRET: z.string().min(8).default('dev-secret-change-me'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.string().default('development'),
  EMBEDDING_PROVIDER: z.enum(['local', 'gemini', 'hash']).default('local'),
  SUMMARY_PROVIDER: z.enum(['extractive', 'gemini']).default('extractive'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_SUMMARY_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  INGEST_INTERVAL_MINUTES: z.coerce.number().default(20),
  CLUSTER_THRESHOLD: z.coerce.number().default(0.62),
  ARTICLE_MAX_AGE_DAYS: z.coerce.number().default(7),
});

export const config = schema.parse(process.env);
export const EMBEDDING_DIM = 384;
export const isProd = config.NODE_ENV === 'production';
