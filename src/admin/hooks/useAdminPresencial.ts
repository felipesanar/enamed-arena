import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import { toast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'

export function useAdminPresencialSessions() {
  return useQuery({
    queryKey: ['admin', 'presencial-sessions'],
    queryFn: () => adminApi.presencialSessions(),
    staleTime: 60 * 1000,
  })
}

export function useAdminPresencialSessionUpsert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: {
      id: string | null
      simulado_id: string
      code: string
      label: string
      opens_at: string
      closes_at: string
      is_active: boolean
    }) => adminApi.presencialSessionUpsert(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'presencial-sessions'] })
    },
    onError: (err: any) => {
      logger.error('[useAdminPresencialSessionUpsert] Falha ao salvar sessão:', err)
      toast({ title: 'Erro ao salvar sessão', description: err?.message, variant: 'destructive' })
    },
  })
}

export function useAdminPresencialQueue(status: string) {
  return useQuery({
    queryKey: ['admin', 'presencial-queue', status],
    queryFn: () => adminApi.presencialQueue(status),
    staleTime: 30 * 1000,
  })
}

export function useAdminPresencialLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ submissionId, userId }: { submissionId: string; userId: string }) =>
      adminApi.presencialLink(submissionId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'presencial-queue'] })
      qc.invalidateQueries({ queryKey: ['admin', 'presencial-sessions'] })
      toast({ title: 'Submissão vinculada', description: 'A nota já está na conta escolhida.' })
    },
    onError: (err: any) => {
      logger.error('[useAdminPresencialLink] Falha ao vincular submissão:', err)
      toast({ title: 'Erro ao vincular', description: err?.message, variant: 'destructive' })
    },
  })
}

export function useAdminPresencialReassign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ attemptId, toUserId }: { attemptId: string; toUserId: string }) =>
      adminApi.presencialReassign(attemptId, toUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'presencial-queue'] })
      qc.invalidateQueries({ queryKey: ['admin', 'attempts'] })
      toast({ title: 'Tentativa reatribuída', description: 'A nota agora pertence à conta de destino.' })
    },
    onError: (err: any) => {
      logger.error('[useAdminPresencialReassign] Falha ao reatribuir tentativa:', err)
      toast({ title: 'Erro ao reatribuir', description: err?.message, variant: 'destructive' })
    },
  })
}

/** Busca de conta por e-mail (reutilizada por "Escolher outra conta" e "Reatribuir tentativa"). */
export function useAdminAccountEmailSearch(email: string) {
  return useQuery({
    queryKey: ['admin', 'account-email-search', email],
    queryFn: () => adminApi.listUsers(email, 'all', 8, 0),
    enabled: email.trim().length >= 3,
    staleTime: 30 * 1000,
  })
}

/** Tentativas de uma conta (usado pela ferramenta "Reatribuir tentativa" para escolher qual mover). */
export function useAdminAccountAttempts(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'account-attempts', userId],
    queryFn: () => adminApi.getUserAttempts(userId as string, 15),
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}
