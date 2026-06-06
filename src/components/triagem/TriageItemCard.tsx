/**
 * TriageItemCard — card de uma questão candidata na tela de triagem pós-prova.
 *
 * Exibe número, área/tema, badge de resultado, motivo ajustável via
 * `TriageReasonPicker`, racional da IA (expansível) e botão "Pular".
 */

import { useState } from 'react';
import { XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DbReason } from '@/lib/errorNotebookReasons';
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

  return (
    <article
      className={cn(
        'relative rounded-2xl border bg-card transition-all duration-200',
        skipped
          ? 'opacity-50 border-border/40'
          : 'border-border shadow-sm hover:shadow-md',
      )}
      aria-label={`Questão ${questionNumber}: ${area} — ${theme}`}
    >
      {/* Faixa lateral colorida indicando erro/chute */}
      <span
        className={cn(
          'absolute left-0 top-3 bottom-3 w-1 rounded-full',
          isCorrect ? 'bg-yellow-400' : 'bg-destructive/70',
        )}
        aria-hidden
      />

      <div className="pl-4 pr-3 pt-3 pb-3 sm:pl-5 sm:pr-4 sm:pt-4 sm:pb-4">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-caption text-muted-foreground mb-0.5">
              Q{questionNumber} · {area}
            </p>
            <p className="text-body-sm font-medium text-foreground leading-snug line-clamp-2">
              {theme}
            </p>
          </div>

          {/* Badge de resultado */}
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold',
              isCorrect
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                : 'bg-red-50 text-red-700 border border-red-200',
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

        {/* Motivo + racional */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <TriageReasonPicker
            reason={reason}
            originalReason={originalReason}
            source={source}
            isLoading={isLoading}
            alreadyInNotebook={alreadyInNotebook}
            onChange={r => onReasonChange(questionId, r)}
          />

          {/* Racional da IA */}
          {!isLoading && rationale && (
            <button
              type="button"
              onClick={() => setRationaleExpanded(v => !v)}
              className="text-caption text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
              aria-expanded={rationaleExpanded}
              aria-label={rationaleExpanded ? 'Ocultar racional da IA' : 'Ver racional da IA'}
            >
              {rationaleExpanded ? 'ocultar' : 'ver racional'}
            </button>
          )}
        </div>

        {rationaleExpanded && rationale && (
          <p className="mt-2 text-caption italic text-muted-foreground leading-snug">
            {rationale}
            {aiCertainty === 'baixa' && (
              <span className="ml-1 not-italic text-muted-foreground/60">(classificação incerta)</span>
            )}
          </p>
        )}

        {/* Ação de pular / reinserir */}
        <div className="mt-3 flex justify-end">
          {skipped ? (
            <button
              type="button"
              onClick={() => onUnskip(questionId)}
              className="text-caption text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            >
              Reinserir
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSkip(questionId)}
              className="text-caption text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded transition-colors"
            >
              Pular
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
