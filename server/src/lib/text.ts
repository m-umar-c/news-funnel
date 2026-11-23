import { createHash } from 'node:crypto';

const STOP = new Set(
  `a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your said says say new one two get got use used using via per like also still even many much make made makes may might yet`
    .split(/\s+/),
);

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?]+(?:[.!?]+["')\]]*|$)(?=\s|$)/g) ?? [cleaned];
  const out: string[] = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (s.length < 25) {
      if (out.length && s) out[out.length - 1] += ' ' + s;
      continue;
    }
    out.push(s);
  }
  return out;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.\-]*[a-z0-9+#]|[a-z0-9]/g) ?? []).map((t) => t.replace(/\.$/, ''));
}

export function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function contentWords(text: string): string[] {
  return tokenize(text)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map(stem);
}

export function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_src|source$|cmpid|ocid|share)/i;

export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING.test(key)) u.searchParams.delete(key);
  }
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}
