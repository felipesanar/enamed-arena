/**
 * RecallQuestionCard — Fase 1 e 3 do recall ativo.
 *
 * Redesign premium:
 * - CadernoCard base com radius/shadow do design-language.
 * - CauseBadge para causa do erro.
 * - Alternativas: hover elevado, transição suave, reveal com estados claros.
 * - Suporte a swipe mobile.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, Sparkles, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuestionImage } from '@/components/exam/QuestionImage';
import { CauseBadge } from '@/components/caderno/ui/CauseBadge';
import { cn } from '@/lib/utils';
import type { Question } from '@/types';
import type { RecallEntry, EntryReviewData } from '@/hooks/useActiveRecallSession';

interface RecallQuestionCardProps {
  entry: RecallEntry;
  question: Question;
  reviewData: EntryReviewData;
  revealCorrect: boolean;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function RecallQuestionCard({
  entry,
  question,
  reviewData,
  revealCorrect,
  selectedOptionId,
  onSelectOption,
  onSwipeNext,
  onSwipePrev,
}: RecallQuestionCardProps) {
  // Swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) >= 60 && dy <= 30) {
      if (dx < 0) onSwipeNext?.();
      else onSwipePrev?.();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const daysAgo = daysSince(entry.addedAt);

  return (
    <div
      className="rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow-sm)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Meta strip ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--c-border)] px-5 py-3">
        {/* Cause badge */}
        <CauseBadge reason={entry.reason} size="sm" />

        {/* Area › theme */}
        {entry.area && (
          <span className="inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] bg-[var(--c-surface-2)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--c-ink)]">
            {entry.area}
            {entry.theme && (
              <>
                <span className="opacity-40" aria-hidden>›</span>
                <span className="font-normal text-[var(--c-muted)]">{entry.theme}</span>
              </>
            )}
          </span>
        )}

        {/* Days since added */}
        <span className="inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] bg-[var(--c-surface-2)] px-2 py-0.5 text-[10px] text-[var(--c-muted)]">
          <Clock className="h-2.5 w-2.5" aria-hidden />
          {daysAgo === 0 ? 'Adicionada hoje' : daysAgo === 1 ? 'Há 1 dia' : `Há ${daysAgo} dias`}
        </span>

        {/* Simulado link */}
        {entry.simuladoTitle && entry.simuladoId && (
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <Link
                to={`/simulados/${entry.simuladoId}/correcao?q=${entry.questionNumber ?? ''}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--c-muted)] transition-colors hover:text-[var(--c-wine-500)] no-underline"
              >
                <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                {entry.simuladoTitle}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">Ver correção do simulado</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <div className="px-5 py-5">
        {/* Question number heading */}
        <h2
          className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--c-muted)] mb-3"
          tabIndex={-1}
          id={`recall-q-${entry.id}`}
        >
          Questão {entry.questionNumber ?? '?'}
        </h2>

        {/* Student note */}
        {entry.learningNote && (
          <div className="mb-4 rounded-[var(--c-radius-control)] border-l-2 border-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-wine-500)_4%,transparent)] px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--c-wine-500)_70%,transparent)] mb-1">
              Sua anotação
            </p>
            <p className="text-caption italic text-[color-mix(in_srgb,var(--c-ink)_80%,transparent)]">{entry.learningNote}</p>
          </div>
        )}

        {/* Stem */}
        <div className="max-h-[52vh] overflow-y-auto md:max-h-none">
          <p className="text-body leading-relaxed text-[var(--c-ink)] whitespace-pre-wrap">
            {question.text}
          </p>
          {question.imageUrl && (
            <div className="mt-4">
              <QuestionImage
                src={question.imageUrl}
                alt={`Imagem da questão ${entry.questionNumber ?? ''}`}
              />
            </div>
          )}
        </div>

        {/* ── Options ────────────────────────────────────────────────────────── */}
        <div className="mt-5 space-y-2" role="radiogroup" aria-label="Alternativas">
          {question.options.map((opt) => {
            const isCorrect = opt.id === question.correctOptionId;
            const isSelected = opt.id === selectedOptionId;
            const isWrongChoice = isSelected && !isCorrect;
            const isRightChoice = isSelected && isCorrect;
            const rationale =
              revealCorrect && !isCorrect && reviewData.aiOptionRationales
                ? reviewData.aiOptionRationales[opt.label]
                : null;

            // Visual states
            let containerStyle = 'border-[var(--c-border)] bg-[var(--c-surface)]';
            let labelStyle = 'bg-[var(--c-surface-2)] text-[var(--c-muted)]';
            let textStyle = 'text-[var(--c-ink)]';

            if (revealCorrect) {
              if (isCorrect) {
                containerStyle = '[border-color:color-mix(in_srgb,var(--c-success)_40%,transparent)] [background:color-mix(in_srgb,var(--c-success)_5%,transparent)]';
                labelStyle = 'bg-[var(--c-success)] text-white';
                textStyle = 'text-[var(--c-ink)]';
              } else if (isWrongChoice) {
                containerStyle = '[border-color:color-mix(in_srgb,var(--c-destructive)_40%,transparent)] [background:color-mix(in_srgb,var(--c-destructive)_5%,transparent)]';
                labelStyle = 'bg-[var(--c-destructive)] text-white';
                textStyle = 'text-[var(--c-ink)]';
              }
            } else if (isSelected) {
              containerStyle =
                'border-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)] bg-[color-mix(in_srgb,var(--c-wine-500)_3%,transparent)]';
              labelStyle = 'bg-[var(--c-wine-500)] text-white';
              textStyle = 'text-[var(--c-ink)] font-medium';
            }

            return (
              <div key={opt.id}>
                <motion.button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => !revealCorrect && onSelectOption(opt.id)}
                  disabled={revealCorrect}
                  whileTap={!revealCorrect ? { scale: 0.995 } : undefined}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-[var(--c-radius-control)] border px-3.5 py-3',
                    'transition-all duration-150 text-left',
                    containerStyle,
                    !revealCorrect &&
                      'cursor-pointer hover:border-[color-mix(in_srgb,var(--c-wine-500)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-wine-500)_2%,transparent)] hover:-translate-y-[1px] hover:shadow-[var(--c-shadow-sm)]',
                    revealCorrect && 'cursor-default',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-2',
                    'motion-reduce:hover:translate-y-0',
                  )}
                >
                  {/* Label badge */}
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-extrabold transition-colors duration-150',
                      labelStyle,
                    )}
                    aria-hidden
                  >
                    {opt.label}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className={cn('text-body-sm leading-relaxed', textStyle)}>{opt.text}</p>

                    {/* Reveal badges */}
                    {revealCorrect && (isSelected || isCorrect) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {isSelected && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            )}
                            style={isWrongChoice ? {
                              borderColor: 'color-mix(in srgb, var(--c-destructive) 35%, transparent)',
                              background: 'color-mix(in srgb, var(--c-destructive) 10%, transparent)',
                              color: 'var(--c-destructive)',
                            } : {
                              borderColor: 'color-mix(in srgb, var(--c-success) 35%, transparent)',
                              background: 'color-mix(in srgb, var(--c-success) 10%, transparent)',
                              color: 'var(--c-success)',
                            }}
                          >
                            {isWrongChoice ? (
                              <XCircle className="h-2.5 w-2.5" aria-hidden />
                            ) : (
                              <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
                            )}
                            Sua resposta
                          </span>
                        )}
                        {isCorrect && !isRightChoice && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              borderColor: 'color-mix(in srgb, var(--c-success) 35%, transparent)',
                              background: 'color-mix(in srgb, var(--c-success) 10%, transparent)',
                              color: 'var(--c-success)',
                            }}
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
                            Resposta correta
                          </span>
                        )}
                      </div>
                    )}

                    {/* Option rationale */}
                    {rationale && (
                      <p
                        className={cn(
                          'mt-2 flex items-start gap-1.5 text-[12px] leading-snug',
                          isWrongChoice ? '[color:color-mix(in_srgb,var(--c-destructive)_80%,transparent)]' : 'text-[var(--c-muted)]',
                        )}
                      >
                        <XCircle className="mt-0.5 h-3 w-3 shrink-0 opacity-70" aria-hidden />
                        <span>{rationale}</span>
                      </p>
                    )}
                  </div>
                </motion.button>
              </div>
            );
          })}
        </div>

        {/* Constructive summary after reveal */}
        {revealCorrect && selectedOptionId && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-2.5">
            {(() => {
              const isCorrect = question.correctOptionId === selectedOptionId;
              const userLabel =
                question.options.find((o) => o.id === selectedOptionId)?.label ?? '?';
              return isCorrect ? (
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold [color:var(--c-success)]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Você marcou {userLabel} e acertou! Consolide o raciocínio abaixo.
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--c-ink)]">
                  <Sparkles className="h-4 w-4 shrink-0 text-[var(--c-wine-500)]" aria-hidden />
                  Você marcou {userLabel}. Leia a análise abaixo para entender o erro.
                </span>
              );
            })()}
          </div>
        )}

        {/* Empty state hint (mobile) */}
        {!revealCorrect && !selectedOptionId && (
          <p className="mt-4 hidden text-center text-caption text-[color-mix(in_srgb,var(--c-muted)_70%,transparent)] sm:block">
            Selecione uma alternativa para continuar
          </p>
        )}
      </div>
    </div>
  );
}
