/**
 * retaFinalPlan — testes unitários.
 *
 * Cobertura:
 *   1. Priorização: entradas vencidas aparecem antes das agendadas.
 *   2. Exclusão: dominadas (mastered_at preenchido) não entram no plano.
 *   3. Distribuição: capacidade diária respeitada.
 *   4. Prova no passado: daysUntil < 0 → examPassed=true, plan vazio.
 *   5. Sem entradas: plan com slots vazios, stats zerados.
 */

import { describe, it, expect } from 'vitest';
import { buildRetaFinalPlan, resolveEditionStudyContext, type RetaFinalEntry } from './retaFinalPlan';
import type { ExamEdition } from '@/types/edition';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date('2026-06-06T00:00:00-03:00');
const ENAMED = new Date('2026-11-28T00:00:00-03:00');

describe('edition study context', () => {
  const edition: ExamEdition = { id: 'target', code: '2027.2', blueprint_id: 'bp', exam_date: null, exam_date_confirmed: false,
    year: 2027, term: 2, label: 'ENAMED 2027.2', status: 'preparing', official_results_at: null, created_at: '', updated_at: '',
    format: { questions: 100, options: 4, duration_minutes: 300, scoring: 'tri' } };
  it('selected target wins even without date; a missing selected ID never silently uses next edition', () => {
    expect(resolveEditionStudyContext([edition], 'target', TODAY).edition).toBe(edition);
    expect(resolveEditionStudyContext([edition], 'missing', TODAY).edition).toBeNull();
    const context = resolveEditionStudyContext([edition], 'target', TODAY);
    expect(context.date).toBeNull();
    expect(context.format?.questions).toBe(100);
    expect(context.matrixStatus).toBe('unavailable');
    expect(context.areaWeights).toEqual([]);
  });
  it('validates format and matches blueprint IDs; marks provisional weights', () => {
    const blueprint = { id: 'bp', code: 'demo', label: 'Demo', weights_provisional: true };
    const areas = [{ id: 'a', blueprint_id: 'bp', code: 'a', label: 'A', aliases: ['Alias'], weight: 1, sort_order: 1 }];
    expect(resolveEditionStudyContext([edition], 'target', TODAY, { blueprint, areas }).matrixStatus).toBe('provisional');
    expect(resolveEditionStudyContext([{ ...edition, format: {} }], 'target', TODAY).format).toBeNull();
    expect(resolveEditionStudyContext([edition], 'target', TODAY, { blueprint: { ...blueprint, id: 'wrong' }, areas }).matrixStatus).toBe('unavailable');
    expect(resolveEditionStudyContext([edition], 'target', TODAY, { blueprint, areas: [{ ...areas[0], weight: NaN }] }).areaWeights).toEqual([]);
    expect(resolveEditionStudyContext([edition], 'target', TODAY, { blueprint, areas: [{ ...areas[0], blueprint_id: 'wrong' }] }).areaWeights).toEqual([]);
    expect(resolveEditionStudyContext([edition], 'target', TODAY, { blueprint: { ...blueprint, weights_provisional: false }, areas }).matrixStatus).toBe('available');
  });
  it('resolves confirmed dates with SP boundaries; unknown and unconfirmed dates stay null', () => {
    const dated = { ...edition, exam_date: '2027-08-01', exam_date_confirmed: true };
    const now = new Date('2027-08-01T02:30:00Z');
    expect(resolveEditionStudyContext([dated], 'target', now).daysUntil).toBe(1);
    expect(resolveEditionStudyContext([dated], 'target', new Date('2027-08-01T03:00:00Z')).daysUntil).toBe(0);
    expect(resolveEditionStudyContext([dated], 'target', new Date('2027-08-02T03:00:00Z')).daysUntil).toBe(-1);
    expect(resolveEditionStudyContext([{ ...dated, exam_date_confirmed: false }], 'target', now).date).toBeNull();
    expect(resolveEditionStudyContext([{ ...dated, exam_date: '2027-02-30' }], 'target', now).date).toBeNull();
    expect(resolveEditionStudyContext([dated], null, now).edition).toBe(dated);
  });
  it('uses additive weights with exact aliases, neutral invalid weights, and unchanged omitted defaults', () => {
    const entries = [makeEntry({ id: 'clinic', area: 'Clínica Médica' }), makeEntry({ id: 'alias', area: 'ALIAS' })];
    const input = { entries, enamedDate: ENAMED, today: TODAY };
    expect(buildRetaFinalPlan(input)).toEqual(buildRetaFinalPlan({ ...input, areaWeights: undefined }));
    expect(buildRetaFinalPlan({ ...input, areaWeights: [{ code: 'x', label: 'X', aliases: ['alias'], weight: 1 }] }).todayEntries[0].id).toBe('alias');
    expect(buildRetaFinalPlan({ ...input, areaWeights: [] }).todayEntries.map(e => e.id)).toEqual(['clinic', 'alias']);
    expect(buildRetaFinalPlan({ ...input, areaWeights: [{ code: 'x', label: 'X', aliases: ['alias'], weight: Infinity }] }).todayEntries[0].id).toBe('clinic');
  });
});

