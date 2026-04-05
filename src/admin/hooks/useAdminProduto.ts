import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export function useAdminProdutoSegmentedFunnel(days: number) {
  return useQuery({
    queryKey: ['admin', 'produto-funnel', days],
    queryFn: () => adminApi.getProdutoSegmentedFunnel(days),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminProdutoFriction(days: number, segment: string) {
  return useQuery({
    queryKey: ['admin', 'produto-friction', days, segment],
    queryFn: () => adminApi.getProdutoFriction(days, segment),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminProdutoFeatureAdoption(days: number, segment: string) {
  return useQuery({
    queryKey: ['admin', 'produto-adoption', days, segment],
    queryFn: () => adminApi.getProdutoFeatureAdoption(days, segment),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminProdutoTopEvents(days: number) {
  return useQuery({
    queryKey: ['admin', 'produto-top-events', days],
    queryFn: () => adminApi.getProdutoTopEvents(days, 6),
    staleTime: 5 * 60 * 1000,
  })
}
