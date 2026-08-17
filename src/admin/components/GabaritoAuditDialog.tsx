/**
 * Modal de auditoria de gabarito — gate de publicação (Componente 3).
 *
 * Ver docs/superpowers/specs/2026-08-17-blindagem-gabarito-design.md
 *
 * Mostra os achados de `checkGabarito` (mais os achados próprios de estado
 * impossível: nenhuma/mais de uma alternativa marcada) e, opcionalmente, a
 * 2ª opinião por IA injetada na mesma lista. Duas saídas: "Voltar e corrigir"
 * (fecha sem publicar) ou "Publicar mesmo assim" (destrutiva — quem decide
 * segue em frente vendo a lista completa, não às cegas).
 */
import { AlertCircle, Info, Loader2, Sparkles } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GabaritoSummary } from '@/admin/lib/gabaritoCheck'
import type { GabaritoAiFinding } from '@/admin/services/adminApi'

interface DisplayFinding {
  questionNumber: number
  severity: 'error' | 'warning'
  source: 'rule' | 'ai'
  what: string
  how: string
  evidence: string
  proposedLabel?: string
}

const AI_WHAT = 'A IA encontrou uma possível divergência entre o comentário e o gabarito.'
const AI_HOW = 'Revise o comentário e confirme a alternativa correta antes de publicar.'

function buildDisplayList(summary: GabaritoSummary | null, aiFindings: GabaritoAiFinding[]): DisplayFinding[] {
  const rule: DisplayFinding[] = summary
    ? [...summary.errors, ...summary.warnings].map((f) => ({
        questionNumber: f.questionNumber,
        severity: f.severity === 'error' ? ('error' as const) : ('warning' as const),
        source: 'rule' as const,
        what: f.what,
        how: f.how,
        evidence: f.evidence,
        proposedLabel: f.proposedLabel,
      }))
    : []

  const ai: DisplayFinding[] = aiFindings.map((f) => ({
    questionNumber: f.question_number,
    severity: f.severity,
    source: 'ai' as const,
    what: AI_WHAT,
    how: AI_HOW,
    evidence: f.evidence,
    proposedLabel: f.proposed_label,
  }))

  return [...rule, ...ai].sort((a, b) => {
    if (a.questionNumber !== b.questionNumber) return a.questionNumber - b.questionNumber
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    return a.source === b.source ? 0 : a.source === 'rule' ? -1 : 1
  })
}

export interface GabaritoAuditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary: GabaritoSummary | null
  aiFindings?: GabaritoAiFinding[]
  aiLoading?: boolean
  onRunAiSecondOpinion: () => void
  /** Fecha o modal e não publica — quem chama volta a editar as questões. */
  onBackToFix: () => void
  /** Ignora os achados e segue com a publicação. */
  onPublishAnyway: () => void
  publishing?: boolean
}

export function GabaritoAuditDialog({
  open,
  onOpenChange,
  summary,
  aiFindings = [],
  aiLoading = false,
  onRunAiSecondOpinion,
  onBackToFix,
  onPublishAnyway,
  publishing = false,
}: GabaritoAuditDialogProps) {
  const errorQuestionCount = new Set((summary?.errors ?? []).map((f) => f.questionNumber)).size
  const warningCount = summary?.warnings.length ?? 0
  const unverifiableCount = summary?.unverifiableCount ?? 0
  const items = buildDisplayList(summary, aiFindings)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-admin-surface border-admin-line text-admin-text">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-admin-text">
            <AlertCircle className="h-5 w-5 text-admin-destructive" />
            Divergências no gabarito encontradas
          </DialogTitle>
          <DialogDescription className="text-admin-muted">
            Antes de publicar, confira as questões abaixo. Um gabarito errado só costuma aparecer
            depois que os alunos já responderam.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium">
            <span className="text-admin-destructive">
              {errorQuestionCount} {errorQuestionCount === 1 ? 'questão' : 'questões'} com erro
            </span>
            {' · '}
            <span className="text-admin-warning">
              {warningCount} aviso{warningCount !== 1 ? 's' : ''}
            </span>
          </p>

          {unverifiableCount > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-admin-muted">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {unverifiableCount} {unverifiableCount === 1 ? 'questão' : 'questões'} sem marcação verificável no
              comentário.
            </p>
          )}

          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {items.length === 0 && (
              <p className="py-2 text-sm text-admin-muted">Nenhuma divergência encontrada.</p>
            )}
            {items.map((item, i) => (
              <div
                key={`${item.questionNumber}-${item.source}-${i}`}
                className={cn(
                  'rounded-r-md border-l-4 bg-admin-raised px-3 py-2',
                  item.severity === 'error' ? 'border-l-admin-destructive' : 'border-l-admin-warning',
                )}
              >
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-admin-text">
                  <span className="text-admin-muted">{item.source === 'ai' ? '🤖' : '⚙️'}</span>
                  Questão {item.questionNumber}
                  {item.proposedLabel && (
                    <span className="rounded bg-admin-accent/15 px-1.5 py-0.5 text-[11px] font-bold text-admin-accent">
                      Proposta: {item.proposedLabel}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-admin-text">{item.what}</p>
                <p className="text-xs text-admin-muted">{item.how}</p>
                {item.evidence && (
                  <p
                    className="mt-1 truncate font-mono text-[11px] text-admin-faint"
                    title={item.evidence}
                  >
                    {item.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={aiLoading}
            onClick={onRunAiSecondOpinion}
            className="border-admin-line bg-transparent text-admin-text hover:bg-admin-raised"
          >
            {aiLoading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Conferindo com a IA...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Conferir também com a IA
              </>
            )}
          </Button>
        </div>

        <DialogFooter className="-mx-6 -mb-6 mt-2 rounded-b-lg border-t border-admin-line-subtle bg-admin-bg px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={publishing}
            onClick={onPublishAnyway}
            className="text-admin-destructive hover:bg-admin-destructive/10 hover:text-admin-destructive"
          >
            {publishing ? 'Publicando...' : 'Publicar mesmo assim'}
          </Button>
          <Button
            type="button"
            disabled={publishing}
            onClick={onBackToFix}
            className="bg-admin-accent text-admin-accent-contrast hover:bg-admin-accent/90"
          >
            Voltar e corrigir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