function makeEntry(overrides: Partial<RetaFinalEntry> & { id: string }): RetaFinalEntry {
  return {
    id: overrides.id,
    area: overrides.area ?? 'Clínica Médica',
    theme: overrides.theme ?? 'Cardiologia',
    reason: overrides.reason ?? 'did_not_know',
    srs_due_at: overrides.srs_due_at ?? null,
    srs_reps: overrides.srs_reps ?? 0,
    srs_lapses: overrides.srs_lapses ?? 0,
    mastered_at: overrides.mastered_at ?? null,
  };
}

/** Data N dias atrás (vencida). */
function daysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Data N dias à frente (futura). */
function daysAhead(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('buildRetaFinalPlan', () => {

  it('sem data nao inventa dias nem considera a prova passada', () => {
    const result = buildRetaFinalPlan({ entries: [makeEntry({ id: 'pending' })], enamedDate: null, today: TODAY });
    expect(result.daysUntil).toBeNull();
    expect(result.stats.daysUntil).toBeNull();
    expect(result.examPassed).toBe(false);
    expect(result.plan).toEqual([]);
    expect(result.stats.totalActive).toBe(1);
  });

  it('usa dias de calendario SP com string do banco', () => {
    const result = buildRetaFinalPlan({ entries: [], enamedDate: '2026-11-29', today: new Date('2026-11-29T02:00:00Z') });
    expect(result.daysUntil).toBe(1);
    expect(result.plan[0].date.toISOString()).toBe('2026-11-28T03:00:00.000Z');
  });

  it('1 — prioriza entradas vencidas (srs_due_at <= hoje) sobre agendadas', () => {
    const overdue = makeEntry({ id: 'overdue', srs_due_at: daysAgo(3) });
    const scheduled = makeEntry({ id: 'scheduled', srs_due_at: daysAhead(10) });

    const result = buildRetaFinalPlan({
      entries: [scheduled, overdue], // scheduled primeiro na lista de input
      enamedDate: ENAMED,
      today: TODAY,
      dailyCapacity: 15,
    });

    expect(result.examPassed).toBe(false);
    expect(result.todayEntries.length).toBeGreaterThan(0);
    // A entrada vencida deve aparecer antes da agendada no plano do dia
    const todayIds = result.todayEntries.map((e) => e.id);
    const overdueIdx = todayIds.indexOf('overdue');
    const scheduledIdx = todayIds.indexOf('scheduled');
    expect(overdueIdx).toBeGreaterThanOrEqual(0);
    expect(scheduledIdx).toBeGreaterThanOrEqual(0);
    expect(overdueIdx).toBeLessThan(scheduledIdx);
  });

  it('2 — exclui entradas dominadas (mastered_at preenchido)', () => {
    const mastered = makeEntry({ id: 'mastered', mastered_at: daysAgo(5) });
    const active = makeEntry({ id: 'active', srs_due_at: daysAgo(1) });

    const result = buildRetaFinalPlan({
      entries: [mastered, active],
      enamedDate: ENAMED,
      today: TODAY,
    });

    const allIds = result.plan.flatMap((d) => d.entries.map((e) => e.id));
    expect(allIds).not.toContain('mastered');
    expect(allIds).toContain('active');
    expect(result.stats.mastered).toBe(1);
    expect(result.stats.totalActive).toBe(1);
  });

  it('3 — distribui respeitando capacidade diária', () => {
    const entries = Array.from({ length: 30 }, (_, i) =>
      makeEntry({ id: `entry-${i}`, srs_due_at: daysAgo(1) }),
    );

    const result = buildRetaFinalPlan({
      entries,
      enamedDate: ENAMED,
      today: TODAY,
      dailyCapacity: 5,
    });

    for (const day of result.plan) {
      expect(day.entries.length).toBeLessThanOrEqual(5);
    }
    // Total coberto = min(entries.length, dias × capacidade)
    const totalCovered = result.plan.reduce((s, d) => s + d.entries.length, 0);
    if (result.daysUntil === null) throw new Error('Uma data conhecida deve produzir dias numericos');
    expect(totalCovered).toBe(Math.min(30, result.daysUntil * 5));
    expect(result.stats.covered).toBe(Math.min(30, result.daysUntil * 5));
  });

  it('4 — prova no passado: examPassed=true, plan vazio', () => {
    const pastEnamed = new Date('2025-11-28T00:00:00-03:00');
    const entries = [makeEntry({ id: 'e1', srs_due_at: daysAgo(1) })];

    const result = buildRetaFinalPlan({
      entries,
      enamedDate: pastEnamed,
      today: TODAY,
    });

    expect(result.examPassed).toBe(true);
    expect(result.daysUntil).toBeLessThanOrEqual(0);
    expect(result.plan).toHaveLength(0);
    expect(result.todayEntries).toHaveLength(0);
  });

  it('4b — prova no mesmo dia: nao considera encerrada', () => {
    const result = buildRetaFinalPlan({
      entries: [makeEntry({ id: 'e1' })],
      enamedDate: TODAY, // hoje = dia da prova
      today: TODAY,
    });

    expect(result.examPassed).toBe(false);
    expect(result.plan).toHaveLength(0);
  });

  it('5 — sem entradas: plan gerado, stats zerados', () => {
    const result = buildRetaFinalPlan({
      entries: [],
      enamedDate: ENAMED,
      today: TODAY,
    });

    expect(result.examPassed).toBe(false);
    expect(result.stats.totalActive).toBe(0);
    expect(result.stats.mastered).toBe(0);
    expect(result.stats.covered).toBe(0);
    expect(result.stats.uncovered).toBe(0);
    // Plan gerado com todos os dias, mas cada dia tem 0 entradas
    expect(result.plan.length).toBe(result.daysUntil);
    result.plan.forEach((day) => expect(day.entries).toHaveLength(0));
    expect(result.todayEntries).toHaveLength(0);
  });

  it('6 — entradas com muitos lapsos recebem score mais alto que sem lapsos', () => {
    const highLapse = makeEntry({
      id: 'high-lapse',
      srs_lapses: 5,
      srs_due_at: daysAhead(5), // não vencida
    });
    const noLapse = makeEntry({
      id: 'no-lapse',
      srs_lapses: 0,
      srs_due_at: daysAhead(5),
    });

    const result = buildRetaFinalPlan({
      entries: [noLapse, highLapse],
      enamedDate: ENAMED,
      today: TODAY,
    });

    const todayIds = result.todayEntries.map((e) => e.id);
    const highIdx = todayIds.indexOf('high-lapse');
    const noIdx = todayIds.indexOf('no-lapse');
    // high-lapse deve aparecer antes de no-lapse
    expect(highIdx).toBeLessThan(noIdx);
  });

  it('7 — daysUntil é calculado corretamente', () => {
    // Exatamente 175 dias até 28/11
    const result = buildRetaFinalPlan({
      entries: [],
      enamedDate: ENAMED,
      today: TODAY,
    });

    // deve ser positivo e refletir dias reais
    expect(result.daysUntil).toBeGreaterThan(0);
    expect(result.daysUntil).toBe(result.plan.length);
  });

  it('8 — uncovered = entries além da capacidade total disponível', () => {
    // 2 dias × 3 capacidade = 6 slots; 10 entradas → 4 descobertas
    const nearEnamed = new Date(TODAY);
    nearEnamed.setDate(nearEnamed.getDate() + 2);

    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ id: `e${i}`, srs_due_at: daysAgo(1) }),
    );

    const result = buildRetaFinalPlan({
      entries,
      enamedDate: nearEnamed,
      today: TODAY,
      dailyCapacity: 3,
    });

    expect(result.stats.covered).toBe(6);
    expect(result.stats.uncovered).toBe(4);
  });
});
