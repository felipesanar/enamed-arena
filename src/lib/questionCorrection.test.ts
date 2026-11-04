import { describe, expect, it } from 'vitest';
import { hasKnownAnswerKey } from './questionCorrection';

describe('known correction boundary', () => {
  const options = [{ id: 'a' }, { id: 'b' }];
  it.each([null, undefined, { correctOptionId: '', options }, { correctOptionId: 'missing', options }])('does not classify an absent/invalid key: %j', question => {
    expect(hasKnownAnswerKey(question)).toBe(false);
  });
  it('accepts an actual option key even when its explanation is unavailable', () => {
    expect(hasKnownAnswerKey({ correctOptionId: 'b', options, explanationUnavailable: true })).toBe(true);
  });
});
