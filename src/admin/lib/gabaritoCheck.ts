/**
 * Cruzamento gabarito × comentário — módulo PURO.
 *
 * Ver docs/superpowers/specs/2026-08-17-blindagem-gabarito-design.md
 *
 * Três gabaritos errados chegaram a produção com a mesma causa: a coluna
 * `Gabarito` da planilha (transcrita da linha "Resposta: Alternativa X" do
 * comentário) divergindo do corpo do comentário, que é o texto que o aluno lê.
 * Este módulo cruza as duas fontes e é consumido tanto pelo import (linhas da
 * planilha) quanto pelo gate de publicação (linhas do banco).
 *
 * O CONTRATO ABAIXO É CONGELADO: outros módulos já constroem contra ele.
 */

export type OptionLabel = 'A' | 'B' | 'C' | 'D';

export interface GabaritoCheckInput {
  questionNumber: number;
  /** Letra apontada como correta pela fonte (coluna Gabarito, ou is_correct no banco). */
  gabarito: string;
  options: Array<{ label: string; text: string }>;
  /** Coluna Comentário / questions.explanation. Pode conter HTML e markdown. */
  comentario: string;
}

export type GabaritoCheckType =
  /** error — comentário marca outra letra como CORRETA (S6 Q49) */
  | 'key_comment_conflict'
  /** error — linha "Resposta:" aponta outra letra */
  | 'key_answer_line_conflict'
  /** error — corpo e linha "Resposta:" discordam entre si (S5 Q35) */
  | 'comment_internal_conflict'
  /** error — mais de uma letra marcada como CORRETA */
  | 'multiple_correct_marked'
  /** warning — parágrafo do comentário casa melhor com outra alternativa (S5 Q46) */
  | 'option_letter_misalignment'
  /** info — comentário sem marcação legível; só entra agregado, nunca por questão */
  | 'key_unverifiable';

export interface GabaritoFinding {
  questionNumber: number;
  checkType: GabaritoCheckType;
  severity: 'error' | 'warning' | 'info';
  /** Letra que a evidência sugere, quando há uma. */
  proposedLabel?: OptionLabel;
  /** Texto curto em pt-BR: o que está errado. */
  what: string;
  /** Texto curto em pt-BR: como corrigir. */
  how: string;
  /** Trecho literal do comentário que sustenta o achado (≤ 200 chars). */
  evidence: string;
}

export interface GabaritoSummary {
  errors: GabaritoFinding[];
  warnings: GabaritoFinding[];
  /** Questões sem marcação verificável — exibido como uma linha, não por questão. */
  unverifiableCount: number;
  /** Números das questões com pelo menos um erro (as que o import barra). */
  blockedQuestionNumbers: number[];
}

export function checkGabarito(_input: GabaritoCheckInput): GabaritoFinding[] {
  throw new Error('não implementado');
}

export function summarizeGabaritoFindings(_findings: GabaritoFinding[]): GabaritoSummary {
  throw new Error('não implementado');
}
