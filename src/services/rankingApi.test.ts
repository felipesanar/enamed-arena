import { describe, it, expect, vi } from 'vitest';
const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: db }));
import {
  applyRankingFilters,
  getAllowedRankingSegmentFilters,
  normalizeRankingFilterValue,
  RANKING_COMPARISON_DEFAULT,
  fetchSimuladosWithResults,
  transformRankingData,
  type RankingParticipant,
} from '@/services/rankingApi';

it('ranking metadata is opt-in and comes from the actual joined edition', async () => {
  const builder = { select: vi.fn((_columns: string) => builder), eq: vi.fn(() => builder), lte: vi.fn(() => builder),
    order: vi.fn().mockResolvedValue({ data: [{ id: 's', title: 'S', sequence_number: 2,
      results_release_at: '2027-05-01', edition_id: 'e', exam_editions: { code: '2027.1', label: 'Alvo' } }], error: null }) };
  db.from.mockReturnValue(builder);
  const legacy = await fetchSimuladosWithResults();
  expect(builder.select).toHaveBeenLastCalledWith('id, title, sequence_number, results_release_at, status');
  expect(legacy[0]).toEqual({ id: 's', title: 'S', sequence_number: 2 });
  const scoped = await fetchSimuladosWithResults(true);
  expect(builder.select.mock.lastCall?.[0]).toContain('exam_editions');
  expect(scoped[0]).toMatchObject({ editionId: 'e', editionCode: '2027.1', editionLabel: 'Alvo', resultsReleaseAt: '2027-05-01' });
});

it('keeps all frozen institution labels and matches intersections without bypassing segment', () => {
  const participants = transformRankingData([
    { user_id: 'peer', especialidade: 'CM', instituicoes_alvo: ['Z', 'B'], segment: 'standard', nota_final: 80 },
    { user_id: 'guest', especialidade: 'CM', instituicoes_alvo: ['B'], segment: 'guest', nota_final: 90 },
  ] as never, 'me');
  expect(participants[0]).toMatchObject({ institution: 'Z', institutions: ['Z', 'B'] });
  expect(applyRankingFilters(participants, { bySpecialty: true, byInstitution: true }, 'sanarflix', 'CM', ['A', 'B'])
    .map(p => p.userId)).toEqual(['peer']);
});

it('only adds released archived exams with own finalized participation, using metadata reads', async () => {
  const sim = (id: string, status = 'archived', release = '2020-01-01') => ({ id, status, title: id,
    sequence_number: 1, results_release_at: release, edition_id: 'old', exam_editions: { code: '2026', label: '2026' } });
  const query = (data: unknown[]) => {
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), in: vi.fn(() => q), not: vi.fn(() => q),
      lte: vi.fn(() => q), order: vi.fn(() => q), then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
    return q;
  };
  const exams = query([sim('public', 'published'), sim('own'), sim('expired'), sim('other'), sim('pending'),
    sim('unfinished'), sim('future', 'archived', '2999-01-01')]);
  const attempts = query([
    { simulado_id: 'own', user_id: 'u1', status: 'submitted', finished_at: '2020-01-01' },
    { simulado_id: 'expired', user_id: 'u1', status: 'expired', finished_at: '2020-01-01' },
    { simulado_id: 'other', user_id: 'u2', status: 'submitted', finished_at: '2020-01-01' },
    { simulado_id: 'pending', user_id: 'u1', status: 'in_progress', finished_at: null },
    { simulado_id: 'unfinished', user_id: 'u1', status: 'submitted', finished_at: null },
    { simulado_id: 'future', user_id: 'u1', status: 'submitted', finished_at: '2020-01-01' },
  ]);
  db.from.mockImplementation((table: string) => table === 'attempts' ? attempts : exams);
  const result = await fetchSimuladosWithResults(true, 'u1');
  expect(result.map(s => s.id)).toEqual(['public', 'own', 'expired']);
  expect(attempts.eq).toHaveBeenCalledWith('user_id', 'u1');
  expect(attempts.in).toHaveBeenCalledWith('status', ['submitted', 'expired']);
  expect(attempts.not).toHaveBeenCalledWith('finished_at', 'is', null);
  expect(attempts.select).toHaveBeenCalledWith('simulado_id,user_id,status,finished_at');
  db.from.mockClear();
  await fetchSimuladosWithResults(false, 'u1');
  expect(db.from).toHaveBeenCalledTimes(1); expect(db.from).toHaveBeenCalledWith('simulados');
  expect(exams.eq).toHaveBeenCalledWith('status', 'published');
  db.from.mockClear();
  await fetchSimuladosWithResults(true);
  expect(db.from).toHaveBeenCalledTimes(1);
});

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
