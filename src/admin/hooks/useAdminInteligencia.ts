import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export function useAdminCohortRetention(months = 6) {
  return useQuery({
    queryKey: ['admin', 'intel', 'cohort', months],
    queryFn: () => adminApi.getCohortRetention(months),
    staleTime: 300_000,
  })
}

export function useAdminPerformanceByArea(simuladoId: string | null = null, segment = 'all') {
  return useQuery({
    queryKey: ['admin', 'intel', 'area', simuladoId, segment],
    queryFn: () => adminApi.getPerformanceByArea(simuladoId, segment),
    staleTime: 300_000,
  })
}

export function useAdminPerformanceByTheme(simuladoId: string | null, area: string | null, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'intel', 'theme', simuladoId, area],
    queryFn: () => adminApi.getPerformanceByTheme(simuladoId, area),
    staleTime: 300_000,
    enabled,
  })
}

export function useAdminScoreDistribution(simuladoId: string | null = null) {
  return useQuery({
    queryKey: ['admin', 'intel', 'dist', simuladoId],
    queryFn: () => adminApi.getScoreDistribution(simuladoId),
    staleTime: 300_000,
  })
}

export function useAdminScoreEvolution() {
  return useQuery({
    queryKey: ['admin', 'intel', 'evolution'],
    queryFn: () => adminApi.getScoreEvolution(),
    staleTime: 300_000,
  })
}

export function useAdminEngagementMetrics(days: number) {
  return useQuery({
    queryKey: ['admin', 'intel', 'engagement', days],
    queryFn: () => adminApi.getEngagementMetrics(days),
    staleTime: 300_000,
  })
}

export function useAdminSegmentBreakdown() {
  return useQuery({
    queryKey: ['admin', 'intel', 'segments'],
    queryFn: () => adminApi.getSegmentBreakdown(),
    staleTime: 300_000,
  })
}

export function useAdminIntelInsights() {
  return useQuery({
    queryKey: ['admin', 'intel', 'insights'],
    queryFn: () => adminApi.getIntelInsights(),
    staleTime: 120_000,
  })
}
