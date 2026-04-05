import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export function useAdminAnalyticsFunnel(days: number) {
  return useQuery({
    queryKey: ['admin', 'analytics-funnel', days],
    queryFn: () => adminApi.getAnalyticsFunnel(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminAnalyticsTimeseries(days: number) {
  return useQuery({
    queryKey: ['admin', 'analytics-timeseries', days],
    queryFn: () => adminApi.getAnalyticsTimeseries(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminAnalyticsSources(days: number) {
  return useQuery({
    queryKey: ['admin', 'analytics-sources', days],
    queryFn: () => adminApi.getAnalyticsSources(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminAnalyticsTimeToConvert(days: number) {
  return useQuery({
    queryKey: ['admin', 'analytics-ttc', days],
    queryFn: () => adminApi.getAnalyticsTimeToConvert(days),
    staleTime: 5 * 60 * 1000,
  })
}
