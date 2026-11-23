export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T = void>(path: string) => request<T>('DELETE', path),
};

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

export interface FeedItem {
  id: number;
  title: string;
  lede: string | null;
  sources: string[];
  articleCount: number;
  sourceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  myFeedback: 1 | -1 | null;
  score: number | null;
  topic: string | null;
}

export interface FeedResponse {
  personalised: boolean;
  total: number;
  items: FeedItem[];
}

export interface Component {
  key: string;
  label: string;
  raw: number;
  weight: number;
  points: number;
  detail?: string;
}

export interface ThreadResponse {
  thread: {
    id: number;
    title: string;
    firstSeenAt: string;
    lastSeenAt: string;
    articleCount: number;
    sourceCount: number;
    myFeedback: 1 | -1 | null;
    thumbsUp: number;
  };
  articles: { id: number; title: string; url: string; author: string | null; published_at: string; snippet: string; source: string }[];
  summary: {
    method: 'llm' | 'extractive';
    model: string | null;
    sentences: string[];
    bullets: { text: string; sources: number[] }[];
    validation: { proposed: number; accepted: number; rejected: { text: string; reason: string }[]; fallback: boolean };
    articleId: number;
  } | null;
  why: {
    score: number;
    topic: string | null;
    components: Component[];
    evidence: { sentence: string; article: string } | null;
  } | null;
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  topics: string[];
  members: number;
  joined: boolean;
}

export interface DigestItem {
  id: number;
  title: string;
  lede: string | null;
  sources: string[];
  articleCount: number;
  sourceCount: number;
  lastSeenAt: string;
  topic: string | null;
  score: number;
}

export interface SourceRow {
  id: number;
  name: string;
  kind: 'rss' | 'hn';
  url: string;
  weight: number;
  enabled: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
  articles: number;
}

export interface RunRow {
  id: number;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  fetched: number;
  inserted: number;
  clustered: number;
  errors: { source: string; message: string }[];
}

export interface Stats {
  articles: number;
  threads: number;
  sources: number;
  last_ingest: string | null;
}
