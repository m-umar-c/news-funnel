CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  taste         vector(384),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sources (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('rss', 'hn')),
  url             TEXT NOT NULL UNIQUE,
  weight          REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 2),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE story_threads (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  centroid      vector(384) NOT NULL,
  article_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE articles (
  id             SERIAL PRIMARY KEY,
  source_id      INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  thread_id      INTEGER REFERENCES story_threads(id) ON DELETE SET NULL,
  url            TEXT NOT NULL,
  url_hash       TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  author         TEXT,
  published_at   TIMESTAMPTZ NOT NULL,
  content        TEXT NOT NULL,
  embedding      vector(384) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE summaries (
  id         SERIAL PRIMARY KEY,
  thread_id  INTEGER NOT NULL UNIQUE REFERENCES story_threads(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  method     TEXT NOT NULL CHECK (method IN ('llm', 'extractive')),
  model      TEXT,
  bullets    JSONB NOT NULL,
  validation JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE interests (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic      TEXT NOT NULL,
  embedding  vector(384) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic)
);

CREATE TABLE teams (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  topics     TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE feedback (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id  INTEGER NOT NULL REFERENCES story_threads(id) ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);

CREATE TABLE ingest_runs (
  id          SERIAL PRIMARY KEY,
  trigger     TEXT NOT NULL DEFAULT 'schedule',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  fetched     INTEGER NOT NULL DEFAULT 0,
  inserted    INTEGER NOT NULL DEFAULT 0,
  clustered   INTEGER NOT NULL DEFAULT 0,
  errors      JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX articles_thread_idx ON articles (thread_id);
CREATE INDEX articles_published_idx ON articles (published_at DESC);
CREATE INDEX threads_last_seen_idx ON story_threads (last_seen_at DESC);
CREATE INDEX threads_centroid_idx ON story_threads USING hnsw (centroid vector_cosine_ops);
CREATE INDEX feedback_thread_idx ON feedback (thread_id);
