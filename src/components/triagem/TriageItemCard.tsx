/**
 * TriageItemCard v2 — card premium de questão candidata na triagem pós-prova.
 *
 * Visual:
 *  - Faixa lateral grossa na cor da causa (não do resultado).
 *  - Desktop: padding generoso, hover elevação, racional expansível com animação.
 *  - Mobile: alvos ≥44px, layout confortável.
 *
 * PRESERVA toda lógica de props — apenas apresentação redesenhada.
 */

import { useState } from 'react';
import { XCircle, AlertCircle, ChevronDown, ChevronUp, Minus, RotateCcw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DbReason } from '@/lib/errorNotebookReasons';
import { DB_REASON_META } from '@/lib/errorNotebookReasons';
import { TriageReasonPicker } from './TriageReasonPicker';

export interface TriageItemCardProps {
  questionId: string;
  questionNumber: number;
  area: string;
  theme: string;
  /** false = errou; true = acertou no chute (baixa confiança) */
  isCorrect: boolean;
  reason: DbReason;
  originalReason: DbReason;
  source: 'ia' | 'heuristic';
  /** Racional fornecido pela IA (1 frase). Null quando não disponível. */
  rationale: string | null;
  aiCertainty: 'alta' | 'baixa' | null;
  isLoading: boolean;
  alreadyInNotebook: boolean;
  skipped: boolean;
  onReasonChange: (questionId: string, reason: DbReason) => void;
  onSkip: (questionId: string) => void;
  onUnskip: (questionId: string) => void;
}

export function TriageItemCard({
  questionId,
  questionNumber,
  area,
  theme,
  isCorrect,
  reason,
  originalReason,
  source,
  rationale,
  aiCertainty,
  isLoading,
  alreadyInNotebook,
  skipped,
  onReasonChange,
  onSkip,
  onUnskip,
}: TriageItemCardProps) {
  const [rationaleExpanded, setRationaleExpanded] = useState(false);

  // Cor da faixa lateral: usa a cor da causa quando já classificado, senão cor do resultado
  const causeMeta = isLoading ? null : DB_REASON_META[reason] ?? null;
  const stripeColor = isLoading
    ? 'var(--c-surface-2)'
    : causeMeta
      ? causeMeta.colorBase
      : isCorrect
        ? '#EAB308'
        : '#DC2626';

  return (
    <article
      className={cn(
        'caderno-root relative overflow-hidden',
        'rounded-[var(--c-radius-card)] border bg-[var(--c-surface)]',
        'shadow-[var(--c-shadow-sm)]',
        'transition-all duration-[var(--c-duration-base)]',
        skipped
          ? 'opacity-40 border-[var(--c-border)]/40'
          : [
              'border-[var(--c-border)]',
              'hover:shadow-[var(--c-shadow-md)] hover:-translate-y-[2px]',
              'motion-reduce:hover:translate-y-0',
            ],
      )}
      aria-label={`Questão ${questionNumber}: ${area} — ${theme}`}
    >
      {/* Faixa lateral colorida (causa) */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[var(--c-radius-card)]"
        style={{
          background: isLoading
            ? 'var(--c-surface-2)'
            : stripeColor,
          transition: 'background 320ms ease',
        }}
        aria-hidden
      />

      <div className="pl-5 pr-4 pt-4 pb-4">
        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Q# + área + tema */}
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1"
              style={{ color: 'var(--c-muted)' }}
            >
              Q{questionNumber} · {area}
            </p>
            <p
              className="text-sm font-semibold leading-snug line-clamp-2"
              style={{ color: 'var(--c-ink)' }}
            >
              {theme}
            </p>
          </div>

          {/* Badge resultado */}
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] border px-2.5 py-1',
              'text-[11px] font-semibold leading-none',
              isCorrect
                ? 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400',
            )}
          >
            {isCorrect ? (
              <>
                <AlertCircle className="h-3 w-3" aria-hidden />
                chute
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" aria-hidden />
                errou
              </>
            )}
          </span>
        </div>

        {/* ── Motivo + racional ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <TriageReasonPicker
            reason={reason}
            originalReason={originalReason}
            source={source}
            isLoading={isLoading}
            alreadyInNotebook={alreadyInNotebook}
            onChange={r => onReasonChange(questionId, r)}
          />

          {/* Fonte IA */}
          {!isLoading && source === 'ia' && !alreadyInNotebook && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium"
              style={{ color: 'var(--c-muted)' }}
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              IA
            </span>
          )}

          {/* Botão racional */}
          {!isLoading && rationale && (
            <button
              type="button"
              onClick={() => setRationaleExpanded(v => !v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] border px-2.5 py-1',
                'text-[11px] font-medium leading-none',
                'border-[var(--c-border)] bg-[var(--c-surface-2)]',
                'transition-colors duration-[var(--c-duration-fast)]',
                'hover:border-[var(--c-muted)]/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/40',
              )}
              style={{ color: 'var(--c-muted)' }}
              aria-expanded={rationaleExpanded}
              aria-label={rationaleExpanded ? 'Ocultar racional da IA' : 'Ver racional da IA'}
            >
              {rationaleExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" aria-hidden />
                  ocultar racional
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" aria-hidden />
                  ver racional
                </>
              )}
            </button>
          )}
        </div>

        {/* Racional expandível */}
        <AnimatePresence>
          {rationaleExpanded && rationale && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <p
                className={cn(
                  'mt-3 rounded-[var(--c-radius-control)] border px-3 py-2.5',
                  'text-[11px] italic leading-relaxed',
                  'border-[var(--c-border)] bg-[var(--c-surface-2)]',
                )}
                style={{ color: 'var(--c-muted)' }}
              >
                {rationale}
                {aiCertainty === 'baixa' && (
                  <span
                    className="ml-1.5 not-italic text-[10px]"
                    style={{ color: 'var(--c-muted-2)' }}
                  >
                    (classificação incerta)
                  </span>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Ação pular / reinserir ─────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-end">
          {skipped ? (
            <button
              type="button"
              onClick={() => onUnskip(questionId)}
              className={cn(
                'inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--c-radius-control)] px-3 py-1.5',
                'text-[11px] font-semibold',
                'border border-[var(--c-wine-500)]/30 bg-[var(--c-wine-50)] dark:bg-[var(--c-wine-900)]/20',
                'transition-colors duration-[var(--c-duration-fast)]',
                'hover:bg-[var(--c-wine-100)] dark:hover:bg-[var(--c-wine-900)]/30',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/40',
              )}
              style={{ color: 'var(--c-wine-600)' }}
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Reinserir
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSkip(questionId)}
              className={cn(
                'inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--c-radius-control)] px-3 py-1.5',
                'text-[11px] font-medium',
                'border border-[var(--c-border)] bg-transparent',
                'transition-colors duration-[var(--c-duration-fast)]',
                'hover:border-[var(--c-muted)]/40 hover:bg-[var(--c-surface-2)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-border)]',
              )}
              style={{ color: 'var(--c-muted)' }}
            >
              <Minus className="h-3 w-3" aria-hidden />
              Pular
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
