import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { examRuntimeCapabilitiesApi } from '@/services/examRuntimeCapabilitiesApi';
import type { ExamRuntimeMode } from '@/types/exam-runtime';

export function useExamRuntimeCapabilities(userId: string | undefined, attemptId: string | null) {
  const client = useQueryClient();
  const key = ['exam-runtime-capabilities', userId ?? '', attemptId ?? ''];
  const enabled = !!userId && !!attemptId;
  const scope = `${userId ?? ''}:${attemptId ?? ''}`;
  const [reset, setReset] = useState({ scope: '', count: 0 });
  const query = useQuery({ queryKey: key, queryFn: () => examRuntimeCapabilitiesApi.get(),
    enabled, staleTime: 5 * 60_000, retry: false });
  const retry = useCallback(() => {
    setReset(previous => ({ scope, count: previous.count + 1 }));
    // Reset, rather than reuse a cached legacy result, after an unacknowledged write.
    void client.resetQueries({ queryKey: ['exam-runtime-capabilities', userId ?? '', attemptId ?? ''], exact: true });
  }, [client, userId, attemptId, scope]);
  const mode: ExamRuntimeMode = !enabled || query.isPending ? 'pending' : query.isError ? 'error' :
    query.data?.answer_freshness_v1 ? 'v1' : 'legacy';
  return { mode, retry, revision: `${scope}:${reset.scope === scope ? reset.count : 0}:${query.dataUpdatedAt}` };
}
