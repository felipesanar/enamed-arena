/**
 * Ranking API service — real Supabase queries.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { UserSegment } from '@/types';

// ─── Types ───

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
  notaCorte: number;
}

// ─── Fetch ranking for a specific simulado ───

export async function fetchRankingForSimulado(simuladoId: string): Promise<RankingRow[]> {
  logger.log('[rankingApi] Fetching ranking for simulado');

  const { data, error } = await supabase.rpc('get_ranking_for_simulado', {
    p_simulado_id: simuladoId,
  });

  if (error) {
    logger.error('[rankingApi] Error fetching ranking:', error);
    throw error;
  }

  logger.log('[rankingApi] Ranking loaded:', data?.length, 'participants');
  return (data || []) as RankingRow[];
}

/** Admin-only: mesmo shape do ranking público; opcionalmente inclui tentativas fora da janela (treino). */
export async function fetchAdminRankingForSimulado(
  simuladoId: string,
  includeTrain: boolean,
): Promise<RankingRow[]> {
  logger.log('[rankingApi] Fetching admin ranking preview');

  // Cast needed: RPC exists in DB but types.ts hasn't been regenerated yet
  const { data, error } = await (supabase.rpc as any)('admin_get_ranking_for_simulado', {
    p_simulado_id: simuladoId,
    p_include_train: includeTrain,
  });

  if (error) {
    logger.error('[rankingApi] Error fetching admin ranking:', error);
    throw error;
  }

  return (data || []) as RankingRow[];
}

/** Admin-only: simulados publicados com ao menos uma tentativa finalizada (sem gate de results_release_at). */
export async function fetchAdminSimuladosForRankingPreview(): Promise<
  Array<{ id: string; title: string; sequence_number: number }>
> {
  logger.log('[rankingApi] Fetching admin simulados for ranking preview');

  // Cast needed: RPC exists in DB but types.ts hasn't been regenerated yet
  const { data, error } = await (supabase.rpc as any)('admin_list_simulados_for_ranking_preview');

  if (error) {
    logger.error('[rankingApi] Error fetching admin simulados for preview:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    sequence_number: row.sequence_number,
  }));
}

// ─── Fetch simulados that have submitted attempts (for selector) ───

export async function fetchSimuladosWithResults(): Promise<Array<{ id: string; title: string; sequence_number: number }>> {
  logger.log('[rankingApi] Fetching simulados with released results');
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('simulados')
    .select('id, title, sequence_number, results_release_at, status')
    .eq('status', 'published')
    .lte('results_release_at', nowIso)
    .order('sequence_number', { ascending: true });

  if (error) {
    logger.error('[rankingApi] Error fetching released-result simulados:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    sequence_number: row.sequence_number,
  }));
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

// ─── Compute global stats ───

export function computeRankingStats(rows: RankingRow[]): RankingStats {
  if (rows.length === 0) {
    return { totalCandidatos: 0, notaMedia: 0, notaCorte: 0 };
  }

  const totalCandidatos = rows.length;
  const sumNotas = rows.reduce((sum, r) => sum + Number(r.nota_final || 0), 0);
  const notaMedia = Math.round(sumNotas / totalCandidatos);

  const top10Index = Math.max(0, Math.floor(totalCandidatos * 0.1) - 1);
  const sorted = [...rows].sort((a, b) => Number(b.nota_final) - Number(a.nota_final));
  const notaCorte = Math.round(Number(sorted[top10Index]?.nota_final || 0));

  return { totalCandidatos, notaMedia, notaCorte };
}

// ─── Apply filters ───

export type ComparisonFilter = 'all' | 'same_specialty' | 'same_institution';
export type SegmentFilter = 'all' | 'sanarflix' | 'pro';

/** Quais filtros de segmento a UI pode exibir conforme o segmento do usuário logado. */
export function getAllowedRankingSegmentFilters(segment: UserSegment): SegmentFilter[] {
  if (segment === 'pro') return ['all', 'sanarflix', 'pro'];
  if (segment === 'standard') return ['all', 'sanarflix'];
  return ['all'];
}

export function applyRankingFilters(
  participants: RankingParticipant[],
  comparisonFilter: ComparisonFilter,
  segmentFilter: SegmentFilter,
  userSpecialty: string,
  userInstitutions: string[],
): RankingParticipant[] {
  let filtered = participants;

  if (comparisonFilter === 'same_specialty') {
    filtered = filtered.filter(
      (p) => p.specialty === userSpecialty || p.isCurrentUser,
    );
  } else if (comparisonFilter === 'same_institution') {
    // Exclusive: filter by first target institution only
    const targetInstitution = userInstitutions.find(Boolean) || '';
    filtered = filtered.filter(
      (p) => p.institution === targetInstitution || p.isCurrentUser,
    );
  }

  // "sanarflix" = aluno SanarFlix padrão (standard), não inclui PRO nem visitante
  if (segmentFilter === 'sanarflix') {
    filtered = filtered.filter((p) => p.segment === 'standard' || p.isCurrentUser);
  } else if (segmentFilter === 'pro') {
    filtered = filtered.filter((p) => p.segment === 'pro' || p.isCurrentUser);
  }

  return filtered
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, position: i + 1 }));
}
