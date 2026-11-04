import type { QueryClient } from '@tanstack/react-query';

const analysisPrefixes = ['my-percentile-history', 'edition-ranking', 'question-bank-item-analysis'];

/** Content capture/reuse changes bank observations; do not fetch privileged data here. */
export function invalidateQuestionBankQueries(client: QueryClient) {
  void client.invalidateQueries({ refetchType: 'none', predicate: ({ queryKey: key }) =>
    ['question-bank','question-bank-versions','question-bank-item-analysis'].includes(String(key[0])) });
}

/** Finalization marks caches stale; navigation never waits for remote reads. */
export function invalidateExamQueries(client: QueryClient, userId: string | undefined, simuladoId: string, routeRef?: string) {
  if (!userId) return;
  void client.invalidateQueries({
    refetchType: 'none',
    predicate: ({ queryKey: key }) => {
      if (key[0] === 'simulado') return key[2] === userId && (key[1] === simuladoId || key[1] === routeRef);
      return key[1] === userId && ['simulados', 'user-performance', 'ranking', 'ranking-simulados',
        'comparative', 'exam-result', 'exam-result-details', ...analysisPrefixes].includes(String(key[0]));
    },
  });
}

/** Admin result mutations affect participants beyond the administrator's identity. */
export function invalidateAdminExamQueries(client: QueryClient) {
  void client.invalidateQueries({ refetchType: 'none', predicate: ({ queryKey: key }) => {
    if (key[0] === 'admin') return ['simulado-detail-stats', 'simulado-question-stats', 'score-distribution',
      'performance-by-area', 'simulado-results-aggregate', 'simulado-results-roster', 'attempts', 'attempt-kpis',
      'user-attempts', 'attempt-questions', 'intel', 'reprocess-context'].includes(String(key[1]));
    return ['simulado', 'simulados', 'user-performance', 'user-attempts', 'ranking-simulados', 'ranking',
      'comparative', 'exam-result', 'exam-result-access', 'ranking-evolution-history', 'ranking-evolution-prev',
      'notebook-page', 'notebook-counts', 'notebook-due-count', 'caderno-pattern-insights',
      'caderno-area-score-history', 'caderno-confidence-calibration', ...analysisPrefixes].includes(String(key[0]));
  } });
}
