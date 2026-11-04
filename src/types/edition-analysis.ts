/** Server-owned analysis DTOs. Raw scores never belong in percentile history. */
export interface PercentileHistoryItem {
  simulado_id: string;
  edition_id: string;
  code: string;
  label: string;
  sequence: number;
  date: string;
  position: number;
  population: number;
  top_percentile: number;
  metadata: { small_sample: boolean };
}

export interface PercentileHistory {
  items: PercentileHistoryItem[];
  metadata: {
    metric: 'top_percentile';
    small_sample_threshold: number;
    warning: string;
    psychometric_comparable: false;
  };
}

export interface EditionRankingPolicy {
  best_n: number;
  minimum_simulados: number;
}

export interface ConfiguredEditionRankingPolicy extends EditionRankingPolicy {
  edition_id: string;
  enabled: boolean;
  updated_by: string;
  updated_at: string;
}

export interface EditionRankingItem {
  user_id: string;
  display_name: string | null;
  position: number;
  average_score: number;
  used_simulados: number;
  completed_simulados: number;
}

export type EditionRanking =
  | { status: 'unconfigured'; edition_id: string; policy: null; population: 0; items: [] }
  | { status: 'insufficient_offered'; edition_id: string; policy: EditionRankingPolicy;
      offered_simulados: number; population: 0; items: [] }
  | { status: 'ready'; edition_id: string; policy: EditionRankingPolicy;
      offered_simulados: number; population: number; limit: number; offset: number;
      items: EditionRankingItem[]; metadata: {
        score_kind: 'raw_within_edition_only'; psychometric_comparable: false;
        tie_break: string; warning: string;
      } };

export interface CutoffScoreHistoryItem {
  id: string;
  institution_id: string;
  specialty_id: string;
  practice_scenario: string | null;
  source: string;
  source_version: null;
  reference_edition_id: string;
  reference_edition_code: string;
  reference_edition_label: string;
  reference_label: string | null;
  year: number;
  term: 1 | 2 | null;
  value_general: number | null;
  value_quota: number | null;
  vagas: number | null;
  trend_comparable: false;
}

export interface CutoffScoreHistory {
  items: CutoffScoreHistoryItem[];
  legacy_unknown_count: number;
  trend_comparable: false;
  metadata: { reference_only: true; source_version_available: false; warning: string };
}
