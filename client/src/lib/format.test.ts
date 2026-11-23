import { describe, expect, it } from 'vitest';
import { hostOf, plural, timeAgo } from './format';

const now = new Date('2026-11-23T12:00:00Z').getTime();

describe('timeAgo', () => {
  it('rounds into minutes, hours and days', () => {
    expect(timeAgo('2026-11-23T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-11-23T11:15:00Z', now)).toBe('45m ago');
    expect(timeAgo('2026-11-23T07:00:00Z', now)).toBe('5h ago');
    expect(timeAgo('2026-11-20T12:00:00Z', now)).toBe('3d ago');
  });

  it('never goes negative for timestamps slightly in the future', () => {
    expect(timeAgo('2026-11-23T12:00:30Z', now)).toBe('just now');
  });
});

describe('plural', () => {
  it('only adds an s when needed', () => {
    expect(plural(1, 'source')).toBe('1 source');
    expect(plural(3, 'source')).toBe('3 sources');
    expect(plural(2, 'story', 'stories')).toBe('2 stories');
  });
});

describe('hostOf', () => {
  it('strips www and survives bad input', () => {
    expect(hostOf('https://www.example.com/a/b')).toBe('example.com');
    expect(hostOf('not a url')).toBe('not a url');
  });
});
