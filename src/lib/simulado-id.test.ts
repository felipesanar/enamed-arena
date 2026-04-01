import { describe, expect, it } from 'vitest';
import { isUuidString } from '@/lib/simulado-id';

describe('isUuidString', () => {
  it('returns true for canonical UUID', () => {
    expect(isUuidString('84ae9def-6a45-4cb8-822a-6aa9b69449f9')).toBe(true);
  });

  it('returns false for slug-style route segment', () => {
    expect(isUuidString('simulado-2-cirurgia-emergencia')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isUuidString('  84ae9def-6a45-4cb8-822a-6aa9b69449f9  ')).toBe(true);
  });
});
