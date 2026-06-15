import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import { useDebounce } from '@/hooks/useDebounce'

/** Busca de entidades da paleta: 2+ chars, debounce 250ms. */
export function useAdminQuickSearch(query: string) {
  const debounced = useDebounce(query.trim(), 250)
  const enabled = debounced.length >= 2

  const { data, isFetching, isError } = useQuery({
    queryKey: ['admin', 'quick-search', debounced],
    queryFn: () => adminApi.quickSearch(debounced),
    enabled,
    staleTime: 30_000,
  })

  return { results: data ?? [], isFetching: enabled && isFetching, isError, enabled }
}
