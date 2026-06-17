import type { QuestionVerifyFinding } from '../services/adminApi';

export function summarizeFindings(findings: QuestionVerifyFinding[]) {
  const byQuestion = [...findings].sort((a, b) => a.question_number - b.question_number);
  return {
    errorCount: findings.filter((f) => f.severity === 'error').length,
    warningCount: findings.filter((f) => f.severity === 'warning').length,
    byQuestion,
  };
}
