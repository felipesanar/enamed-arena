import type { CutoffScoreRow } from '@/services/rankingApi';
import type { InstitutionSelection } from '@/types';

export type ApprovalStatus = 'pass' | 'fail' | 'unavailable' | 'unknown';

export interface ApprovalEntry {
  institutionId: string;
  institutionName: string;
  cutoffGeneral: number | null;
  cutoffQuota: number | null;
  /** pass: distância acima do corte; fail: distância abaixo. Sempre >= 0. */
  gap: number;
  status: ApprovalStatus;
}

/**
 * Cruza instituições-alvo com as linhas de corte retornadas pelo RPC.
 * - sem linha de corte => 'unavailable'
 * - sem nota do usuário (null) => 'unknown' (corte exibido, sem veredito)
 */
export function deriveApprovalEntries(
  targets: InstitutionSelection[],
  cutoffs: CutoffScoreRow[],
  userScore: number | null,
): ApprovalEntry[] {
  const byId = new Map(cutoffs.map((c) => [c.institution_id, c]));

  return targets.map((t) => {
    const row = byId.get(t.id);
    if (!row) {
      return {
        institutionId: t.id,
        institutionName: t.name,
        cutoffGeneral: null,
        cutoffQuota: null,
        gap: 0,
        status: 'unavailable' as const,
      };
    }
    const general = Number(row.cutoff_score_general);
    if (userScore == null) {
      return {
        institutionId: t.id,
        institutionName: row.institution_name,
        cutoffGeneral: general,
        cutoffQuota: row.cutoff_score_quota,
        gap: 0,
        status: 'unknown' as const,
      };
    }
    const pass = userScore >= general;
    return {
      institutionId: t.id,
      institutionName: row.institution_name,
      cutoffGeneral: general,
      cutoffQuota: row.cutoff_score_quota,
      gap: Math.round(Math.abs(userScore - general)),
      status: pass ? ('pass' as const) : ('fail' as const),
    };
  });
}
