/**
 * Heurística determinística de triagem pós-prova (spec 04 §5).
 *
 * Função pura: dada uma questão (resultado + confiança + opções), retorna o
 * `DbReason` mais plausível segundo regras ordenadas por prioridade.
 *
 * Usada como fallback imediato enquanto a edge function `classify-exam-errors`
 * ainda não respondeu, e também quando ela retorna 429/502.
 */

import type { DbReason } from '@/lib/errorNotebookReasons';

/** Subconjunto mínimo do contrato `ClassifyQuestionInput` necessário à heurística. */
export interface HeuristicInput {
  /** Questão foi respondida corretamente? */
  isCorrect: boolean;
  /** Nível de confiança declarado pelo aluno ao responder (null = não informado). */
  confidence: 'baixa' | 'media' | 'alta' | null;
  /** Label da alternativa marcada pelo aluno (null = em branco). */
  userOptionLabel: string | null;
  /** Label da alternativa correta. */
  correctOptionLabel: string;
  /** Lista completa de alternativas da questão (para detectar adjacência). */
  options: Array<{ label: string; text: string }>;
}

/**
 * Aplica as regras heurísticas em ordem de prioridade conforme spec 04 §5.
 *
 * Regras (a primeira que casar vence):
 *  R1 — acertou + confiança baixa → `guessed_correctly`
 *  R2 — errou + confiança alta → `confused_alternatives`
 *  R3 — alternativa do aluno e correta são adjacentes na lista → `confused_alternatives`
 *  R4 — ficou em branco → `did_not_know`
 *  R5 — padrão residual → `did_not_know`
 *
 * @pure Não possui side-effects; pode ser testada isoladamente.
 */
export function heuristicReason(input: HeuristicInput): DbReason {
  const { isCorrect, confidence, userOptionLabel, correctOptionLabel, options } = input;

  // R1: acertou mas com baixa confiança explícita → tratado como chute
  if (isCorrect && confidence === 'baixa') return 'guessed_correctly';

  // R2: errou e tinha alta confiança → confundiu diferencial
  //     (achava que sabia, mas escolheu alternativa plausível incorreta).
  //     Exige ter marcado uma alternativa: questão em branco não é "confusão".
  if (!isCorrect && confidence === 'alta' && userOptionLabel) return 'confused_alternatives';

  // R3: alternativa do aluno e alternativa correta são adjacentes na lista
  //     (ex: B e C, D e E) → trocou alternativas próximas
  if (!isCorrect && userOptionLabel && correctOptionLabel) {
    const sortedLabels = options.map(o => o.label).sort();
    const userIdx = sortedLabels.indexOf(userOptionLabel);
    const correctIdx = sortedLabels.indexOf(correctOptionLabel);
    if (userIdx !== -1 && correctIdx !== -1 && Math.abs(userIdx - correctIdx) === 1) {
      return 'confused_alternatives';
    }
  }

  // R4: ficou em branco ou null → não sabia
  if (!userOptionLabel) return 'did_not_know';

  // R5: padrão residual — não sabia
  return 'did_not_know';
}

/**
 * Aplica a heurística a um array de questões, retornando um mapa
 * `questionId → DbReason` para atualização em lote dos cards da triagem.
 */
export function buildHeuristicMap(
  questions: Array<HeuristicInput & { questionId: string }>,
): Record<string, DbReason> {
  const map: Record<string, DbReason> = {};
  for (const q of questions) {
    map[q.questionId] = heuristicReason(q);
  }
  return map;
}
