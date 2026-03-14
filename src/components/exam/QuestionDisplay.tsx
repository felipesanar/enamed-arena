import { cn } from '@/lib/utils';
import type { Question, QuestionOption } from '@/types';

interface QuestionDisplayProps {
  question: Question;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
}

export function QuestionDisplay({ question, selectedOptionId, onSelectOption }: QuestionDisplayProps) {
  return (
    <div className="animate-fade-in">
      {/* Area + theme badge */}
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

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelectOption(opt.id)}
            className={cn(
              'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
              'hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              selectedOptionId === opt.id
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:bg-muted/30',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-caption font-bold transition-colors',
                  selectedOptionId === opt.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {opt.label}
              </span>
              <span className="text-body text-foreground pt-0.5">{opt.text}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
