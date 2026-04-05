import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import type { SimuladoEngagementRow } from '@/admin/types'

export function useAdminSimuladoDetailStats(simuladoId: string) {
  return useQuery({
    queryKey: ['admin', 'simulado-detail-stats', simuladoId],
    queryFn: () => adminApi.getSimuladoDetailStats(simuladoId),
    staleTime: 5 * 60 * 1000,
    enabled: !!simuladoId,
  })
}

export function useAdminSimuladoQuestionStats(simuladoId: string) {
  return useQuery({
    queryKey: ['admin', 'simulado-question-stats', simuladoId],
    queryFn: () => adminApi.getSimuladoQuestionStats(simuladoId),
    staleTime: 5 * 60 * 1000,
    enabled: !!simuladoId,
  })
}

export function useAdminSimuladoEngagementMap() {
  return useQuery({
    queryKey: ['admin', 'simulado-engagement-map'],
    queryFn: async () => {
      const rows = await adminApi.getSimuladoEngagement(100)
      const map = new Map<string, SimuladoEngagementRow>()
      rows.forEach(r => map.set(r.simulado_id, r))
      return map
    },
    staleTime: 5 * 60 * 1000,
  })
}
