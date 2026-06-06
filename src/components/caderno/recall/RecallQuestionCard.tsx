/**
 * RecallQuestionCard
 *
 * Renders the question stem + options for the active-recall flow.
 * When `revealCorrect` is false (phases 1-2): all options are neutral.
 * When `revealCorrect` is true (phase 3+): correct/wrong options are highlighted.
 *
 * Handles touch swipe for mobile navigation.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertCircle, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuestionImage } from '@/components/exam/QuestionImage';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import type { Question } from '@/types';
import type { RecallEntry, EntryReviewData } from '@/hooks/useActiveRecallSession';

interface RecallQuestionCardProps {
  entry: RecallEntry;
  question: Question;
  reviewData: EntryReviewData;
  revealCorrect: boolean;
  /** Option id selected by student in this recall session (not the original simulado answer) */
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  /** Called when swipe-right (next) */
  onSwipeNext?: () => void;
  /** Called when swipe-left (prev) */
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
  const reasonMeta = getReasonMeta(entry.reason);

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
    // Only horizontal swipes (threshold 60px H, max 30px V)
    if (Math.abs(dx) >= 60 && dy <= 30) {
      if (dx < 0) onSwipeNext?.();
      else onSwipePrev?.();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Meta badges */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide cursor-help"
              style={{
                background: reasonMeta.colorBg,
                color: reasonMeta.colorText,
                borderColor: reasonMeta.colorBorder,
              }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: reasonMeta.colorBase }}
              />
              {reasonMeta.badge}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">Categoria do erro: {reasonMeta.badge.toLowerCase()}</TooltipContent>
        </Tooltip>

        {entry.area && (
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
            <span className="font-bold text-foreground">{entry.area}</span>
            {entry.theme && (
              <>
                <span className="mx-1.5 opacity-50">›</span>
                {entry.theme}
              </>
            )}
          </span>
        )}

        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <Clock className="h-2.5 w-2.5" aria-hidden />
          {(() => {
            const d = daysSince(entry.addedAt);
            if (d === 0) return 'Salva hoje';
            if (d === 1) return 'Há 1 dia';
            return `Há ${d} dias`;
          })()}
        </span>

        {entry.simuladoTitle && entry.simuladoId && (
          <Link
            to={`/simulados/${entry.simuladoId}/correcao?q=${entry.questionNumber ?? ''}`}
            className="text-caption text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors no-underline"
          >
            {entry.simuladoTitle}
          </Link>
        )}
      </div>

      {/* Question number */}
      <h2
        className="text-heading-3 text-foreground"
        tabIndex={-1}
        id={`recall-q-${entry.id}`}
      >
        Q{entry.questionNumber ?? '?'}
      </h2>

      {/* Student note */}
      {entry.learningNote && (
        <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-3">
          <p className="text-overline font-semibold uppercase text-muted-foreground">Sua anotação</p>
          <p className="mt-1 text-body-sm italic text-foreground/90">{entry.learningNote}</p>
        </div>
      )}

      {/* Stem — constrained height on mobile */}
      <div className="mt-5 md:max-h-none max-h-[50vh] overflow-y-auto">
        <p className="text-body text-foreground leading-relaxed whitespace-pre-wrap">
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

      {/* Options */}
      <div
        className="mt-5 space-y-2"
        role="radiogroup"
        aria-label="Alternativas"
      >
        {question.options.map((opt) => {
          const isCorrect = opt.id === question.correctOptionId;
          const isSelected = opt.id === selectedOptionId;
          const isWrongChoice = isSelected && !isCorrect;
          const isRightChoice = isSelected && isCorrect;
          const rationale =
            revealCorrect && !isCorrect && reviewData.aiOptionRationales
              ? reviewData.aiOptionRationales[opt.label]
              : null;

          // Visual state
          let borderClass = 'border-border bg-card';
          let labelClass = 'bg-muted text-muted-foreground';

          if (revealCorrect) {
            if (isCorrect) {
              borderClass = 'border-success/40 bg-success/[0.06]';
              labelClass = 'bg-success text-success-foreground';
            } else if (isWrongChoice) {
              borderClass = 'border-destructive/40 bg-destructive/[0.06]';
              labelClass = 'bg-destructive text-destructive-foreground';
            }
          } else if (isSelected) {
            borderClass = 'border-primary/50 ring-2 ring-primary/60 bg-card';
            labelClass = 'bg-primary/10 text-primary font-bold';
          }

          return (
            <div key={opt.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => !revealCorrect && onSelectOption(opt.id)}
                disabled={revealCorrect}
                className={cn(
                  'w-full flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors text-left',
                  borderClass,
                  !revealCorrect && 'cursor-pointer hover:border-primary/30 hover:bg-muted/40',
                  revealCorrect && 'cursor-default',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold',
                    labelClass,
                  )}
                  aria-hidden
                >
                  {opt.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-foreground leading-relaxed">{opt.text}</p>

                  {/* Reveal badges */}
                  {revealCorrect && (isSelected || isCorrect) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {isSelected && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            isWrongChoice
                              ? 'border-destructive/40 bg-destructive/10 text-destructive'
                              : 'border-success/40 bg-success/10 text-success',
                          )}
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
                        <span className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                          <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
                          Resposta correta
                        </span>
                      )}
                    </div>
                  )}

                  {/* Option rationale (wrong options only) */}
                  {rationale && (
                    <p className={cn(
                      'mt-2 flex items-start gap-1.5 text-[12px] leading-snug',
                      isWrongChoice ? 'text-destructive/90' : 'text-muted-foreground',
                    )}>
                      <XCircle className="mt-0.5 h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      <span>{rationale}</span>
                    </p>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Constructive summary (reveal phase only) */}
      {revealCorrect && selectedOptionId && (
        <div className="mt-5 flex flex-wrap items-center gap-3 text-caption">
          {(() => {
            const isCorrect = question.correctOptionId === selectedOptionId;
            const userLabel = question.options.find((o) => o.id === selectedOptionId)?.label ?? '?';
            return isCorrect ? (
              <span className="inline-flex items-center gap-1.5 text-success font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Você marcou {userLabel} e acertou. Bora consolidar o raciocínio.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-foreground font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                Você marcou {userLabel}. Vamos entender por que a resposta era outra.
              </span>
            );
          })()}
        </div>
      )}

      {/* Empty state when no option chosen yet (mobile CTA hint) */}
      {!revealCorrect && !selectedOptionId && (
        <p className="mt-4 text-center text-caption text-muted-foreground/70 hidden sm:block">
          Selecione uma alternativa para continuar
        </p>
      )}
    </div>
  );
}
