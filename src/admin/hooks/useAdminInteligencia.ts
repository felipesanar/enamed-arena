import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import type { AdminReportScope } from '@/types/admin-period'

function useScope(scope?: AdminReportScope, enabled = true) {
  const { user, loading } = useAuth()
  const canView = useAdminCan('intel.view')
  return {
    key: [user?.id ?? null, scope === undefined ? 'legacy' : 'report', scope?.editionId ?? null, scope?.startAt ?? null, scope?.endAt ?? null],
    enabled: enabled && !!user && !loading && canView,
  }
}

export function useAdminCohortRetention(months = 6, scope?: AdminReportScope, enabled = true) {
  const query = useScope(scope, enabled)
  return useQuery({
    queryKey: ['admin', 'intel', 'cohort', months, ...query.key],
    queryFn: () => adminApi.getCohortRetention(months, scope),
    enabled: query.enabled,
    staleTime: 300_000,
  })
}

export function useAdminPerformanceByArea(simuladoId: string | null = null, segment = 'all', scope?: AdminReportScope, enabled = true) {
  const query = useScope(scope, enabled)
  return useQuery({
    queryKey: ['admin', 'intel', 'area', simuladoId, segment, ...query.key],
    queryFn: () => adminApi.getPerformanceByArea(simuladoId, segment, scope),
    enabled: query.enabled,
    staleTime: 300_000,
  })
}

export function useAdminPerformanceByTheme(simuladoId: string | null, area: string | null, enabled = true, scope?: AdminReportScope) {
  const query = useScope(scope, enabled)
  return useQuery({
    queryKey: ['admin', 'intel', 'theme', simuladoId, area, ...query.key],
    queryFn: () => adminApi.getPerformanceByTheme(simuladoId, area, 12, scope),
    staleTime: 300_000,
    enabled: query.enabled,
  })
}

export function useAdminScoreDistribution(simuladoId: string | null = null, scope?: AdminReportScope, enabled = true) {
  const query = useScope(scope, enabled)
  return useQuery({
    queryKey: ['admin', 'intel', 'dist', simuladoId, ...query.key],
    queryFn: () => adminApi.getScoreDistribution(simuladoId, scope),
    enabled: query.enabled,
    staleTime: 300_000,
  })
}

export function useAdminScoreEvolution(scope?: AdminReportScope, enabled = true) {
  const query = useScope(scope, enabled)
  return useQuery({
    queryKey: ['admin', 'intel', 'evolution', ...query.key],
    queryFn: () => adminApi.getScoreEvolution(scope),
    enabled: query.enabled,
    staleTime: 300_000,
  })
}

export function useAdminEngagementMetrics(days: number) {
  const query = useScope()
  return useQuery({
    queryKey: ['admin', 'intel', 'engagement', days, ...query.key],
    queryFn: () => adminApi.getEngagementMetrics(days),
    staleTime: 300_000,
    enabled: query.enabled,
  })
}

export function useAdminSegmentBreakdown(scope?: AdminReportScope, enabled = true) {
  const query = useScope(scope, enabled)
  return useQuery({
    queryKey: ['admin', 'intel', 'segments', ...query.key],
    queryFn: () => adminApi.getSegmentBreakdown(scope),
    enabled: query.enabled,
    staleTime: 300_000,
  })
}

export function useAdminIntelInsights(scope?: AdminReportScope, enabled = true) {
  const query = useScope(scope, enabled)
  return useQuery({
    queryKey: ['admin', 'intel', 'insights', ...query.key],
    queryFn: () => adminApi.getIntelInsights(scope),
    enabled: query.enabled,
    staleTime: 120_000,
  })
}
