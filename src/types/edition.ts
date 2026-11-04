export type EditionStatus = 'planned' | 'preparing' | 'active' | 'closed' | 'archived';

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
  created_at: string;
  updated_at: string;
}
