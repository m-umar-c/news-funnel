import { config, EMBEDDING_DIM } from '../config.js';
import { tokenize, contentWords } from '../lib/text.js';
import { sha1 } from '../lib/text.js';

export interface EmbeddingProvider {
  name: string;
  embed(texts: string[]): Promise<number[][]>;
}

export function normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

function bucket(token: string): { idx: number; sign: number } {
  const h = sha1(token);
  const n = parseInt(h.slice(0, 8), 16);
  return { idx: n % EMBEDDING_DIM, sign: parseInt(h.slice(8, 9), 16) % 2 === 0 ? 1 : -1 };
}

// feature hashing over unigrams and bigrams. no semantics, but deterministic and offline,
// which is what the tests need
export const hashProvider: EmbeddingProvider = {
  name: 'hash',
  async embed(texts) {
    return texts.map((text) => {
      const v = new Array<number>(EMBEDDING_DIM).fill(0);
      const words = contentWords(text);
      for (let i = 0; i < words.length; i++) {
        const w = words[i]!;
        const a = bucket(w);
        v[a.idx]! += a.sign;
        if (i + 1 < words.length) {
          const b = bucket(`${w}_${words[i + 1]}`);
          v[b.idx]! += 0.5 * b.sign;
        }
      }
      return normalize(v);
    });
  },
};

let extractor: Promise<any> | null = null;

async function getExtractor() {
  if (!extractor) {
    extractor = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      if (process.env.HF_HOME) env.cacheDir = process.env.HF_HOME;
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    })();
  }
  return extractor;
}

const localProvider: EmbeddingProvider = {
  name: 'local',
  async embed(texts) {
    const ext = await getExtractor();
    const out: number[][] = [];
    for (const t of texts) {
      const res = await ext(t.slice(0, 2500), { pooling: 'mean', normalize: true });
      out.push(Array.from(res.data as Float32Array));
    }
    return out;
  },
};

const geminiProvider: EmbeddingProvider = {
  name: 'gemini',
  async embed(texts) {
    if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 50) {
      const batch = texts.slice(i, i + 50);
      const model = `models/${config.GEMINI_EMBEDDING_MODEL}`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model}:batchEmbedContents`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model,
              content: { parts: [{ text: text.slice(0, 6000) }] },
              outputDimensionality: EMBEDDING_DIM,
            })),
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!res.ok) throw new Error(`gemini embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { embeddings: { values: number[] }[] };
      for (const e of json.embeddings) out.push(normalize(e.values));
    }
    return out;
  },
};

export function getEmbeddingProvider(name = config.EMBEDDING_PROVIDER): EmbeddingProvider {
  if (name === 'gemini') return geminiProvider;
  if (name === 'hash') return hashProvider;
  return localProvider;
}

export async function embedOne(text: string, provider = getEmbeddingProvider()): Promise<number[]> {
  const [v] = await provider.embed([text]);
  if (!v || v.length !== EMBEDDING_DIM) throw new Error(`expected ${EMBEDDING_DIM} dimensions, got ${v?.length}`);
  return v;
}

export { tokenize };
