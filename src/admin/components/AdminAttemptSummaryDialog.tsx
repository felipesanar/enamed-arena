// src/admin/components/AdminAttemptSummaryDialog.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExternalLink, User, Clock, Calendar, Award, CheckCircle2 } from 'lucide-react'
import type { SimuladoResultRow } from '@/admin/services/adminApi'

interface AdminAttemptSummaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: SimuladoResultRow | null
  simuladoId: string
  /** Média geral da cohort (de getSimuladoDetailStats) */
  cohortAvgScore?: number | null
}

function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ScoreBar({ score, cohort }: { score: number; cohort?: number | null }) {
  const pct = Math.min(100, Math.max(0, score))
  const barColor =
    pct >= 70 ? 'bg-admin-success' : pct >= 50 ? 'bg-admin-warning' : 'bg-admin-destructive'
  const textColor =
    pct >= 70
      ? 'text-admin-success'
      : pct >= 50
        ? 'text-admin-warning'
        : 'text-admin-destructive'

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className={cn('text-3xl font-bold tabular-nums', textColor)}>
          {pct.toFixed(1)}%
        </span>
        {cohort != null && (
          <span className="text-xs text-admin-muted">
            Média da turma:{' '}
            <span
              className={cn(
                'font-semibold',
                cohort >= 70
                  ? 'text-admin-success'
                  : cohort >= 50
                    ? 'text-admin-warning'
                    : 'text-admin-destructive',
              )}
            >
              {cohort.toFixed(1)}%
            </span>
            {' '}
            <span
              className={cn(
                'font-semibold',
                pct - cohort > 0 ? 'text-admin-success' : pct - cohort < 0 ? 'text-admin-destructive' : 'text-admin-muted',
              )}
            >
              ({pct - cohort > 0 ? '+' : ''}{(pct - cohort).toFixed(1)} pp)
            </span>
          </span>
        )}
      </div>
      <div className="h-2 bg-admin-raised rounded-full overflow-hidden">
        <div className={cn('h-2 rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-admin-line/50 last:border-0">
      <Icon className="h-3.5 w-3.5 text-admin-muted mt-0.5 shrink-0" />
      <span className="text-[11px] text-admin-muted w-28 shrink-0">{label}</span>
      <span className="text-[11px] text-admin-text font-medium flex-1">{value}</span>
    </div>
  )
}

export function AdminAttemptSummaryDialog({
  open,
  onOpenChange,
  row,
  simuladoId,
  cohortAvgScore,
}: AdminAttemptSummaryDialogProps) {
  if (!row) return null

  const segmentCls =
    row.segment === 'pro'
      ? 'bg-admin-accent/10 text-admin-accent border-admin-accent/30'
      : row.segment === 'standard'
        ? 'bg-admin-success/10 text-admin-success border-admin-success/30'
        : 'bg-admin-raised text-admin-muted border-admin-line'

  const validCls = row.is_within_window
    ? 'bg-admin-success/10 text-admin-success border-admin-success/30'
    : 'bg-admin-raised text-admin-muted border-admin-line'

  const deltaSign = cohortAvgScore != null && row.score != null ? row.score - cohortAvgScore : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-admin-surface border-admin-line text-admin-text">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-admin-text">
            <User className="h-4 w-4 text-admin-muted shrink-0" />
            <span className="truncate">{row.name ?? 'Aluno sem nome'}</span>
            <Badge variant="outline" className={cn('ml-auto text-[10px] shrink-0', segmentCls)}>
              {row.segment}
            </Badge>
          </DialogTitle>
          {row.email && (
            <p className="text-xs text-admin-muted pt-0.5">{row.email}</p>
          )}
        </DialogHeader>

        {/* Score hero */}
        {row.score != null ? (
          <div className="bg-admin-raised/40 rounded-lg px-4 py-3 border border-admin-line/60">
            <p className="text-[9px] font-bold text-admin-faint uppercase tracking-widest mb-2">
              Resultado
            </p>
            <ScoreBar score={row.score} cohort={cohortAvgScore} />
          </div>
        ) : (
          <div className="bg-admin-raised/40 rounded-lg px-4 py-3 border border-admin-line/60">
            <span className="text-sm text-admin-muted">Nota não calculada</span>
          </div>
        )}

        {/* Meta grid */}
        <div className="mt-1">
          <MetaRow
            icon={Award}
            label="Posição no ranking"
            value={`#${row.rank} de ${row.total_rows}`}
          />
          <MetaRow
            icon={CheckCircle2}
            label="Acertos"
            value={`${row.correct_count} / ${row.total_count}`}
          />
          <MetaRow
            icon={Clock}
            label="Tempo"
            value={fmtDuration(row.duration_seconds)}
          />
          <MetaRow
            icon={Calendar}
            label="Concluído em"
            value={row.submitted_at ? fmtDateLong(row.submitted_at) : '—'}
          />
          <MetaRow
            icon={User}
            label="Instituição"
            value={row.institution || <span className="text-admin-faint">—</span>}
          />
          <MetaRow
            icon={User}
            label="Especialidade"
            value={row.specialty || <span className="text-admin-faint">—</span>}
          />
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 pt-1">
          <Badge variant="outline" className={cn('text-[10px]', validCls)}>
            {row.is_within_window ? 'Válido para ranking' : 'Modo treino'}
          </Badge>
          {deltaSign != null && (
            <span className={cn(
              'text-[10px] font-semibold',
              deltaSign > 0 ? 'text-admin-success' : deltaSign < 0 ? 'text-admin-destructive' : 'text-admin-muted',
            )}>
              {deltaSign > 0 ? '▲' : deltaSign < 0 ? '▼' : '='} {Math.abs(deltaSign).toFixed(1)} pp vs. turma
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-admin-line mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-admin-muted hover:text-admin-text"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <a
            href={`/admin/preview/simulados/${simuladoId}/desempenho`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-admin-accent hover:text-admin-accent/80 motion-safe:transition-colors"
          >
            Ver desempenho completo (seu usuário)
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
