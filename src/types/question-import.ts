/** Canonical rows accepted atomically by admin_import_questions. */
export interface QuestionImportOption {
  label: string;
  text: string;
  is_correct: boolean;
}

export interface QuestionImportRow {
  question_number: number;
  text: string;
  area: string;
  area_id?: string | null;
  theme?: string;
  difficulty?: string | null;
  explanation?: string | null;
  image_url?: string | null;
  image_url_2?: string | null;
  explanation_image_url?: string | null;
  options: QuestionImportOption[];
}

export interface QuestionImportError {
  /** One-based row in the request, before the spreadsheet header offset. */
  row: number;
  question_number?: number | null;
  field: string;
  message: string;
}

export interface QuestionImportResult {
  ok: boolean;
  imported: number;
  errors: QuestionImportError[];
}
