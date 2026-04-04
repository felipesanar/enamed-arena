import { cn } from '@/lib/utils';
import { Flag, Zap } from 'lucide-react';
import type { ExamAnswer } from '@/types/exam';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  answers: Record<string, ExamAnswer>;
  questionIds: string[];
  onNavigate: (index: number) => void;
}

export function QuestionNavigator({
  totalQuestions, currentIndex, answers, questionIds, onNavigate,
}: QuestionNavigatorProps) {
  // Dynamic column count — Academy pattern
  const columns = 6;

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {questionIds.map((qId, i) => {
        const a = answers[qId];
        const isAnswered = !!a?.selectedOption;
        const isReview = !!a?.markedForReview;
        const isHighConf = !!a?.highConfidence;
        const isCurrent = i === currentIndex;

        return (
          <button
            key={qId}
            type="button"
            onClick={() => onNavigate(i)}
            aria-label={`Questão ${i + 1}${isAnswered ? ', respondida' : ''}${isReview ? ', marcada para revisão' : ''}`}
            className={cn(
              'relative h-9 w-full rounded-lg text-[11px] font-semibold transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              isCurrent && 'ring-2 ring-primary ring-offset-2 text-primary',
              isAnswered && !isReview
                ? 'bg-info text-info-foreground border border-info/50'
                : isReview
                  ? 'bg-warning text-warning-foreground border border-warning/60'
                  : 'bg-transparent border border-[hsl(var(--exam-border))] text-muted-foreground hover:bg-muted/30',
            )}
          >
            {i + 1}
            {isReview && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-warning flex items-center justify-center">
                <Flag className="h-[7px] w-[7px] text-warning-foreground" />
              </span>
            )}
            {isHighConf && !isReview && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success flex items-center justify-center">
                <Zap className="h-[7px] w-[7px] text-success-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
