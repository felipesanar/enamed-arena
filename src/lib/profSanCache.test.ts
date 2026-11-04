import { beforeEach, describe, expect, it } from 'vitest';
import { buildSummaryCacheKey, clearOtherSummaryCaches, readCachedSummary, writeCachedSummary } from '@/lib/profSanCache';

describe('scoped summary cache v2', () => {
  beforeEach(() => sessionStorage.clear());
  const key = (userId = 'a', data: unknown = { scores: [50, 60, 70] }) => buildSummaryCacheKey('comparative', userId, ['one', 'two', 'three'], data);
  it('isolates users and signs intermediate data, reference, percentile and all series IDs', () => {
    expect(key('a')).not.toBe(key('b'));
    expect(key()).not.toBe(key('a', { scores: [50, 61, 70] }));
    expect(key()).not.toBe(buildSummaryCacheKey('comparative', 'a', ['one', 'other', 'three'], { scores: [50, 60, 70] }));
    expect(key('a', { reference: '2026', source: 'X', percentile: 5 })).not.toBe(key('a', { reference: '2027', source: 'Y', percentile: 6 }));
  });
  it('canonicalizes object keys but keeps ordered arrays', () => {
    expect(key('a', { a: 1, b: 2 })).toBe(key('a', { b: 2, a: 1 }));
  });
  it('never consumes unscoped v1 or raw markdown', () => {
    sessionStorage.setItem('sanor:v1:x', 'private old summary');
    expect(readCachedSummary('sanor:v1:x')).toBeNull();
    sessionStorage.setItem(key()!, 'raw markdown');
    expect(readCachedSummary(key())).toBeNull();
  });
  it('roundtrips only scoped v2 entries and disables anonymous caching', () => {
    writeCachedSummary(key(), 'my summary');
    expect(readCachedSummary(key())?.markdown).toBe('my summary');
    expect(readCachedSummary(key('b'))).toBeNull();
    expect(buildSummaryCacheKey('performance', null, ['one'], {})).toBeNull();
  });
  it('removes other account summaries on switch and all account summaries on logout', () => {
    writeCachedSummary(key('a'), 'private a'); writeCachedSummary(key('b'), 'private b');
    clearOtherSummaryCaches('b');
    expect(readCachedSummary(key('a'))).toBeNull();
    expect(readCachedSummary(key('b'))?.markdown).toBe('private b');
    clearOtherSummaryCaches(null);
    expect(readCachedSummary(key('b'))).toBeNull();
  });
});
