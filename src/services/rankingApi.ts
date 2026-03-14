/**
 * Ranking API service — real Supabase queries.
 * Architecture mirrored from Ranking ENAMED's useRanking hook and ranking_public view.
 * Uses security definer function get_ranking_for_simulado() for cross-user data access.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Types (mirroring Ranking ENAMED's RankingPublicRow) ───

export interface RankingRow {
  user_id: string;
  simulado_id: string;
  nota_final: number;
  total_correct: number;
  total_answered: number;
  finished_at: string | null;
  full_name: string | null;
  segment: 'guest' | 'standard' | 'pro';
  especialidade: string | null;
  instituicoes_alvo: string[] | null;
  posicao: number;
  total_candidatos: number;
}

export interface RankingParticipant {
  position: number;
  userId: string;
  name: string;
  score: number;
  specialty: string;
  institution: string;
  segment: 'guest' | 'standard' | 'pro';
  isCurrentUser: boolean;
}

export interface RankingStats {
  totalCandidatos: number;
  notaMedia: number;
  notaCorte: number; // top 10%
}

// ─── Fetch ranking for a specific simulado ───

export async function fetchRankingForSimulado(simuladoId: string): Promise<RankingRow[]> {
  console.log('[rankingApi] Fetching ranking for simulado:', simuladoId);

  const { data, error } = await supabase.rpc('get_ranking_for_simulado', {
    p_simulado_id: simuladoId,
  });

  if (error) {
    console.error('[rankingApi] Error fetching ranking:', error);
    throw error;
  }

  console.log('[rankingApi] Ranking loaded:', data?.length, 'participants');
  return (data || []) as RankingRow[];
}

// ─── Fetch simulados that have submitted attempts (for selector) ───

export async function fetchSimuladosWithResults(): Promise<
  Array<{ id: string; title: string; sequence_number: number }>
> {
  console.log('[rankingApi] Fetching simulados with results');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get simulados where this user has a submitted attempt
  const { data: attempts, error } = await supabase
    .from('attempts')
    .select('simulado_id, simulados(id, title, sequence_number)')
    .eq('user_id', user.id)
    .in('status', ['submitted', 'expired'])
    .not('score_percentage', 'is', null);

  if (error) {
    console.error('[rankingApi] Error fetching simulados with results:', error);
    return [];
  }

  // Deduplicate by simulado_id
  const seen = new Set<string>();
  const result: Array<{ id: string; title: string; sequence_number: number }> = [];
  
  for (const a of attempts || []) {
    const sim = (a as any).simulados;
    if (sim && !seen.has(sim.id)) {
      seen.add(sim.id);
      result.push({
        id: sim.id,
        title: sim.title,
        sequence_number: sim.sequence_number,
      });
    }
  }

  return result.sort((a, b) => a.sequence_number - b.sequence_number);
}

// ─── Transform raw ranking rows into display participants ───

export function transformRankingData(
  rows: RankingRow[],
  currentUserId: string | null,
): RankingParticipant[] {
  return rows.map((row) => ({
    position: Number(row.posicao),
    userId: row.user_id,
    name: row.full_name || 'Candidato',
    score: Math.round(Number(row.nota_final) || 0),
    specialty: row.especialidade || '—',
    institution: row.instituicoes_alvo?.[0] || '—',
    segment: row.segment,
    isCurrentUser: row.user_id === currentUserId,
  }));
}

// ─── Compute global stats (mirroring ENAMED's globalStats) ───

export function computeRankingStats(rows: RankingRow[]): RankingStats {
  if (rows.length === 0) {
    return { totalCandidatos: 0, notaMedia: 0, notaCorte: 0 };
  }

  const totalCandidatos = rows.length;
  const sumNotas = rows.reduce((sum, r) => sum + Number(r.nota_final || 0), 0);
  const notaMedia = Math.round(sumNotas / totalCandidatos);
  
  // Top 10% cutoff score
  const top10Index = Math.max(0, Math.floor(totalCandidatos * 0.1) - 1);
  const sorted = [...rows].sort((a, b) => Number(b.nota_final) - Number(a.nota_final));
  const notaCorte = Math.round(Number(sorted[top10Index]?.nota_final || 0));

  return { totalCandidatos, notaMedia, notaCorte };
}

// ─── Apply filters (mirroring ENAMED's filter pattern) ───

export type ComparisonFilter = 'all' | 'same_specialty' | 'same_institution';
export type SegmentFilter = 'all' | 'sanarflix' | 'pro';

export function applyRankingFilters(
  participants: RankingParticipant[],
  comparisonFilter: ComparisonFilter,
  segmentFilter: SegmentFilter,
  userSpecialty: string,
  userInstitution: string,
): RankingParticipant[] {
  let filtered = participants;

  // Comparison filter
  if (comparisonFilter === 'same_specialty') {
    filtered = filtered.filter(
      (p) => p.specialty === userSpecialty || p.isCurrentUser,
    );
  } else if (comparisonFilter === 'same_institution') {
    filtered = filtered.filter(
      (p) => p.institution === userInstitution || p.isCurrentUser,
    );
  }

  // Segment filter
  if (segmentFilter === 'sanarflix') {
    filtered = filtered.filter((p) => p.segment !== 'guest' || p.isCurrentUser);
  } else if (segmentFilter === 'pro') {
    filtered = filtered.filter((p) => p.segment === 'pro' || p.isCurrentUser);
  }

  // Re-rank after filtering
  return filtered
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, position: i + 1 }));
}
