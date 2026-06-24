import type { QuestionVerifyFinding, FindingSlot } from '../services/adminApi';

const SLOT_LABEL: Record<FindingSlot, string> = {
  enunciado: 'imagem do enunciado',
  enunciado2: 'imagem 2',
  comentario: 'imagem do comentário',
};

export function findingLabel(f: QuestionVerifyFinding): string {
  const slot = f.slot ? SLOT_LABEL[f.slot] : 'imagem';
  switch (f.check_type) {
    case 'missing_image': return `${slot} ausente`;
    case 'orphan_image': return `${slot} sem referência no texto`;
    case 'image_mismatch': return `${slot} não corresponde ao texto`;
    case 'illegible_image': return `${slot} ilegível`;
    case 'invalid_gabarito': return 'gabarito inválido';
    case 'empty_enunciado': return 'enunciado vazio';
    case 'empty_option': return 'alternativa vazia';
    case 'duplicate_options': return 'alternativas idênticas';
    case 'duplicate_question': return 'questão duplicada';
    case 'bad_numbering': return 'numeração inválida';
    default: return 'problema detectado';
  }
}

export function summarizeFindings(findings: QuestionVerifyFinding[]) {
  const byQuestion = [...findings].sort((a, b) => a.question_number - b.question_number);
  return {
    errorCount: findings.filter((f) => f.severity === 'error').length,
    warningCount: findings.filter((f) => f.severity === 'warning').length,
    byQuestion,
  };
}
