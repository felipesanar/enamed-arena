/**
 * retaFinalPlan — algoritmo puro de priorização da Reta Final ENAMED.
 *
 * Totalmente client-side, sem efeitos colaterais. Testável de forma isolada.
 *
 * Contrato §13 de 00-contratos-canonicos.md:
 *   - Sem novas tabelas, RPCs ou edge functions.
 *   - Opera sobre dados já existentes: getErrorNotebook() + campos SRS.
 */

import { getAreaWeight, resolveBlueprintArea } from '@/lib/enamedBlueprint';
import { getDaysUntil, getNextEdition } from '@/lib/editions';
import { validateExamFormat } from '@/lib/edition-format';
import type { ExamArea, ExamBlueprint, ExamEdition } from '@/types/edition';
import type { EditionStudyContext, StudyAreaWeight } from '@/types/edition-calendar';

const validWeights = (areas: readonly StudyAreaWeight[]) => areas.length > 0
  && areas.every(a => typeof a.code === 'string' && !!a.code.trim() && typeof a.label === 'string'
    && Array.isArray(a.aliases) && a.aliases.every(alias => typeof alias === 'string')
    && Number.isFinite(a.weight) && a.weight > 0 && a.weight <= 1)
  && Math.abs(areas.reduce((sum, a) => sum + a.weight, 0) - 1) < 0.000001;

/** Selected IDs never fall back to another year, including when missing from the catalog. */
export function resolveEditionStudyContext(
  editions: readonly ExamEdition[], selectedId: string | null, now: Date,
  matrix?: { blueprint: ExamBlueprint; areas: readonly ExamArea[] },
): EditionStudyContext {
  const edition = selectedId !== null ? editions.find(e => e.id === selectedId) ?? null : getNextEdition(editions, now);
  const format = validateExamFormat(edition?.format);
  const areas = matrix?.areas ?? [];
  const validMatrix = !!edition?.blueprint_id && matrix?.blueprint.id === edition.blueprint_id
    && typeof matrix.blueprint.weights_provisional === 'boolean'
    && areas.every(a => a.blueprint_id === edition.blueprint_id) && validWeights(areas);
  const date = edition?.exam_date_confirmed && getDaysUntil(edition.exam_date, now) !== null ? edition.exam_date : null;
  return { edition, date, daysUntil: getDaysUntil(date, now), format: format.valid ? format.value : null,
    matrixStatus: !validMatrix ? 'unavailable' : matrix.blueprint.weights_provisional ? 'provisional' : 'available',
    areaWeights: validMatrix ? areas.map(({ code, label, aliases, weight }) => ({ code, label, aliases: [...aliases], weight })) : [] };
}

// ─── Tipos de entrada ───────────────────────────────────────────────────────

/** Subconjunto mínimo de uma entrada do caderno necessário para o plano. */
export interface RetaFinalEntry {
  id: string;
  area: string | null;
  theme: string | null;
  reason: string | null;
  /** Data limite SRS (campo canônico srs_due_at). */
  srs_due_at: string | null;
  /** Número de repetições SRS corretas consecutivas. */
  srs_reps: number | null;
  /** Número de lapsos (erros após acerto). */
  srs_lapses: number | null;
  /** Se preenchido, entrada foi dominada automaticamente. */
  mastered_at: string | null;
}

export interface BuildRetaFinalPlanInput {
  entries: RetaFinalEntry[];
  /** Data oficial YYYY-MM-DD, Date legado, ou null se nao divulgada. */
  enamedDate: Date | string | null;
  /** Data de hoje. */
  today: Date;
  /**
   * Capacidade diária de revisões.
   * @default 15
   */
  dailyCapacity?: number;
  /** Omitted = legacy behavior. Empty/invalid = neutral weighting, never 2026 fallback. */
  areaWeights?: readonly StudyAreaWeight[];
}

// ─── Tipos de saída ──────────────────────────────────────────────────────────

export interface DayPlan {
  /** Data do dia (início do dia local, sem hora). */
  date: Date;
  /** Entradas priorizadas para este dia. */
  entries: RetaFinalEntry[];
}

export interface RetaFinalStats<DaysUntil extends number | null = number> {
  /** Total de entradas ativas (não dominadas). */
  totalActive: number;
  /** Entradas vencidas (srs_due_at <= hoje). */
  overdue: number;
  /** Entradas dominadas (excluídas do plano). */
  mastered: number;
  /** Entradas que cabem no plano (dados os dias + capacidade). */
  covered: number;
  /** Entradas que não caberão antes do ENAMED. */
  uncovered: number;
  /** Dias restantes em SP; null quando a data oficial nao foi divulgada. */
  daysUntil: DaysUntil;
}

