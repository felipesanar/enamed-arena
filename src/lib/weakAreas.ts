/**
 * weakAreas.ts — Funções puras para identificar e ranquear áreas/temas fracos
 * a partir das entradas do Caderno de Erros.
 *
 * Sem efeitos colaterais, sem chamadas de rede — recebe a lista de entradas e
 * devolve itens ranqueados. Facilita testabilidade e reutilização.
 *
 * Critérios de ranqueamento (score composto, maior = mais fraco):
 *   1. Entradas não dominadas (sem mastered_at) pesam mais.
 *   2. Lapsos SRS (srs_lapses) indicam dificuldade persistente.
 *   3. Erros recentes (30 dias) têm peso extra.
 *   4. Diversidade de motivos (ex.: sempre "lacuna") amplifica.
 *
 * Fase 3: client-only — sem novas tabelas ou RPCs.
 */

// ─── Tipos de entrada ──────────────────────────────────────────────────────────

export interface WeakAreaEntry {
  id: string;
  area: string | null;
  theme: string | null;
  reason: string;
  addedAt: string;
  /** null se SRS não foi computado ainda — degrada graciosamente */
  masteredAt?: string | null;
  /** null se SRS não foi computado ainda */
  srsLapses?: number | null;
  /** null se SRS não foi computado ainda */
  srsReps?: number | null;
  /** null se SRS não foi computado ainda */
  srsDueAt?: string | null;
}

// ─── Resultado ranqueado ────────────────────────────────────────────────────────

export interface RankedWeakArea {
  /** Área (especialidade), ex.: "Cardiologia" */
  area: string;
  /** Tema dentro da área — null quando o agrupamento é só por área */
  theme: string | null;
  /** Total de entradas neste grupo */
  total: number;
  /** Entradas ainda não dominadas */
  pending: number;
  /** Total de lapsos SRS acumulados no grupo */
  totalLapses: number;
  /** Score composto — maior = mais fraco/prioridade */
  score: number;
  /** Motivo mais frequente no grupo (útil para UI) */
  topReason: string;
  /** Entradas que compõem este grupo */
  entryIds: string[];
}

// ─── Helpers internos ──────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isRecent(addedAt: string, nowMs: number): boolean {
  return nowMs - new Date(addedAt).getTime() < THIRTY_DAYS_MS;
}

function isMastered(entry: WeakAreaEntry): boolean {
  return !!(entry as any).masteredAt;
}

function modeOf(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'did_not_know';
}

// ─── API pública ───────────────────────────────────────────────────────────────

/**
 * Ranqueia as áreas mais fracas do aluno a partir das entradas do caderno.
 *
 * Agrupa por `area` e devolve no máximo `maxItems` itens ordenados pelo score
 * composto (maior = mais prioritário para treinar).
 *
 * Entradas sem área são ignoradas.
 * Entradas dominadas (mastered_at) contam negativamente no score.
 */
export function rankWeakAreas(
  entries: WeakAreaEntry[],
  maxItems = 8,
): RankedWeakArea[] {
  const nowMs = Date.now();

  // Agrupa por área
  const areaMap = new Map<string, WeakAreaEntry[]>();
  for (const e of entries) {
    const key = e.area?.trim();
    if (!key) continue;
    const arr = areaMap.get(key) ?? [];
    arr.push(e);
    areaMap.set(key, arr);
  }

  const ranked: RankedWeakArea[] = [];

  for (const [area, group] of areaMap.entries()) {
    const pending = group.filter((e) => !isMastered(e));
    if (pending.length === 0) continue; // área totalmente dominada — pula

    const totalLapses = group.reduce((acc, e) => acc + ((e as any).srsLapses ?? 0), 0);
    const recentCount = pending.filter((e) => isRecent(e.addedAt, nowMs)).length;
    const masteredCount = group.length - pending.length;

    // Score: base = pendentes, bônus lapsos, bônus recentes, desconto dominadas
    const score =
      pending.length * 10 +
      totalLapses * 5 +
      recentCount * 3 -
      masteredCount * 2;

    ranked.push({
      area,
      theme: null,
      total: group.length,
      pending: pending.length,
      totalLapses,
      score,
      topReason: modeOf(group.map((e) => e.reason)),
      entryIds: group.map((e) => e.id),
    });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, maxItems);
}

/**
 * Ranqueia temas (area + theme) mais fracos. Util para granularidade extra.
 *
 * Entradas sem área ou sem tema são ignoradas.
 */
export function rankWeakThemes(
  entries: WeakAreaEntry[],
  maxItems = 12,
): RankedWeakArea[] {
  const nowMs = Date.now();

  // Agrupa por "area|theme"
  const themeMap = new Map<string, { area: string; theme: string; entries: WeakAreaEntry[] }>();
  for (const e of entries) {
    const area = e.area?.trim();
    const theme = e.theme?.trim();
    if (!area || !theme) continue;
    const key = `${area}|${theme}`;
    const existing = themeMap.get(key) ?? { area, theme, entries: [] };
    existing.entries.push(e);
    themeMap.set(key, existing);
  }

  const ranked: RankedWeakArea[] = [];

  for (const { area, theme, entries: group } of themeMap.values()) {
    const pending = group.filter((e) => !isMastered(e));
    if (pending.length === 0) continue;

    const totalLapses = group.reduce((acc, e) => acc + ((e as any).srsLapses ?? 0), 0);
    const recentCount = pending.filter((e) => isRecent(e.addedAt, nowMs)).length;
    const masteredCount = group.length - pending.length;

    const score =
      pending.length * 10 +
      totalLapses * 5 +
      recentCount * 3 -
      masteredCount * 2;

    ranked.push({
      area,
      theme,
      total: group.length,
      pending: pending.length,
      totalLapses,
      score,
      topReason: modeOf(group.map((e) => e.reason)),
      entryIds: group.map((e) => e.id),
    });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, maxItems);
}

/**
 * Verifica se há dados suficientes para gerar um treino significativo.
 * Mínimo: pelo menos 3 entradas não dominadas.
 */
export function hasSufficientDataForDrill(entries: WeakAreaEntry[]): boolean {
  return entries.filter((e) => !isMastered(e)).length >= 3;
}
