import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import { toast } from '@/hooks/use-toast'

// ─── Query key helper ────────────────────────────────────────────────────────

function questionsKey(simuladoId: string) {
  return ['admin', 'questions', simuladoId] as const
}

// ─── Error mapping ───────────────────────────────────────────────────────────

function mapQuestionError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? ''
  if (msg.includes('question_has_answers')) return 'Esta questão já foi respondida e não pode ser excluída.'
  if (msg.includes('invalid_option')) return 'Alternativa inválida.'
  if (msg.includes('not_found')) return 'Registro não encontrado.'
  return 'Erro ao salvar. Tente novamente.'
}

// ─── Query ───────────────────────────────────────────────────────────────────

export function useAdminSimuladoQuestions(simuladoId: string) {
  return useQuery({
    queryKey: questionsKey(simuladoId),
    queryFn: () => adminApi.getSimuladoQuestions(simuladoId),
    enabled: !!simuladoId,
    staleTime: 60_000,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useUpdateQuestion(simuladoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: {
        text: string
        area: string
        theme: string
        difficulty: string
        explanation: string | null
        image_url: string | null
        explanation_image_url: string | null
        image_url_2: string | null
      }
    }) => adminApi.updateQuestion(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionsKey(simuladoId) })
      toast({ title: 'Questão atualizada com sucesso.' })
    },
    onError: (error) => {
      toast({ title: mapQuestionError(error), variant: 'destructive' })
    },
  })
}

export function useUpdateOption(simuladoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ optionId, text }: { optionId: string; text: string }) =>
      adminApi.updateOption(optionId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionsKey(simuladoId) })
      toast({ title: 'Alternativa atualizada com sucesso.' })
    },
    onError: (error) => {
      toast({ title: mapQuestionError(error), variant: 'destructive' })
    },
  })
}

export function useSetCorrectOption(simuladoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, optionId }: { questionId: string; optionId: string }) =>
      adminApi.setCorrectOption(questionId, optionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionsKey(simuladoId) })
      toast({ title: 'Gabarito atualizado com sucesso.' })
    },
    onError: (error) => {
      toast({ title: mapQuestionError(error), variant: 'destructive' })
    },
  })
}

export function useDeleteQuestion(simuladoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteQuestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionsKey(simuladoId) })
      toast({ title: 'Questão excluída com sucesso.' })
    },
    onError: (error) => {
      toast({ title: mapQuestionError(error), variant: 'destructive' })
    },
  })
}
