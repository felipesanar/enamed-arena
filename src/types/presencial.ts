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
  /** `code` do caderno escolhido/resolvido no cliente (Tela 0). Opcional:
   * ausente quando a sala está travada num caderno (a sala manda, o cliente
   * não escolhe) ou quando o simulado não tem cadernos cadastrados. */
  caderno?: string;
}

export interface PresencialClaimInput extends PresencialIdentifyInput {
  candidateRef: string;
}

/**
 * Um caderno impresso ativo (Caderno 1 · Vermelho, Caderno 2 · Azul).
 * `color` dirige o token/cor literal no front — ver
 * `src/components/presencial/presencialCadernoColors.ts`.
 */
export interface PresencialCaderno {
  code: string;
  label: string;
  color: 'vermelho' | 'azul';
}

/**
 * Resposta da action `session-info`: não consome rate limit de check-in, não
 * cria nada. Serve para a Tela 0 decidir se pergunta o caderno e para a
 * página avisar, antes de pedir nome e e-mail, que a sala não está aberta.
 */
export interface PresencialSessionInfo {
  open: boolean;
  label: string | null;
  /** Sala travada num caderno — o cliente não escolhe. */
  caderno: PresencialCaderno | null;
  /** Cadernos ativos do simulado; `[]` quando a sala é travada. */
  cadernos: PresencialCaderno[];
}

/**
 * Uma questão do esqueleto de um caderno (fluxo logado, `/simulados/:id/gabarito`).
 * Mesma forma de `PresencialQuestionSkeleton` (v1): nenhum enunciado, texto de
 * alternativa, `explanation` ou `image_url*` — só o necessário para desenhar a
 * grade de bolhas na ordem impressa do caderno.
 * `number` vem de `position` (a numeração impressa) e `options` vem das
 * colunas `option_a..option_d` de `get_caderno_skeleton`, na ordem A/B/C/D.
 */
export interface CadernoSkeletonQuestion {
  question_id: string;
  number: number;
  options: Array<{ id: string; label: string }>;
}
