// src/admin/hooks/useAdminDashboard.ts
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import type { AdminPeriod } from '@/admin/types'

export function useAdminDashboardKpis(period: AdminPeriod) {
  return useQuery({
    queryKey: ['admin', 'kpis', period],
    queryFn: () => adminApi.getDashboardKpis(period),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminEventsTimeseries(period: AdminPeriod) {
  return useQuery({
    queryKey: ['admin', 'timeseries', period],
    queryFn: () => adminApi.getEventsTimeseries(period),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminFunnelStats(period: AdminPeriod) {
  return useQuery({
    queryKey: ['admin', 'funnel', period],
    queryFn: () => adminApi.getFunnelStats(period),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminSimuladoEngagement(limit = 10) {
  return useQuery({
    queryKey: ['admin', 'simulado-engagement', limit],
    queryFn: () => adminApi.getSimuladoEngagement(limit),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminLiveSignals() {
  return useQuery({
    queryKey: ['admin', 'live'],
    queryFn: () => adminApi.getLiveSignals(),
    staleTime: 0,
    refetchInterval: 60 * 1000,
  })
}
