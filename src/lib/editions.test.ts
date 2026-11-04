import { describe, expect, it } from 'vitest';
import { getDaysUntil, getNextEdition, resolveUserEdition, selectCurrentSimulado, formatSimuladoLabel } from '@/lib/editions';
import type { SimuladoWithStatus } from '@/types';
import type { ExamEdition } from '@/types/edition';

const edition = (overrides: Partial<ExamEdition> = {}): ExamEdition => ({
  id: '1', code: '2027.1', year: 2027, term: 1, label: 'ENAMED 2027.1',
  status: 'planned', exam_date: null, exam_date_confirmed: false,
  official_results_at: null, format: {}, created_at: '', updated_at: '', ...overrides,
});

describe('getDaysUntil', () => {
  it.each(['2027-02-29', '2026-13-01', '2026-04-31', 'bad', '2026-1-01'])('rejeita calendario invalido: %s', (date) => {
    expect(getDaysUntil(date, new Date())).toBeNull();
  });
  it('rejeita now invalido e aceita ano bissexto', () => {
    expect(getDaysUntil('2028-02-29', new Date('invalid'))).toBeNull();
    expect(getDaysUntil('2028-02-29', new Date('2028-02-28T12:00:00Z'))).toBe(1);
  });
  it('nao desloca anos abaixo de 100 para 1900', () => {
    expect(getDaysUntil('0100-01-01', new Date('0099-12-31T15:00:00Z'))).toBe(1);
  });
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

describe('resolveUserEdition', () => {
  const now = new Date('2026-11-28T12:00:00Z');
  const old = edition({ id: 'old', code: '2026', status: 'archived', year: 2026 });
  const next = edition({ id: 'next', exam_date: '2027-01-01' });
  it('respeita alvo historico explicito e termo de graduacao', () => {
    expect(resolveUserEdition([next, old], { targetEditionId: 'old' }, now)).toBe(old);
    expect(resolveUserEdition([next, old], { targetEditionId: 'missing', expectedGraduationTerm: '2026' }, now)).toBe(old);
  });
  it('alvo invalido cai na data futura mais proxima, inclusive hoje', () => {
    const today = edition({ id: 'today', exam_date: '2026-11-28' });
    expect(resolveUserEdition([next, today], { targetEditionId: 'bad' }, now)).toBe(today);
  });
  it('sem data prefere preparing/active por ano/termo antes de planned', () => {
    const active = edition({ id: 'active', year: 2028, status: 'active' });
    const preparing = edition({ id: 'preparing', year: 2027, status: 'preparing' });
    const values = Object.freeze([next, active, preparing]);
    expect(resolveUserEdition(values, null, new Date('2029-01-01'))).toBe(preparing);
    expect(resolveUserEdition([edition(), old], null, now)?.code).toBe('2027.1');
    expect(resolveUserEdition([old], null, now)).toBeNull();
    expect(resolveUserEdition([], null, now)).toBeNull();
  });
});

const sim = (overrides: Partial<SimuladoWithStatus> = {}): SimuladoWithStatus => ({
  id: 's1', slug: 's1', title: 'S1', sequenceNumber: 1, editionId: '1',
  description: '', questionsCount: 100, estimatedDuration: '5h', estimatedDurationMinutes: 300,
  executionWindowStart: '2026-11-28T10:00:00Z', executionWindowEnd: '2026-11-28T20:00:00Z',
  resultsReleaseAt: '2026-11-29T10:00:00Z', themeTags: [], dbStatus: 'published', status: 'upcoming', ...overrides,
});
const started = (at: string, finished = false) => ({ simuladoId: 's1', started: true, startedAt: at, finished });

describe('selectCurrentSimulado', () => {
  const now = new Date('2026-11-28T12:00:00Z');
  it('isola edicao, exclui legado/drafts/testes e nao muta', () => {
    const own = sim();
    const values = Object.freeze([sim({ editionId: '2', userState: started('2026-11-28T11:00:00Z') }),
      sim({ editionId: undefined }), sim({ dbStatus: 'draft' }), sim({ dbStatus: 'test' }), own]);
    expect(selectCurrentSimulado(values, edition(), now)).toBe(own);
    expect(selectCurrentSimulado(values, null, now)).toBeNull();
    expect(selectCurrentSimulado([], edition(), now)).toBeNull();
    expect(selectCurrentSimulado([sim({ editionId: '2' })], edition(), now)).toBeNull();
  });
  it('prioriza tentativa mais recente apenas na edicao solicitada', () => {
    const recent = sim({ id: 'recent', userState: started('2026-11-28T11:00:00Z') });
    expect(selectCurrentSimulado([sim(), sim({ userState: started('2026-11-28T10:00:00Z') }), recent], edition(), now)).toBe(recent);
  });
  it('duas janelas abertas: fecha primeiro, depois sequencia/id estaveis', () => {
    const first = sim({ id: 'a', executionWindowEnd: '2026-11-28T19:00:00Z' });
    expect(selectCurrentSimulado([sim({ id: 'b' }), first], edition(), now)).toBe(first);
    const tied = sim({ id: 'a' });
    expect(selectCurrentSimulado([sim({ id: 'b' }), tied], edition(), now)).toBe(tied);
    expect(selectCurrentSimulado([tied, sim({ id: 'b' })], edition(), now)).toBe(tied);
  });
  it('recalcula status obsoleto e escolhe proximo antes de resultado e treino', () => {
    const future = sim({ id: 'future', executionWindowStart: '2026-12-01T10:00:00Z', executionWindowEnd: '2026-12-01T20:00:00Z', status: 'available_late' });
    const training = sim({ executionWindowStart: '2026-11-27T10:00:00Z', executionWindowEnd: '2026-11-27T20:00:00Z', status: 'available' });
    expect(selectCurrentSimulado([training, future], edition(), now)).toBe(future);
    expect(selectCurrentSimulado([future], edition(), now)).toBe(future);
    const invalid = sim({ executionWindowStart: 'invalid', status: 'available' });
    expect(selectCurrentSimulado([invalid], edition(), now)).toBeNull();
  });
  it('tentativa futura nao prevalece como treino ou andamento; fuso compara instantes', () => {
    const open = sim({ id: 'open', executionWindowStart: '2026-11-28T07:00:00-03:00' });
    const future = sim({ id: 'future', userState: started('2026-11-28T11:00:00Z'), status: 'available_late',
      executionWindowStart: '2026-12-01T10:00:00Z', executionWindowEnd: '2026-12-01T20:00:00Z' });
    expect(selectCurrentSimulado([future, open], edition(), now)).toBe(open);
    expect(selectCurrentSimulado([open], edition(), new Date('invalid'))).toBeNull();
  });
  it('arquivado so aparece com tentativa, e treino iniciado pode continuar', () => {
    expect(selectCurrentSimulado([sim({ dbStatus: 'archived' })], edition(), now)).toBeNull();
    const training = sim({ dbStatus: 'archived', executionWindowStart: '2026-11-27T10:00:00Z',
      executionWindowEnd: '2026-11-27T20:00:00Z', userState: started('2026-11-28T11:00:00Z') });
    expect(selectCurrentSimulado([sim(), training], edition(), now)).toBe(training);
  });
  it('aguardando precede resultado liberado mais recente, que precede treino', () => {
    const training = sim({ executionWindowStart: '2026-11-27T10:00:00Z', executionWindowEnd: '2026-11-27T20:00:00Z' });
    const released = sim({ id: 'released', userState: started('2026-11-27T10:00:00Z', true), resultsReleaseAt: '2026-11-28T11:00:00Z' });
    const waiting = sim({ id: 'waiting', userState: started('2026-11-28T11:00:00Z', true) });
    expect(selectCurrentSimulado([training, released, waiting], edition(), now)).toBe(waiting);
    expect(selectCurrentSimulado([training, released], edition(), now)).toBe(released);
    expect(selectCurrentSimulado([training], edition(), now)).toBe(training);
    const older = sim({ ...released, id: 'older', resultsReleaseAt: '2026-11-28T10:00:00Z' });
    expect(selectCurrentSimulado([older, released], edition(), now)).toBe(released);
  });
  it('preserva limites estritos do deriveSimuladoStatus', () => {
    const current = sim();
    const upcoming = sim({ id: 'next', executionWindowStart: '2026-12-01T10:00:00Z', executionWindowEnd: '2026-12-01T20:00:00Z' });
    expect(selectCurrentSimulado([upcoming, current], edition(), new Date(current.executionWindowStart))).toBe(current);
    expect(selectCurrentSimulado([upcoming, current], edition(), new Date(current.executionWindowEnd))).toBe(current);
    expect(selectCurrentSimulado([upcoming, current], edition(), new Date('2026-11-28T20:00:00.001Z'))).toBe(upcoming);
    const finished = sim({ userState: started('2026-11-28T11:00:00Z', true) });
    const otherWaiting = sim({ id: 'other', userState: started('2026-11-28T11:00:00Z', true), resultsReleaseAt: '2026-11-30T10:00:00Z' });
    expect(selectCurrentSimulado([otherWaiting, finished], edition(), new Date(finished.resultsReleaseAt))).toBe(finished);
    expect(selectCurrentSimulado([finished, otherWaiting], edition(), new Date('2026-11-29T10:00:00.001Z'))).toBe(otherWaiting);
  });
});

describe('formatSimuladoLabel', () => {
  it('usa codigo explicito, nunca infere edicao', () => {
    expect(formatSimuladoLabel(sim({ editionCode: '2027.1', sequenceNumber: 3 }))).toBe('2027.1 · Simulado 3');
    expect(formatSimuladoLabel(sim())).toBe('Simulado 1');
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
  it('fallback deterministico mesmo com datas e termos empatados', () => {
    const a = edition({ id: 'a' });
    const b = edition({ id: 'b' });
    expect(getNextEdition([b, a], now)).toBe(a);
    expect(getNextEdition([a, b], now)).toBe(a);
  });
});
