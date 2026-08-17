// src/admin/hooks/useGabaritoSuspicion.ts
//
// Consumidores do sinal de distribuição (`suspectKey.ts`) em cima dos dados
// que já existem: `admin_simulado_question_stats` para a análise por
// simulado, e a tabela `simulados` para achar candidatos à "janela de
// ouro" (janela de execução fechada, resultados ainda não liberados) sem
// varrer todo mundo.
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { adminApi } from '@/admin/services/adminApi'
import { useAdminSimuladoQuestionStats } from '@/admin/hooks/useAdminSimuladosAnalytics'
import { findSuspectKeys, type SuspectKey } from '@/admin/lib/suspectKey'
import { logger } from '@/lib/logger'

/** Suspeitas de gabarito de um simulado específico (tela de Analytics). */
export function useGabaritoSuspicion(simuladoId: string) {
  const { data: stats = [], isLoading, error } = useAdminSimuladoQuestionStats(simuladoId)

  const suspects = useMemo(() => findSuspectKeys(stats), [stats])

  return { suspects, isLoading, error }
}

export interface GoldenWindowSimulado {
  id: string
  title: string
  sequence_number: number
  execution_window_end: string
  results_release_at: string
}

/**
 * Simulados na "janela de ouro": execução encerrada, resultado ainda não
 * liberado — a janela em que o sinal de distribuição já está pronto e
 * ninguém olhou ainda (no S6 foram 33h). Consulta direta e enxuta, sem
 * passar pelo RPC de stats — só pra achar os candidatos.
 */
export function useGabaritoGoldenWindowSimulados() {
  return useQuery({
    queryKey: ['admin', 'gabarito-golden-window-simulados'],
    queryFn: async (): Promise<GoldenWindowSimulado[]> => {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('simulados')
        .select('id, title, sequence_number, execution_window_end, results_release_at')
        .eq('status', 'published')
        .lt('execution_window_end', nowIso)
        .gt('results_release_at', nowIso)
        .order('execution_window_end', { ascending: false })
      if (error) throw error
      return (data ?? []) as GoldenWindowSimulado[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Suspeitas de gabarito por simulado, para um conjunto pequeno de
 * candidatos (badge na lista de simulados, banner da janela de ouro).
 * Busca só os IDs passados — nunca varre todos os simulados.
 */
export function useGabaritoSuspicionMap(candidateIds: string[]) {
  const key = useMemo(() => [...candidateIds].sort().join(','), [candidateIds])

  return useQuery({
    queryKey: ['admin', 'gabarito-suspicion-map', key],
    queryFn: async (): Promise<Map<string, SuspectKey[]>> => {
      const map = new Map<string, SuspectKey[]>()
      await Promise.all(
        candidateIds.map(async id => {
          try {
            const stats = await adminApi.getSimuladoQuestionStats(id)
            const suspects = findSuspectKeys(stats)
            if (suspects.length > 0) map.set(id, suspects)
          } catch (err) {
            logger.error('[useGabaritoSuspicionMap] Erro ao buscar stats do simulado:', id, err)
          }
        }),
      )
      return map
    },
    enabled: candidateIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}
