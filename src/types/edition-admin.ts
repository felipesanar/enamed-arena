import type { EditionStatus, ExamFormat } from '@/types/edition';

/** JSON accepted by admin_upsert_edition(p_edition jsonb). Dates are YYYY-MM-DD. */
export interface EditionDraft {
  id?: string;
  code: string;
  year: number;
  term: 1 | 2 | null;
  label: string;
  status: EditionStatus;
  exam_date: string | null;
  exam_date_confirmed: boolean;
  official_results_at: string | null;
  format: ExamFormat;
  blueprint_id: string | null;
  cutoff_reference_label: string | null;
}

export interface CloneSimuladoInput {
  sourceSimuladoId: string;
  editionId: string;
  windowStart: string;
  windowEnd: string;
  resultsReleaseAt: string;
  copyQuestions: boolean;
}
