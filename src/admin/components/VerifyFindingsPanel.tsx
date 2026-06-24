import { Loader2, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { summarizeFindings, findingLabel } from '@/admin/lib/verifyFindings'
import type { QuestionVerifyFinding } from '@/admin/services/adminApi'

interface VerifyFindingsPanelProps {
  findings: QuestionVerifyFinding[]
  loading: boolean
  aiRan?: boolean
}

export function VerifyFindingsPanel({ findings, loading, aiRan }: VerifyFindingsPanelProps) {
  const { errorCount, warningCount, byQuestion } = summarizeFindings(findings)

  return (
    <Card className="bg-admin-surface border-admin-line text-admin-text">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-admin-text flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-admin-accent" />
          ) : findings.length === 0 ? (
            aiRan ? (
              <CheckCircle2 className="h-4 w-4 text-admin-success" />
            ) : (
              <Info className="h-4 w-4 text-admin-muted" />
            )
          ) : errorCount > 0 ? (
            <AlertCircle className="h-4 w-4 text-admin-destructive" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-admin-warning" />
          )}
          Verificação de questões
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-admin-muted py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-admin-accent" />
            Analisando questões com IA...
          </div>
        )}

        {!loading && findings.length === 0 && (
          aiRan ? (
            <div className="flex items-center gap-2 text-sm text-admin-success py-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Nenhum problema detectado ✓
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-admin-muted py-2">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Sem problemas estruturais. Clique em &quot;Verificar com IA&quot; para checar as imagens.
            </div>
          )
        )}

        {!loading && findings.length > 0 && (
          <>
            <p className="text-sm font-medium">
              <span className="text-admin-destructive">{errorCount} erro{errorCount !== 1 ? 's' : ''}</span>
              {' · '}
              <span className="text-admin-warning">{warningCount} aviso{warningCount !== 1 ? 's' : ''}</span>
            </p>

            <div className="space-y-2">
              {byQuestion.map((finding, i) => (
                <div
                  key={i}
                  className={cn(
                    'border-l-4 rounded-r-md bg-admin-raised px-3 py-2',
                    finding.severity === 'error'
                      ? 'border-l-admin-destructive'
                      : 'border-l-admin-warning',
                  )}
                >
                  <p className="text-sm font-semibold text-admin-text flex items-center gap-1.5">
                    <span className="text-admin-muted">{finding.source === 'ai' ? '🤖' : '⚙️'}</span>
                    Q{finding.question_number} —{' '}
                    <span className={cn(
                      finding.severity === 'error'
                        ? 'text-admin-destructive'
                        : 'text-admin-warning',
                    )}>
                      {findingLabel(finding)}
                    </span>
                  </p>
                  {finding.evidence && (
                    <p className="text-xs text-admin-muted mt-0.5">{finding.evidence}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
