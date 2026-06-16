/**
 * Helpers puros de percentil e "climb" (evolução de colocação) do ranking.
 * Sem dependências de React/Supabase — testável isoladamente.
 */

export type Climb =
  | { kind: 'debut' }
  | { kind: 'delta'; prevPercentil: number; currPercentil: number; delta: number };

/** Top X% (1..99). Quanto menor, melhor. Total inválido → 99 (sem divisão por zero). */
export function computePercentile(position: number, total: number): number {
  if (!total || total <= 0) return 99;
  return Math.min(99, Math.max(1, Math.ceil((position / total) * 100)));
}

/**
 * Compara o percentil atual com o do simulado anterior.
 * `delta > 0` = subiu (percentil menor é melhor); `< 0` = caiu; `0` = manteve.
 */
export function computeClimb(prevPercentil: number | null, currPercentil: number): Climb {
  if (prevPercentil == null) return { kind: 'debut' };
  return { kind: 'delta', prevPercentil, currPercentil, delta: prevPercentil - currPercentil };
}
