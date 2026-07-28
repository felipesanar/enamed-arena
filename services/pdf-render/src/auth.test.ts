import { describe, expect, it } from 'vitest';
import { constantTimeEqual, validateInternalSecret } from './auth.js';

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('shared-secret', 'shared-secret')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(constantTimeEqual('shared-secret', 'sharee-secret')).toBe(false);
  });

  it('returns false for different-length strings, without throwing', () => {
    expect(() => constantTimeEqual('short', 'a-lot-longer-string')).not.toThrow();
    expect(constantTimeEqual('short', 'a-lot-longer-string')).toBe(false);
  });

  it('treats two empty strings as equal', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });
});

describe('validateInternalSecret', () => {
  const SECRET = 'my-internal-secret';

  it('returns false when no header is provided', () => {
    expect(validateInternalSecret(undefined, SECRET)).toBe(false);
  });

  it('returns false for an empty-string header', () => {
    expect(validateInternalSecret('', SECRET)).toBe(false);
  });

  it('returns false for a wrong header of the same length as the secret', () => {
    const wrongSameLength = 'my-internal-xecret';
    expect(wrongSameLength.length).toBe(SECRET.length);
    expect(validateInternalSecret(wrongSameLength, SECRET)).toBe(false);
  });

  it('returns false for a wrong header of a different length', () => {
    expect(validateInternalSecret('nope', SECRET)).toBe(false);
  });

  it('returns true for the correct header', () => {
    expect(validateInternalSecret(SECRET, SECRET)).toBe(true);
  });

  it('fails closed when the expected secret is undefined, even if the header matches nothing meaningfully', () => {
    expect(validateInternalSecret(undefined, undefined)).toBe(false);
    expect(validateInternalSecret('anything', undefined)).toBe(false);
  });

  it('fails closed when the expected secret is an empty string, even if the header is also empty', () => {
    expect(validateInternalSecret('', '')).toBe(false);
    expect(validateInternalSecret('anything', '')).toBe(false);
  });

  it('does not throw when comparing strings of different lengths', () => {
    expect(() => validateInternalSecret('x'.repeat(1000), SECRET)).not.toThrow();
    expect(validateInternalSecret('x'.repeat(1000), SECRET)).toBe(false);
  });
});
