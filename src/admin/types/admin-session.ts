export type RankingRule = 'legacy_online_window' | 'session_window_v1';

export interface SimuladoWindow {
  execution_window_start: string;
  execution_window_end: string;
  results_release_at: string;
}

export interface WindowUpdateReport {
  simulado_id: string;
  operation_id: string;
  attempts_examined: number;
  eligibility_changed: number;
  old_window: SimuladoWindow;
  new_window: SimuladoWindow;
}

export interface WindowPreview extends Omit<WindowUpdateReport, 'operation_id'> {
  current_window_hash: string;
  old_eligible: number;
  new_eligible: number;
}
