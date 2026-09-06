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
      caderno_id?: string | null
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

// ─── Cadernos do presencial (Vermelho / Azul) ───
// Ver docs/superpowers/specs/2026-09-06-presencial-cadernos.md — contrato congelado.

/** Cadernos de um simulado (nº de itens, ativo/inativo, resumo da última verificação). */
export function useAdminPresencialCadernos(simuladoId: string | null) {
  return useQuery({
    queryKey: ['admin', 'presencial-cadernos', simuladoId],
    queryFn: () => adminApi.presencialCadernosList(simuladoId as string),
    enabled: !!simuladoId,
    staleTime: 30 * 1000,
  })
}

/**
 * Verifica um caderno contra o gabarito impresso colado no painel.
 * Read-only: não ativa nada (ativação é só pelo script de importação com service role).
 */
export function useAdminPresencialCadernoVerify() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cadernoId, key }: { cadernoId: string; key: string }) =>
      adminApi.presencialCadernoVerify(cadernoId, key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'presencial-cadernos'] })
    },
    onError: (err: any) => {
      logger.error('[useAdminPresencialCadernoVerify] Falha ao verificar caderno:', err)
      toast({ title: 'Erro ao verificar caderno', description: err?.message, variant: 'destructive' })
    },
  })
}
