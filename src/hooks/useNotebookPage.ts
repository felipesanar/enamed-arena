import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { notebookApi } from '@/services/notebookApi';
import type { NotebookFilters } from '@/types/notebook-pagination';

export const NOTEBOOK_QUERY_PREFIXES = ['notebook-page', 'notebook-counts', 'notebook-due-count',
  'caderno-pattern-insights', 'caderno-area-score-history', 'caderno-confidence-calibration'] as const;

export function useNotebookPage(filters: NotebookFilters, offset: number, enabled: boolean) {
  const { user } = useAuth();
  const client = useQueryClient();
  const page = useQuery({
    queryKey: ['notebook-page', user?.id ?? null, true, filters, offset],
    queryFn: () => notebookApi.listPage(filters, { limit: 50, offset }, { editionsEnabled: true }),
    enabled: enabled && !!user, retry: false,
    // No placeholderData: never label previous scope rows as the new edition.
  });
  const scopeCounts = useQuery({
    queryKey: ['notebook-counts', user?.id ?? null, filters.editionId ?? null, true],
    queryFn: () => notebookApi.getCounts({ editionId: filters.editionId }, { editionsEnabled: true }),
    enabled: enabled && !!user, retry: false,
  });
  const invalidate = () => Promise.all(NOTEBOOK_QUERY_PREFIXES.map(prefix => client.invalidateQueries({ queryKey: [prefix] })));
  return { page, scopeCounts, invalidate };
}
