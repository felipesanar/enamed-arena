import { describe, expect, it } from 'vitest';
import { nextAnswerVersion, pendingAnswerWins } from './exam-answer-version';

describe('answer versions', () => {
  it('uses synced time and advances per question even when the clock retreats', () => {
    const first = nextAnswerVersion(null, 1000);
    expect(first).toBe('1970-01-01T00:00:01.000Z');
    expect(nextAnswerVersion(first, 500)).toBe('1970-01-01T00:00:01.001Z');
  });
  it('rejects invalid clocks and never silently versions corrupt dates', () => {
    expect(() => nextAnswerVersion(null, Infinity)).toThrow();
    expect(() => nextAnswerVersion('invalid', 1000)).toThrow();
  });
  it('DB wins ties; unversioned pending cannot replace versioned DB', () => {
    expect(pendingAnswerWins(null, null)).toBe(true);
    expect(pendingAnswerWins(null, '2026-01-01T00:00:00Z')).toBe(false);
    expect(pendingAnswerWins('2026-01-01T00:00:00Z', null)).toBe(true);
    expect(pendingAnswerWins('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(false);
    expect(pendingAnswerWins('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(true);
  });
});
