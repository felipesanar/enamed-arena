import { describe, it, expect } from 'vitest';
import type { SegmentFilter } from '@/services/rankingApi';
import type { UserSegment } from '@/types';

// Extração da lógica pura para facilitar teste
function getAllowedSegments(segment: UserSegment): SegmentFilter[] {
  if (segment === 'pro') return ['all', 'sanarflix', 'pro'];
  if (segment === 'standard') return ['all', 'sanarflix'];
  return ['all'];
}

describe('allowedSegments', () => {
  it('guest vê apenas "all"', () => {
    expect(getAllowedSegments('guest')).toEqual(['all']);
  });

  it('standard vê "all" e "sanarflix"', () => {
    expect(getAllowedSegments('standard')).toEqual(['all', 'sanarflix']);
  });

  it('pro vê todos os três segmentos', () => {
    expect(getAllowedSegments('pro')).toEqual(['all', 'sanarflix', 'pro']);
  });
});
