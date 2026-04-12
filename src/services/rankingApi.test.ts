import { describe, it, expect } from 'vitest';
import {
  applyRankingFilters,
  getAllowedRankingSegmentFilters,
  normalizeRankingFilterValue,
  RANKING_COMPARISON_DEFAULT,
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

describe('normalizeRankingFilterValue', () => {
  it('remove espaços e ignora maiúsculas', () => {
    expect(normalizeRankingFilterValue('  Pediatria ')).toBe('pediatria');
  });
});

describe('applyRankingFilters — mesma especialidade', () => {
  it('inclui todos com a mesma especialidade após normalização, sem filtrar por instituição', () => {
    const list = [
      p({ userId: 'a', segment: 'guest', specialty: 'Pediatria', institution: 'UFBA', score: 90 }),
      p({ userId: 'b', segment: 'guest', specialty: ' pediatria ', institution: 'USP', score: 85 }),
      p({ userId: 'c', segment: 'guest', specialty: 'Cirurgia', institution: 'UFBA', score: 80 }),
    ];
    const out = applyRankingFilters(
      list,
      { bySpecialty: true, byInstitution: false },
      'all',
      'Pediatria',
      ['UFBA'],
    );
    expect(out.map((x) => x.userId).sort()).toEqual(['a', 'b']);
  });

  it('modo especialidade não exige que a instituição do participante coincida com a do usuário', () => {
    const list = [
      p({ userId: 'a', segment: 'guest', specialty: 'Pediatria', institution: 'USP', score: 70 }),
    ];
    const out = applyRankingFilters(
      list,
      { bySpecialty: true, byInstitution: false },
      'all',
      'Pediatria',
      ['UFBA'],
    );
    expect(out.map((x) => x.userId)).toEqual(['a']);
  });

  it('especialidade + instituição aplica os dois critérios (E lógico)', () => {
    const list = [
      p({ userId: 'a', segment: 'guest', specialty: 'Pediatria', institution: 'UFBA', score: 90 }),
      p({ userId: 'b', segment: 'guest', specialty: 'Pediatria', institution: 'USP', score: 85 }),
      p({ userId: 'c', segment: 'guest', specialty: 'Cirurgia', institution: 'UFBA', score: 80 }),
    ];
    const out = applyRankingFilters(
      list,
      { bySpecialty: true, byInstitution: true },
      'all',
      'Pediatria',
      ['UFBA'],
    );
    expect(out.map((x) => x.userId)).toEqual(['a']);
  });
});

describe('applyRankingFilters — segmento sanarflix', () => {
  const base = [
    p({ userId: 'a', segment: 'standard', score: 80 }),
    p({ userId: 'b', segment: 'pro', score: 90 }),
    p({ userId: 'c', segment: 'guest', score: 70 }),
  ];

  it('mantém apenas participantes standard (aluno padrão)', () => {
    const out = applyRankingFilters(base, RANKING_COMPARISON_DEFAULT, 'sanarflix', '', []);
    expect(out.map((x) => x.userId)).toEqual(['a']);
  });

  it('inclui o usuário atual mesmo sendo PRO, para contexto de posição', () => {
    const withMe = [
      ...base,
      p({ userId: 'me', segment: 'pro', score: 85, isCurrentUser: true }),
    ];
    const out = applyRankingFilters(withMe, RANKING_COMPARISON_DEFAULT, 'sanarflix', '', []);
    const ids = out.map((x) => x.userId).sort();
    expect(ids).toEqual(['a', 'me']);
  });
});
