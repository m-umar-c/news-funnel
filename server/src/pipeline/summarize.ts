import { config } from '../config.js';
import { contentWords, splitSentences, truncate } from '../lib/text.js';

export interface Bullet {
  text: string;
  sources: number[];
}

export interface Rejection {
  text: string;
  reason: string;
}

export interface Validation {
  proposed: number;
  accepted: number;
  rejected: Rejection[];
  fallback: boolean;
}

export interface SummaryResult {
  method: 'llm' | 'extractive';
  model: string | null;
  sentences: string[];
  bullets: Bullet[];
  validation: Validation;
}

const MAX_SENTENCES = 40;
const MIN_SUPPORT = 0.55;

const BOILERPLATE = /image credits|opens in a new window|all rights reserved|subscribe to|sign up for|read more|click here|follow us|newsletter|^posted:|^in brief|©|cookie|advertisement/i;

export function prepareSentences(content: string): string[] {
  return splitSentences(content)
    .filter((s) => !BOILERPLATE.test(s))
    .slice(0, MAX_SENTENCES);
}

export function extractiveSummary(sentences: string[], count = 3): Bullet[] {
  if (sentences.length === 0) return [];
  const docFreq = new Map<string, number>();
  const sentWords = sentences.map((s) => contentWords(s));
  for (const words of sentWords) {
    for (const w of new Set(words)) docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
  }
  const termFreq = new Map<string, number>();
  for (const words of sentWords) for (const w of words) termFreq.set(w, (termFreq.get(w) ?? 0) + 1);

  const scored = sentences.map((s, i) => {
    const words = sentWords[i]!;
    if (words.length < 5 || s.length > 420) return { i, score: -1 };
    let score = 0;
    for (const w of new Set(words)) {
      const df = docFreq.get(w) ?? 1;
      score += (termFreq.get(w) ?? 1) * Math.log(1 + sentences.length / df);
    }
    score /= Math.sqrt(words.length);
    score *= 1 + 0.6 / (1 + i);
    return { i, score };
  });

  const picked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.i - b.i);

  return picked.map((p) => ({ text: truncate(sentences[p.i]!, 320), sources: [p.i + 1] }));
}

const NUMBER = /\d[\d,.]*%?/g;

export function checkBullet(bullet: Bullet, sentences: string[]): string | null {
  if (!bullet.text || bullet.text.trim().length < 15) return 'too short';
  if (bullet.text.length > 360) return 'too long';
  if (!Array.isArray(bullet.sources) || bullet.sources.length === 0) return 'no citation';
  for (const id of bullet.sources) {
    if (!Number.isInteger(id) || id < 1 || id > sentences.length) return `cites sentence ${id} which does not exist`;
  }
  const cited = bullet.sources.map((id) => sentences[id - 1]!).join(' ');
  const citedLower = cited.toLowerCase().replace(/,/g, '');

  const numbers = bullet.text.replace(/,/g, '').match(NUMBER) ?? [];
  for (const n of numbers) {
    const clean = n.replace(/[.,]$/, '');
    if (!citedLower.includes(clean.toLowerCase())) return `number ${clean} not found in cited text`;
  }

  const words = [...new Set(contentWords(bullet.text))];
  if (words.length === 0) return 'no content words';
  const support = new Set(contentWords(cited));
  const hit = words.filter((w) => support.has(w)).length;
  if (hit / words.length < MIN_SUPPORT) {
    return `only ${Math.round((hit / words.length) * 100)}% of its content words appear in the cited text`;
  }
  return null;
}

export function validateBullets(bullets: Bullet[], sentences: string[]): { kept: Bullet[]; validation: Validation } {
  const kept: Bullet[] = [];
  const rejected: Rejection[] = [];
  for (const b of bullets) {
    const reason = checkBullet(b, sentences);
    if (reason) rejected.push({ text: truncate(String(b.text ?? ''), 160), reason });
    else kept.push({ text: b.text.trim(), sources: [...new Set(b.sources)].sort((a, c) => a - c) });
  }
  return { kept, validation: { proposed: bullets.length, accepted: kept.length, rejected, fallback: false } };
}

async function geminiBullets(title: string, sentences: string[]): Promise<Bullet[]> {
  const numbered = sentences.map((s, i) => `[${i + 1}] ${s}`).join('\n');
  const prompt = [
    'Summarize the article below as 3 to 4 short bullet points for software engineers.',
    'Rules:',
    '- Use only facts stated in the numbered sentences. Do not add outside knowledge.',
    '- Every bullet must list the sentence numbers it relies on.',
    '- Keep any figures exactly as written.',
    'Reply with JSON only: {"bullets":[{"text":"...","sources":[1,2]}]}',
    '',
    `Title: ${title}`,
    numbered,
  ].join('\n');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_SUMMARY_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!res.ok) throw new Error(`gemini summary ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as any;
  const raw: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim());
  if (!Array.isArray(parsed.bullets)) throw new Error('model reply has no bullets array');
  return parsed.bullets.map((b: any) => ({ text: String(b.text ?? ''), sources: Array.isArray(b.sources) ? b.sources.map(Number) : [] }));
}

export async function summarize(
  title: string,
  content: string,
  propose: (title: string, sentences: string[]) => Promise<Bullet[]> = geminiBullets,
  useLlm = config.SUMMARY_PROVIDER === 'gemini' && Boolean(config.GEMINI_API_KEY),
): Promise<SummaryResult> {
  const sentences = prepareSentences(content);
  const fallbackResult = (validation?: Validation): SummaryResult => {
    const bullets = extractiveSummary(sentences);
    return {
      method: 'extractive',
      model: null,
      sentences,
      bullets,
      validation: { proposed: validation?.proposed ?? bullets.length, accepted: bullets.length, rejected: validation?.rejected ?? [], fallback: Boolean(validation) },
    };
  };

  if (!useLlm || sentences.length < 4) return fallbackResult();

  try {
    const proposed = await propose(title, sentences);
    const { kept, validation } = validateBullets(proposed, sentences);
    if (kept.length < 2) return fallbackResult(validation);
    return { method: 'llm', model: config.GEMINI_SUMMARY_MODEL, sentences, bullets: kept, validation };
  } catch (err) {
    console.warn('llm summary failed, using extractive:', (err as Error).message);
    return fallbackResult({ proposed: 0, accepted: 0, rejected: [{ text: '', reason: (err as Error).message }], fallback: true });
  }
}
