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
  const columns = Math.min(10, Math.ceil(Math.sqrt(totalQuestions)));

  return (
    <div
      className="grid gap-1.5"
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
            onClick={() => onNavigate(i)}
            className={cn(
              'relative h-8 w-full rounded-md text-[11px] font-semibold transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              isCurrent && 'ring-2 ring-primary ring-offset-2',
              isAnswered && !isReview
                ? 'bg-accent text-accent-foreground'
                : isReview
                  ? 'bg-info/20 text-info'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
          >
            {i + 1}
            {isReview && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-info flex items-center justify-center">
                <Flag className="h-[7px] w-[7px] text-info-foreground" />
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
