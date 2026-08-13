/**
 * Domain types for the "aplicação presencial" flow (QR → gabarito → resultado).
 * Mirrors the contract of the `presencial` Edge Function (supabase/functions/presencial).
 *
 * Note: PresencialQuestionSkeleton deliberately carries no question/option text —
 * the exam is on paper; this flow never serves exam content to the client.
 * No user identifier is ever exposed here — the server derives it from the
 * signed session token.
 */

export interface PresencialQuestionSkeleton {
  question_id: string;
  number: number;
  options: Array<{ id: string; label: string }>;
}

export interface PresencialCandidate {
  ref: string;
  masked_email: string;
  hint: string | null;
}

export interface PresencialReady {
  status: 'ready';
  token: string;
  questions: PresencialQuestionSkeleton[];
}

export type PresencialCheckinResult =
  | PresencialReady
  | { status: 'suggestions'; candidates: PresencialCandidate[] }
  | { status: 'no_account' };

export interface PresencialAreaResult {
  area: string;
  total: number;
  correct: number;
  percentage: number;
}

export interface PresencialResult {
  total_questions: number;
  total_correct: number;
  score_percentage: number;
  by_area: PresencialAreaResult[];
  is_linked: boolean;
  is_within_window: boolean;
}

export interface PresencialAnswer {
  question_id: string;
  selected_option_id: string;
}

export interface PresencialIdentifyInput {
  code: string;
  name: string;
  email: string;
}

export interface PresencialClaimInput extends PresencialIdentifyInput {
  candidateRef: string;
}
