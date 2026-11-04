// Administrative RPC contracts only. Students keep using the scoped F0 RPCs.
export type QuestionBankVersionState = 'incomplete' | 'published';
export type QuestionBankProvenance = 'legacy_snapshot' | 'observed';
export type QuestionItemAnalysisProvenance = 'legacy_unattributed' | 'result_observed';

export interface QuestionBank {
  id: string;
  original_question_id: string;
  origin_bank_id: string | null;
  observed_at: string;
}

export interface QuestionBankPayload {
  question: {
    text: string;
    area: string;
    area_id: string | null;
    theme: string | null;
    difficulty: string | null;
    image_url: string | null;
    image_url_2: string | null;
    explanation: string | null;
    explanation_image_url: string | null;
  };
  options: Array<{ label: string; text: string; is_correct: boolean }>;
  format: Record<string, unknown>;
}

export interface QuestionBankVersion {
  id: string;
  bank_id: string;
  version_number: number;
  payload: QuestionBankPayload;
  content_hash: string;
  state: QuestionBankVersionState;
  provenance: QuestionBankProvenance;
  editor_id: string | null;
  observed_at: string;
}

export interface QuestionBankUsage {
  id: string;
  bank_id: string;
  version_id: string;
  original_question_id: string;
  original_simulado_id: string;
  original_edition_id: string;
  question_number: number;
  observed_at: string;
  archived_at: string | null;
}

export interface QuestionBankListArgs {
  p_search?: string | null;
  p_limit?: number;
  p_offset?: number;
}

export interface QuestionBankListItem {
  bank_id: string;
  original_question_id: string;
  origin_bank_id: string | null;
  identity_observed_at: string;
  // Plain-text preview only. Never render this with dangerouslySetInnerHTML.
  title: string;
  latest_version_id: string;
  latest_version_number: number;
  latest_state: QuestionBankVersionState;
  observed_at: string;
  usage_count: number;
}

export interface QuestionBankListPage {
  items: QuestionBankListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AddBankVersionToSimuladoArgs {
  p_version_id: string;
  p_simulado_id: string;
  p_question_number: number;
}

export interface AddBankVersionToSimuladoResult {
  question_id: string;
  bank_id: string;
  version_id: string;
  usage_id: string;
  simulado_id: string;
  edition_id: string;
  question_number: number;
}

export interface QuestionItemAnalysis {
  bank_id: string;
  // Null means the historical AQR cannot honestly be attributed to a version.
  version_id: string | null;
  edition_id: string;
  is_training: boolean;
  provenance: QuestionItemAnalysisProvenance;
  n_responses: number;
  n_answered: number;
  n_correct: number;
  // Observed proportion correct (0..1), including unanswered items. NOT TRI.
  difficulty_observed: number;
}
