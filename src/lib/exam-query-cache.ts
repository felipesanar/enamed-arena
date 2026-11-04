import type { QueryClient } from '@tanstack/react-query';

/** Finalization marks caches stale; navigation never waits for remote reads. */
export function invalidateExamQueries(client: QueryClient, userId: string | undefined, simuladoId: string, routeRef?: string) {
  if (!userId) return;
  void client.invalidateQueries({
    refetchType: 'none',
    predicate: ({ queryKey: key }) => {
      if (key[0] === 'simulado') return key[2] === userId && (key[1] === simuladoId || key[1] === routeRef);
      return key[1] === userId && ['simulados', 'user-performance', 'ranking', 'ranking-simulados',
        'comparative', 'exam-result', 'exam-result-details'].includes(String(key[0]));
    },
  });
}
