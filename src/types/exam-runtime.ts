export type ExamRuntimeMode = 'pending' | 'error' | 'legacy' | 'v1';
export type AnswerWriteMode = 'legacy' | 'v1';
export interface ExamRuntimePersistence {
  mode: ExamRuntimeMode;
  onMismatch: () => void;
}
export interface ExamRuntimeCapabilities {
  version: 1;
  answer_freshness_v1: boolean;
  safe_auto_finalize: boolean;
  question_explanations: boolean;
  attempt_counts: boolean;
  server_clock: boolean;
  exam_editions: boolean;
}
