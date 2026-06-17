import { useQuery } from '@tanstack/react-query'
import { adminApi, type ResultsRosterParams, type SimuladoResultRow } from '@/admin/services/adminApi'

export function useSimuladoResultsRoster(params: ResultsRosterParams) {
  const query = useQuery({
    queryKey: ['admin', 'simulado-results-roster', params],
    queryFn: () => adminApi.getSimuladoResultsRoster(params),
    enabled: !!params.simuladoId,
    placeholderData: (prev) => prev,
  })
  const rows: SimuladoResultRow[] = query.data ?? []
  return {
    rows,
    totalRows: rows[0]?.total_rows ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
  }
}
