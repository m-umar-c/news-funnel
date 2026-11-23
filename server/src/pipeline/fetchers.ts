import Parser from 'rss-parser';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { safeFetchText } from '../lib/safeFetch.js';
import { stripHtml } from '../lib/text.js';

export interface Candidate {
  url: string;
  title: string;
  author: string | null;
  publishedAt: Date;
  content: string;
}

export interface SourceRow {
  id: number;
  name: string;
  kind: 'rss' | 'hn';
  url: string;
}

const parser = new Parser({
  customFields: { item: [['content:encoded', 'contentEncoded']] },
});

export async function fetchRss(source: SourceRow): Promise<Candidate[]> {
  const xml = await safeFetchText(source.url, { accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.5' });
  const feed = await parser.parseString(xml);
  const out: Candidate[] = [];
  for (const item of feed.items) {
    if (!item.link || !item.title) continue;
    const date = new Date(item.isoDate ?? item.pubDate ?? Date.now());
    const raw = (item as any).contentEncoded ?? item.content ?? item.contentSnippet ?? '';
    out.push({
      url: item.link,
      title: stripHtml(item.title),
      author: item.creator ?? (item as any).author ?? null,
      publishedAt: Number.isNaN(date.getTime()) ? new Date() : date,
      content: stripHtml(raw),
    });
  }
  return out;
}

export async function fetchHn(source: SourceRow): Promise<Candidate[]> {
  const body = await safeFetchText(source.url, { accept: 'application/json' });
  const json = JSON.parse(body) as { hits: { title?: string; url?: string; author?: string; created_at: string; objectID: string }[] };
  const out: Candidate[] = [];
  for (const hit of json.hits ?? []) {
    if (!hit.title || !hit.url) continue;
    out.push({
      url: hit.url,
      title: hit.title,
      author: hit.author ?? null,
      publishedAt: new Date(hit.created_at),
      content: '',
    });
  }
  return out;
}

export async function extractArticle(url: string): Promise<string> {
  const html = await safeFetchText(url, { timeoutMs: 10000, accept: 'text/html,application/xhtml+xml' });
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
  const parsed = new Readability(dom.window.document).parse();
  dom.window.close();
  return (parsed?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function fetchCandidates(source: SourceRow): Promise<Candidate[]> {
  return source.kind === 'hn' ? fetchHn(source) : fetchRss(source);
}
