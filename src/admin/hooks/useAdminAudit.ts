import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export interface AdminAuditFilters {
  days: number
  action: string
  entityType: string
  search: string
  page: number
  pageSize?: number
}

export function useAdminAudit(filters: AdminAuditFilters) {
  const { days, action, entityType, search, page, pageSize = 50 } = filters
  const offset = (page - 1) * pageSize

  return useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: () =>
      adminApi.listAudit({
        days,
        action,
        entityType,
        search,
        limit: pageSize,
        offset,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}
