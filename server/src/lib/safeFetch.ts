import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return false;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`unsupported protocol ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('refusing to fetch a private address');
    return url;
  }
  const records = await dns.lookup(host, { all: true });
  if (records.length === 0 || records.some((r) => isPrivateAddress(r.address))) {
    throw new Error('refusing to fetch a private address');
  }
  return url;
}

export async function safeFetchText(raw: string, opts: { timeoutMs?: number; accept?: string } = {}): Promise<string> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12000),
      headers: {
        'user-agent': 'NewsFunnelBot/0.1 (+https://github.com/m-umar-c/news-funnel)',
        accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/json;q=0.9,*/*;q=0.5',
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error(`redirect without location from ${url.host}`);
      current = new URL(loc, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`${url.host} responded ${res.status}`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) throw new Error('response too large');
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error('response too large');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new Error('too many redirects');
}
