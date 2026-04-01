import { describe, it, expect } from 'vitest';
import {
  applyRankingFilters,
  getAllowedRankingSegmentFilters,
  type RankingParticipant,
} from '@/services/rankingApi';

function p(
  overrides: Partial<RankingParticipant> & Pick<RankingParticipant, 'userId' | 'segment' | 'score'>,
): RankingParticipant {
  return {
    position: 1,
    name: 'X',
    specialty: '—',
    institution: '—',
    isCurrentUser: false,
    ...overrides,
  };
}

describe('getAllowedRankingSegmentFilters', () => {
  it('guest vê apenas "all"', () => {
    expect(getAllowedRankingSegmentFilters('guest')).toEqual(['all']);
  });

  it('standard vê "all" e "sanarflix"', () => {
    expect(getAllowedRankingSegmentFilters('standard')).toEqual(['all', 'sanarflix']);
  });

  it('pro vê os três filtros', () => {
    expect(getAllowedRankingSegmentFilters('pro')).toEqual(['all', 'sanarflix', 'pro']);
  });
});

describe('applyRankingFilters — segmento sanarflix', () => {
  const base = [
    p({ userId: 'a', segment: 'standard', score: 80 }),
    p({ userId: 'b', segment: 'pro', score: 90 }),
    p({ userId: 'c', segment: 'guest', score: 70 }),
  ];

  it('mantém apenas participantes standard (aluno padrão)', () => {
    const out = applyRankingFilters(base, 'all', 'sanarflix', '', []);
    expect(out.map((x) => x.userId)).toEqual(['a']);
  });

  it('inclui o usuário atual mesmo sendo PRO, para contexto de posição', () => {
    const withMe = [
      ...base,
      p({ userId: 'me', segment: 'pro', score: 85, isCurrentUser: true }),
    ];
    const out = applyRankingFilters(withMe, 'all', 'sanarflix', '', []);
    const ids = out.map((x) => x.userId).sort();
    expect(ids).toEqual(['a', 'me']);
  });
});