export interface RetaFinalPlan {
  /** Dias em SP (null = sem data, negativo = prova ja passou). */
  daysUntil: number | null;
  /** Se true, prova já ocorreu — plano retorna vazio (não lança erro). */
  examPassed: boolean;
  /** Plano dia a dia. Vazio sem data ou quando nao restam dias antes da prova. */
  plan: DayPlan[];
  /** Entradas do dia de hoje (atalho conveniente). */
  todayEntries: RetaFinalEntry[];
  stats: RetaFinalStats<number | null>;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

const spCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Inicio do dia de SP, independente do fuso do navegador. */
function startOfDay(d: Date): Date {
  return new Date(`${spCalendar.format(d)}T00:00:00-03:00`);
}

/**
 * Calcula o score de priorização de uma entrada.
 * Score mais alto = revisão mais urgente.
 *
 * Componentes:
 *  1. Vencida (srs_due_at <= hoje): +5 pontos base
 *  2. Lapsos altos (leech risk): +srs_lapses × 0.8
 *  3. Peso ENAMED da área: peso × 4
 *  4. Frequência de erro na área (passado via mapa externo): +freqScore
 *  5. Sem repetições (nunca revisado): +1.5
 */
function calcScore(
  entry: RetaFinalEntry,
  todayMs: number,
  areaFreqMap: Map<string, number>,
  areaWeights?: readonly StudyAreaWeight[],
): number {
  let score = 0;

  // 1. Vencida
  const srs_due_at = (entry as any).srs_due_at ?? (entry as any).srsDueAt;
  if (srs_due_at) {
    const dueMs = new Date(srs_due_at).getTime();
    if (dueMs <= todayMs) score += 5;
  } else {
    // Sem data SRS = nunca revisada = urgente
    score += 4;
  }

  // 2. Lapsos
  const lapses = (entry as any).srs_lapses ?? (entry as any).srsLapses ?? 0;
  score += lapses * 0.8;

  // 3. Peso ENAMED da área
  const areaWeight = areaWeights === undefined ? getAreaWeight(entry.area)
    : validWeights(areaWeights) ? resolveBlueprintArea(entry.area ?? '', areaWeights as ExamArea[])?.weight ?? 0 : 0;
  score += areaWeight * 4;

  // 4. Frequência de erro na área
  const areaKey = (entry.area ?? '').toLowerCase();
  const freq = areaFreqMap.get(areaKey) ?? 0;
  const maxFreq = Math.max(...Array.from(areaFreqMap.values()), 1);
  const freqScore = (freq / maxFreq) * 2;
  score += freqScore;

  // 5. Nunca revisado
  const reps = (entry as any).srs_reps ?? (entry as any).srsReps ?? 0;
  if (reps === 0) score += 1.5;

  return score;
}

// ─── Função principal (pura, sem side-effects) ───────────────────────────────

/**
 * buildRetaFinalPlan — constrói o plano de revisão da Reta Final ENAMED.
 *
 * @param input.entries     Entradas do caderno de erros (todos os campos SRS).
 * @param input.enamedDate  Data da prova.
 * @param input.today       Data de hoje (injetada para testabilidade).
 * @param input.dailyCapacity Capacidade diária de revisões (default 15).
 *
 * @returns RetaFinalPlan com plano dia-a-dia e estatísticas.
 */
export function buildRetaFinalPlan({
  entries,
  enamedDate,
  today,
  dailyCapacity = 15,
  areaWeights,
}: BuildRetaFinalPlanInput): RetaFinalPlan {
  const todayStart = startOfDay(today);
  const examDate = enamedDate instanceof Date
    ? spCalendar.format(enamedDate)
    : enamedDate;
  const daysUntil = getDaysUntil(examDate, today);

  // Sem data ou sem dias de preparacao; dia zero nao e prova encerrada.
  if (daysUntil === null || daysUntil <= 0) {
    const mastered = entries.filter((e) => {
      const m = (e as any).mastered_at ?? (e as any).masteredAt;
      return !!m;
    }).length;
    return {
      daysUntil,
      examPassed: daysUntil !== null && daysUntil < 0,
      plan: [],
      todayEntries: [],
      stats: {
        totalActive: entries.length - mastered,
        overdue: 0,
        mastered,
        covered: 0,
        uncovered: 0,
        daysUntil,
      },
    };
  }

  const todayMs = todayStart.getTime();

  // 1. Separar dominadas (excluir do plano)
  const active: RetaFinalEntry[] = [];
  let masteredCount = 0;
  for (const e of entries) {
    const m = (e as any).mastered_at ?? (e as any).masteredAt;
    if (m) {
      masteredCount++;
    } else {
      active.push(e);
    }
  }

  // 2. Mapear frequência de erro por área
  const areaFreqMap = new Map<string, number>();
  for (const e of active) {
    const key = (e.area ?? '').toLowerCase();
    areaFreqMap.set(key, (areaFreqMap.get(key) ?? 0) + 1);
  }

  // 3. Contar vencidas
  const overdueCount = active.filter((e) => {
    const srs_due_at = (e as any).srs_due_at ?? (e as any).srsDueAt;
    if (!srs_due_at) return true; // sem data = urgente = vencida
    return new Date(srs_due_at).getTime() <= todayMs;
  }).length;

  // 4. Ordenar por score (maior primeiro)
  const scored = active.map((e) => ({
    entry: e,
    score: calcScore(e, todayMs, areaFreqMap, areaWeights),
  }));
  scored.sort((a, b) => b.score - a.score);
  const sorted = scored.map((s) => s.entry);

  // 5. Distribuir em dias
  const plan: DayPlan[] = [];
  let entryIndex = 0;
  const totalSlots = daysUntil * dailyCapacity;

  for (let dayOffset = 0; dayOffset < daysUntil; dayOffset++) {
    const date = new Date(todayStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayEntries: RetaFinalEntry[] = [];
    for (let slot = 0; slot < dailyCapacity && entryIndex < sorted.length; slot++) {
      dayEntries.push(sorted[entryIndex]);
      entryIndex++;
    }
    // Inclui o dia mesmo se vazio (dias finais podem ficar vazios se acabaram as entradas)
    plan.push({ date, entries: dayEntries });
  }

  const covered = Math.min(sorted.length, totalSlots);
  const uncovered = Math.max(0, sorted.length - totalSlots);

  const todayPlan = plan.find(
    (d) => d.date.getTime() === todayStart.getTime(),
  );
  const todayEntries = todayPlan?.entries ?? [];

  return {
    daysUntil,
    examPassed: false,
    plan,
    todayEntries,
    stats: {
      totalActive: active.length,
      overdue: overdueCount,
      mastered: masteredCount,
      covered,
      uncovered,
      daysUntil,
    },
  };
}
