import { describe, expect, it, vi } from 'vitest';
import { checkBullet, extractiveSummary, prepareSentences, summarize, validateBullets } from '../src/pipeline/summarize.js';

const sentences = [
  'Acme Corp announced on Tuesday that it raised $40 million in a Series B round.',
  'The funding was led by Northwind Capital with participation from existing investors.',
  'Acme plans to use the money to hire 120 engineers across Toronto and Berlin.',
  'The company builds scheduling software for hospital operating rooms.',
  'Its customers include 35 hospitals across North America.',
];

describe('checkBullet', () => {
  it('accepts a bullet supported by its cited sentences', () => {
    expect(checkBullet({ text: 'Acme raised $40 million in a Series B round.', sources: [1] }, sentences)).toBeNull();
  });

  it('rejects a bullet with no citation', () => {
    expect(checkBullet({ text: 'Acme raised money this week.', sources: [] }, sentences)).toBe('no citation');
  });

  it('rejects a citation that does not exist', () => {
    expect(checkBullet({ text: 'Acme raised money this week.', sources: [9] }, sentences)).toMatch(/does not exist/);
  });

  it('rejects a number that is not in the cited sentence', () => {
    const reason = checkBullet({ text: 'Acme raised $50 million in a Series B round.', sources: [1] }, sentences);
    expect(reason).toMatch(/number/);
  });

  it('rejects claims that are not supported by the cited text', () => {
    const reason = checkBullet({ text: 'The company was acquired by a large competitor after regulators intervened.', sources: [4] }, sentences);
    expect(reason).toMatch(/content words/);
  });
});

describe('validateBullets', () => {
  it('keeps good bullets, reports the rest', () => {
    const { kept, validation } = validateBullets(
      [
        { text: 'Acme raised $40 million in a Series B round.', sources: [1] },
        { text: 'Acme was valued at $2 billion by investors.', sources: [1] },
      ],
      sentences,
    );
    expect(kept).toHaveLength(1);
    expect(validation).toMatchObject({ proposed: 2, accepted: 1 });
    expect(validation.rejected[0]?.reason).toMatch(/number/);
  });
});

describe('prepareSentences', () => {
  it('drops site boilerplate but keeps the story', () => {
    const out = prepareSentences(
      'In Brief Posted: 9:14 AM PST - November 23, 2026 Image Credits: Someone (opens in a new window) under a license. Acme announced a new database engine on Tuesday for hospitals. Subscribe to our newsletter for more updates every week.',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('Acme announced');
  });
});

describe('extractiveSummary', () => {
  it('returns cited sentences in original order', () => {
    const bullets = extractiveSummary(sentences, 3);
    expect(bullets).toHaveLength(3);
    const ids = bullets.map((b) => b.sources[0]!);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    for (const b of bullets) expect(sentences[b.sources[0]! - 1]).toContain(b.text.replace(/…$/, ''));
  });
});

describe('summarize with a model', () => {
  const article = sentences.join(' ');

  it('uses the model output when it validates', async () => {
    const propose = vi.fn().mockResolvedValue([
      { text: 'Acme raised $40 million in a Series B round.', sources: [1] },
      { text: 'The money will fund 120 new engineers in Toronto and Berlin.', sources: [3] },
    ]);
    const res = await summarize('Acme raises', article, propose, true);
    expect(res.method).toBe('llm');
    expect(res.bullets).toHaveLength(2);
  });

  it('falls back to extractive when too many bullets fail validation', async () => {
    const propose = vi.fn().mockResolvedValue([
      { text: 'Acme was acquired for $9 billion.', sources: [1] },
      { text: 'Regulators opened an investigation into the deal.', sources: [2] },
    ]);
    const res = await summarize('Acme raises', article, propose, true);
    expect(res.method).toBe('extractive');
    expect(res.validation.fallback).toBe(true);
    expect(res.validation.rejected).toHaveLength(2);
  });

  it('falls back when the model call throws', async () => {
    const propose = vi.fn().mockRejectedValue(new Error('429'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await summarize('Acme raises', article, propose, true);
    warn.mockRestore();
    expect(res.method).toBe('extractive');
    expect(res.bullets.length).toBeGreaterThan(0);
  });
});
