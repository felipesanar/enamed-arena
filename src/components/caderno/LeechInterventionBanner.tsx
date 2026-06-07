/**
 * LeechInterventionBanner — inline banner shown on error notebook entries that
 * have accumulated >= 4 lapses (leech state, `last_review_outcome = 'leech_blocked'`).
 *
 * Explains to the student why the entry is blocked and suggests a change of
 * approach. The primary CTA resets the leech via `simuladosApi.resetLeech`.
 *
 * Fase 1 behaviour:
 *   - "Recomeçar do zero" calls `simuladosApi.resetLeech(entryId)` and fires
 *     the `onReset` callback on success.
 *   - "Criar flashcard" is rendered but disabled (Fase 2 / placeholder).
 *
 * Props:
 *   entry   — the error notebook entry (SRS fields read via casts)
 *   onReset — called after the RPC succeeds so the parent can refresh the list
 *             or navigate to the review screen
 */

import { useState } from 'react';
import { AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { getLapseCount } from '@/lib/cadernoStatus';
import type { NotebookEntry } from '@/components/caderno/NotebookEntryCard';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface LeechInterventionBannerProps {
  /** The error notebook entry that triggered the leech intervention. */
  entry: NotebookEntry;
  /**
   * Called after `reset_leech_guarded` succeeds.
   * The caller should invalidate the caderno query / update local state.
   */
  onReset: (entryId: string) => void;
  /** Optional extra class names for the banner wrapper. */
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns an SRS-compatible shape from the UI's NotebookEntry camel-case fields. */
function toSrsFields(entry: NotebookEntry) {
  return {
    last_review_outcome: (entry as any).lastReviewOutcome ?? (entry as any).last_review_outcome,
    srs_lapses: (entry as any).srsLapses ?? (entry as any).srs_lapses,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LeechInterventionBanner({
  entry,
  onReset,
  className,
}: LeechInterventionBannerProps) {
  const [loading, setLoading] = useState(false);

  const srsFields = toSrsFields(entry);
  const lapseCount = getLapseCount(srsFields);
  const topicLabel = [entry.area, entry.theme].filter(Boolean).join(' › ') || 'este tema';

  async function handleReset() {
    if (loading) return;
    setLoading(true);
    try {
      await simuladosApi.resetLeech(entry.id);
      logger.log('[LeechInterventionBanner] Leech reset for entry', entry.id);
      toast({
        title: 'Revisão reativada',
        description: `A questão recomeçou com intervalos mais curtos. Bora estudar ${topicLabel}!`,
      });
      onReset(entry.id);
    } catch (err) {
      logger.error('[LeechInterventionBanner] Failed to reset leech:', err);
      toast({
        title: 'Não foi possível reativar',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'relative overflow-hidden rounded-xl border border-destructive/30 bg-destructive/5',
        'px-4 py-3.5',
        className,
      )}
    >
      {/* Accent stripe */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-destructive/70"
      />

      <div className="ml-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {/* Icon */}
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          aria-hidden
        />

        {/* Copy */}
        <div className="flex-1 space-y-1.5">
          {/* Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-destructive/30',
                'bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive',
              )}
            >
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
              Resistente
            </span>
            <span className="text-[11px] text-muted-foreground">
              {lapseCount} erro{lapseCount !== 1 ? 's' : ''} nas revisões
            </span>
          </div>

          <p className="text-[13px] font-semibold leading-snug text-foreground">
            Você está travando nesta questão
          </p>

          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Você já errou esta questão{' '}
            <strong className="font-semibold text-foreground">
              {lapseCount} {lapseCount !== 1 ? 'vezes' : 'vez'}
            </strong>
            . Tentar de novo do mesmo jeito não ajuda. Está na hora de mudar a estratégia em{' '}
            <span className="font-medium text-foreground">{topicLabel}</span>.
          </p>

          {/* Suggestions list */}
          <ul
            className="mt-1.5 space-y-1 text-[12px] text-muted-foreground"
            aria-label="Sugestoes de abordagem"
          >
            <li className="flex items-start gap-1.5">
              <span aria-hidden className="mt-0.5 text-destructive/60">•</span>
              <span>
                Estude o tema no SanarFlix com foco no raciocínio clínico, não na resposta.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span aria-hidden className="mt-0.5 text-destructive/60">•</span>
              <span>
                Crie um flashcard comparando os diagnósticos diferenciais{' '}
                <span className="rounded-sm bg-muted px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fase 2
                </span>
                .
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span aria-hidden className="mt-0.5 text-destructive/60">•</span>
              <span>
                Quando se sentir seguro, reative a revisão abaixo. O caderno
                recomeça do zero, com intervalos mais curtos.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2 pl-6 sm:pl-9">
        {/* Fase 2 placeholder */}
        <Button
          variant="outline"
          size="sm"
          disabled
          className="gap-2 opacity-50"
          aria-disabled
          title="Disponível em breve"
        >
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Criar flashcard
          <span className="ml-0.5 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            em breve
          </span>
        </Button>

        <Button
          variant="destructive"
          size="sm"
          onClick={handleReset}
          disabled={loading}
          className="gap-2"
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
              Reativando…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Mudei minha estratégia, reativar revisão
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
