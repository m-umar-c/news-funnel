import { describe, expect, it } from 'vitest';
import { normalizeUrl, splitSentences, stripHtml } from '../src/lib/text.js';

describe('normalizeUrl', () => {
  it('drops tracking params, fragments, www and trailing slashes', () => {
    expect(normalizeUrl('https://www.Example.com/post/?utm_source=x&b=2&a=1#top')).toBe('https://example.com/post?a=1&b=2');
  });

  it('keeps the root path intact', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('treats tracked and clean links as the same article', () => {
    expect(normalizeUrl('https://a.com/x?fbclid=abc')).toBe(normalizeUrl('https://a.com/x'));
  });
});

describe('splitSentences', () => {
  it('splits on sentence ends and merges fragments', () => {
    const out = splitSentences('First sentence is long enough to count. Short. Second sentence is also long enough here!');
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('Short.');
  });

  it('returns an empty list for empty input', () => {
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('stripHtml', () => {
  it('removes tags, scripts and decodes entities', () => {
    expect(stripHtml('<p>Tom &amp; Jerry</p><script>alert(1)</script><b>win</b>')).toBe('Tom & Jerry win');
  });
});
