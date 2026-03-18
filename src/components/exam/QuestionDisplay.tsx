import { cn } from '@/lib/utils';
import type { Question } from '@/types';
import type { ExamAnswer } from '@/types/exam';
import { Trash2, Undo2 } from 'lucide-react';

interface QuestionDisplayProps {
  question: Question;
  answer: ExamAnswer | undefined;
  onSelectOption: (optionId: string) => void;
  onEliminateOption: (optionId: string) => void;
}

export function QuestionDisplay({ question, answer, onSelectOption, onEliminateOption }: QuestionDisplayProps) {
  const selectedId = answer?.selectedOption ?? null;
  const eliminated = answer?.eliminatedAlternatives ?? [];

  return (
    <div className="animate-fade-in">
      {/* Area + theme */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="px-2.5 py-1 rounded-md bg-accent text-accent-foreground text-caption font-medium">
          {question.area}
        </span>
        <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-caption">
          {question.theme}
        </span>
      </div>

      {/* Question number + statement */}
      <div className="mb-6">
        <p className="text-overline uppercase text-muted-foreground mb-2">
          Questão {question.number}
        </p>
        <p className="text-body-lg text-foreground leading-relaxed whitespace-pre-line">
          {question.text}
        </p>
      </div>

      {/* Options — inspired by Academy's AlternativaProva, elevated visually */}
      <div className="space-y-3">
        {question.options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const isEliminated = eliminated.includes(opt.id);

          return (
            <div key={opt.id} className="group relative">
              <button
                onClick={() => {
                  if (isEliminated) {
                    onEliminateOption(opt.id); // restore first
                  }
                  onSelectOption(opt.id);
                }}
                className={cn(
                  'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  'active:scale-[0.995]',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                    : isEliminated
                      ? 'border-border bg-muted/20 opacity-40'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-caption font-bold transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className={cn(
                    'text-body text-foreground pt-0.5',
                    isEliminated && 'line-through',
                  )}>
                    {opt.text}
                  </span>
                </div>
              </button>

              {/* Eliminate/restore — visible on touch (sm and below), hover on desktop */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEliminateOption(opt.id);
                }}
                className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] h-11 w-11 rounded-lg flex items-center justify-center',
                  'transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-90',
                  isEliminated ? 'opacity-100 text-destructive' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                )}
                title={isEliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
                aria-label={isEliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
              >
                {isEliminated ? <Undo2 className="h-4 w-4" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
