import { describe, expect, it, vi } from 'vitest';
import { formatSimuladoLabel } from '@/lib/simulado-label';

vi.mock('@/lib/editions', () => { throw new Error('The label formatter must not load edition resolvers.'); });
vi.mock('@/lib/simulado-helpers', () => { throw new Error('The label formatter must not load status helpers.'); });

describe('pure simulado label formatter', () => {
  it.each([
    [{ sequenceNumber: 1, editionCode: '2027.2' }, '2027.2 · Simulado 1'],
    [{ sequenceNumber: 1, editionCode: '2026' }, '2026 · Simulado 1'],
    [{ sequenceNumber: 8 }, 'Simulado 8'],
    [{ sequenceNumber: 8, editionCode: '' }, 'Simulado 8'],
  ])('formats existing metadata without loading resolvers or status helpers: %j', (input, expected) => {
    const frozen = Object.freeze(input);
    expect(formatSimuladoLabel(frozen)).toBe(expected);
    expect(frozen).toEqual(input);
  });
});
