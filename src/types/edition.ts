export type EditionStatus = 'planned' | 'preparing' | 'active' | 'closed' | 'archived';

/** Database JSON wire format. Names match the Phase 0 migration. */
export interface ExamFormat {
  questions: number;
  options: number;
  duration_minutes: number;
  scoring: 'tri' | 'raw';
  proficient_min?: number;
}

export interface EditionTargetProfile {
  targetEditionId?: string | null;
  expectedGraduationTerm?: string | null;
}

export interface ExamBlueprint {
  id: string;
  code: string;
  label: string;
  weights_provisional: boolean;
}

export interface ExamArea {
  id: string;
  blueprint_id: string;
  code: string;
  label: string;
  aliases: string[];
  weight: number;
  sort_order: number;
}

export interface ExamEdition {
  id: string;
  code: string;
  year: number;
  term: 1 | 2 | null;
  label: string;
  status: EditionStatus;
  exam_date: string | null;
  exam_date_confirmed: boolean;
  official_results_at: string | null;
  format: Record<string, unknown>;
  /** Optional during expand rollout; format must be validated before use. */
  blueprint_id?: string | null;
  cutoff_reference_label?: string | null;
  created_at: string;
  updated_at: string;
}
