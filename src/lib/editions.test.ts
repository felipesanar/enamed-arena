import { describe, expect, it } from 'vitest';
import { getDaysUntil, getNextEdition } from '@/lib/editions';
import type { ExamEdition } from '@/types/edition';

const edition = (overrides: Partial<ExamEdition> = {}): ExamEdition => ({
  id: '1', code: '2027.1', year: 2027, term: 1, label: 'ENAMED 2027.1',
  status: 'planned', exam_date: null, exam_date_confirmed: false,
  official_results_at: null, format: {}, created_at: '', updated_at: '', ...overrides,
});

describe('getDaysUntil', () => {
  it('retorna null sem data', () => expect(getDaysUntil(null, new Date())).toBeNull());
  it('28/11 nao usa a antiga data fixa', () => {
    expect(getDaysUntil('2027-01-01', new Date('2026-11-28T12:00:00-03:00'))).toBe(34);
  });
  it('dia zero durante todo o dia de Sao Paulo', () => {
    expect(getDaysUntil('2026-11-28', new Date('2026-11-29T02:59:59Z'))).toBe(0);
  });
  it('virada UTC nao antecipa o dia em SP', () => {
    expect(getDaysUntil('2026-11-29', new Date('2026-11-29T02:59:59Z'))).toBe(1);
    expect(getDaysUntil('2026-11-29', new Date('2026-11-29T03:00:00Z'))).toBe(0);
  });
});

describe('getNextEdition', () => {
  const now = new Date('2026-11-28T12:00:00-03:00');
  it('ignora encerradas/arquivadas e datas passadas', () => {
    expect(getNextEdition([
      edition({ status: 'closed', exam_date: '2027-01-01' }),
      edition({ status: 'archived', exam_date: '2027-01-01' }),
      edition({ status: 'active', exam_date: '2026-09-13' }),
    ], now)).toBeNull();
  });
  it('prefere a primeira data futura, inclusive hoje, sem mutar entrada', () => {
    const editions = [edition({ exam_date: '2027-01-01' }), edition({ exam_date: '2026-11-28' })];
    expect(getNextEdition(editions, now)).toBe(editions[1]);
    expect(editions[0].exam_date).toBe('2027-01-01');
  });
  it('proximo ano sem data usa year/term e apenas planned/preparing', () => {
    const next = edition();
    expect(getNextEdition([
      edition({ year: 2028 }), edition({ term: 2 }),
      edition({ year: 2026, status: 'active' }), next,
    ], now)).toBe(next);
  });
  it('lista vazia', () => expect(getNextEdition([], now)).toBeNull());
});
