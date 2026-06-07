/**
 * retaFinalPlan — algoritmo puro de priorização da Reta Final ENAMED.
 *
 * Totalmente client-side, sem efeitos colaterais. Testável de forma isolada.
 *
 * Contrato §13 de 00-contratos-canonicos.md:
 *   - Sem novas tabelas, RPCs ou edge functions.
 *   - Opera sobre dados já existentes: getErrorNotebook() + campos SRS.
 */

import { getAreaWeight } from '@/lib/enamedBlueprint';

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
  /** Data da prova (ENAMED). */
  enamedDate: Date;
  /** Data de hoje. */
  today: Date;
  /**
   * Capacidade diária de revisões.
   * @default 15
   */
  dailyCapacity?: number;
}

// ─── Tipos de saída ──────────────────────────────────────────────────────────

export interface DayPlan {
  /** Data do dia (início do dia local, sem hora). */
  date: Date;
  /** Entradas priorizadas para este dia. */
  entries: RetaFinalEntry[];
}

export interface RetaFinalStats {
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
  /** Dias restantes até o ENAMED (pode ser negativo se já passou). */
  daysUntil: number;
}

export interface RetaFinalPlan {
  /** Dias corridos até o ENAMED (negativo = prova já passou). */
  daysUntil: number;
  /** Se true, prova já ocorreu — plano retorna vazio (não lança erro). */
  examPassed: boolean;
  /** Plano dia a dia. Vazio se prova já passou ou se não há entradas ativas. */
  plan: DayPlan[];
  /** Entradas do dia de hoje (atalho conveniente). */
  todayEntries: RetaFinalEntry[];
  stats: RetaFinalStats;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Zera hora/minuto/segundo de uma data, retornando nova instância. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Diferença em dias inteiros (ceil) entre duas datas. */
function diffDays(a: Date, b: Date): number {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
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
  const areaWeight = getAreaWeight(entry.area);
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
}: BuildRetaFinalPlanInput): RetaFinalPlan {
  const todayStart = startOfDay(today);
  const enamedStart = startOfDay(enamedDate);
  const daysUntil = diffDays(enamedStart, todayStart);

  // Prova já passou
  if (daysUntil <= 0) {
    const mastered = entries.filter((e) => {
      const m = (e as any).mastered_at ?? (e as any).masteredAt;
      return !!m;
    }).length;
    return {
      daysUntil,
      examPassed: true,
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
    score: calcScore(e, todayMs, areaFreqMap),
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
