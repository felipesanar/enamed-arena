import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import { toast } from '@/hooks/use-toast'

export function useAdminAttemptKpis(days: number) {
  return useQuery({
    queryKey: ['admin', 'attempt-kpis', days],
    queryFn: () => adminApi.getAttemptKpis(days),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminAttemptList(
  search: string,
  simuladoId: string | null,
  status: string,
  days: number,
  page: number,
) {
  return useQuery({
    queryKey: ['admin', 'attempts', search, simuladoId, status, days, page],
    queryFn: () => adminApi.listAttempts(search, simuladoId, status, days, 25, (page - 1) * 25),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useAdminSimuladoList() {
  return useQuery({
    queryKey: ['admin', 'simulados-list'],
    queryFn: () => adminApi.listSimulados(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useAdminCancelAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attemptId: string) => adminApi.cancelAttempt(attemptId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'attempts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'attempt-kpis'] })
    },
    onError: () => {
      toast({ title: 'Erro ao cancelar tentativa', variant: 'destructive' })
    },
  })
}

export function useAdminDeleteAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attemptId: string) => adminApi.deleteAttempt(attemptId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'attempts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'attempt-kpis'] })
    },
    onError: () => {
      toast({ title: 'Erro ao excluir tentativa', variant: 'destructive' })
    },
  })
}
