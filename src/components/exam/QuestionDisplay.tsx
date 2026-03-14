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
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
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

              {/* Eliminate/restore button — Academy pattern */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEliminateOption(opt.id);
                }}
                className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md flex items-center justify-center',
                  'transition-opacity text-muted-foreground hover:text-foreground hover:bg-muted',
                  isEliminated ? 'opacity-100 text-destructive' : 'opacity-0 group-hover:opacity-100',
                )}
                title={isEliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
              >
                {isEliminated ? <Undo2 className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
