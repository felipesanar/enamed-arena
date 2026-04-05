import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export function useAdminMarketingKpis(days: number) {
  return useQuery({
    queryKey: ['admin', 'marketing-kpis', days],
    queryFn: () => adminApi.getMarketingKpis(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminMarketingSources(days: number) {
  return useQuery({
    queryKey: ['admin', 'marketing-sources', days],
    queryFn: () => adminApi.getMarketingSources(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminMarketingMediums(days: number) {
  return useQuery({
    queryKey: ['admin', 'marketing-mediums', days],
    queryFn: () => adminApi.getMarketingMediums(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminMarketingCampaigns(days: number) {
  return useQuery({
    queryKey: ['admin', 'marketing-campaigns', days],
    queryFn: () => adminApi.getMarketingCampaigns(days),
    staleTime: 5 * 60 * 1000,
  })
}
