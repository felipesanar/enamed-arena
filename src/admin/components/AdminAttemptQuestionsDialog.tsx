// src/admin/components/AdminAttemptQuestionsDialog.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Check, X, MinusCircle } from 'lucide-react'
import { useAdminAttemptQuestions } from '@/admin/hooks/useAdminUsuarios'
import type { UserAttemptRow, AttemptQuestionRow } from '@/admin/types'

interface AdminAttemptQuestionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attempt: UserAttemptRow | null
}

function scoreColor(pct: number): string {
  return pct >= 70 ? 'text-admin-success' : pct >= 50 ? 'text-admin-warning' : 'text-admin-destructive'
}

function QuestionRow({ q }: { q: AttemptQuestionRow }) {
  const state: 'correct' | 'wrong' | 'blank' = !q.was_answered
    ? 'blank'
    : q.is_correct
      ? 'correct'
      : 'wrong'

  const Icon = state === 'correct' ? Check : state === 'wrong' ? X : MinusCircle
  const iconCls =
    state === 'correct'
      ? 'text-admin-success'
      : state === 'wrong'
        ? 'text-admin-destructive'
        : 'text-admin-muted'

  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-admin-line/40 last:border-0">
      <span className="text-[10px] font-mono text-admin-muted w-6 shrink-0 pt-0.5 text-right">
        {q.question_number}
      </span>
      <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', iconCls)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {q.area && (
            <span className="px-1.5 py-0.5 rounded bg-admin-raised text-[9px] text-admin-muted">
              {q.area}
            </span>
          )}
          {q.theme && (
            <span className="text-[10px] text-admin-faint truncate">{q.theme}</span>
          )}
        </div>
        <p className="text-[11px] text-admin-text/90 mt-0.5 line-clamp-2">{q.question_text}</p>

        <div className="flex items-center gap-2 mt-1 text-[10px]">
          {state === 'blank' ? (
            <span className="text-admin-muted italic">Não respondida</span>
          ) : (
            <>
              <span className={cn(state === 'correct' ? 'text-admin-success' : 'text-admin-destructive')}>
                Marcou <strong>{q.selected_label ?? '—'}</strong>
              </span>
              {state === 'wrong' && (
                <span className="text-admin-muted">
                  · Correta <strong className="text-admin-success">{q.correct_label ?? '—'}</strong>
                </span>
              )}
            </>
          )}
          {q.confidence && (
            <span className="text-admin-faint">· confiança: {q.confidence}</span>
          )}
        </div>

        {q.ai_suggested_reason && (
          <p className="text-[10px] text-admin-warning/90 mt-1">
            Motivo (IA): {q.ai_suggested_reason}
          </p>
        )}
      </div>
    </div>
  )
}

export function AdminAttemptQuestionsDialog({
  open,
  onOpenChange,
  attempt,
}: AdminAttemptQuestionsDialogProps) {
  const { data: questions = [], isLoading, isError } = useAdminAttemptQuestions(
    open ? attempt?.attempt_id ?? null : null,
  )

  if (!attempt) return null

  const answered = questions.filter(q => q.was_answered).length
  const correct = questions.filter(q => q.is_correct).length
  const total = questions.length
  const pct = attempt.score_percentage

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-admin-surface border-admin-line text-admin-text max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-admin-text">
            <span className="text-admin-muted">#{attempt.sequence_number}</span>
            <span className="truncate">{attempt.simulado_title}</span>
            <Badge
              variant="outline"
              className={cn(
                'ml-auto text-[10px] shrink-0',
                attempt.is_within_window
                  ? 'bg-admin-success/10 text-admin-success border-admin-success/30'
                  : 'bg-admin-raised text-admin-muted border-admin-line',
              )}
            >
              {attempt.is_within_window ? 'Válido para ranking' : 'Modo treino'}
            </Badge>
          </DialogTitle>
          <div className="flex items-center gap-3 pt-1 text-xs text-admin-muted">
            {pct != null && (
              <span className={cn('font-semibold', scoreColor(pct))}>{pct.toFixed(1)}%</span>
            )}
            {total > 0 && <span>{correct}/{total} acertos</span>}
            {total > 0 && answered < total && (
              <span className="text-admin-faint">{total - answered} em branco</span>
            )}
            {attempt.is_within_window && attempt.ranking_position != null && (
              <span>Posição {attempt.ranking_position}º</span>
            )}
            <span>
              {new Date(attempt.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
              })}
            </span>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto -mx-1 px-1 mt-1">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-admin-raised/50 rounded animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-xs text-admin-destructive">
              Erro ao carregar as questões desta tentativa.
            </p>
          ) : total === 0 ? (
            <p className="py-8 text-center text-xs text-admin-muted">
              Esta tentativa não tem resultado por questão registrado
              {attempt.status !== 'submitted' ? ' (não foi finalizada).' : '.'}
            </p>
          ) : (
            <div>
              {questions.map(q => (
                <QuestionRow key={q.question_id} q={q} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
