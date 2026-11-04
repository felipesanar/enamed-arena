import type { ExamEdition } from '@/types/edition';

export interface CanonicalCutoffName { id: string; name: string }
export interface CutoffCatalog { institutions: CanonicalCutoffName[]; specialties: CanonicalCutoffName[] }
export interface CutoffImportRow {
  institution_id: string;
  specialty_id: string;
  practice_scenario: string;
  cutoff_score_general: number;
  cutoff_score_quota: number | null;
  vagas: number;
}
export interface CutoffIssue { row: number; field: string; message: string }
export interface CutoffImportResult { ok: boolean; imported: number; errors: CutoffIssue[] }
export interface CutoffPreview { rows: CutoffImportRow[]; errors: CutoffIssue[] }
export interface ReprocessContext {
  id: string;
  title: string;
  execution_window_end: string;
  edition: Pick<ExamEdition, 'label'> | null;
}
export interface ReprocessReport {
  operation_id: string;
  simulado_id: string;
  answer_key_hash: string;
  attempts_processed: number;
  scores_changed: number;
  entries_reconciled: number;
  summaries_changed?: number;
  idempotent: boolean;
}
