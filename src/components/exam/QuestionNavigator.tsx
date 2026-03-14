import { cn } from '@/lib/utils';
import { Flag, Zap } from 'lucide-react';

interface QuestionNavigatorProps {
  total: number;
  currentIndex: number;
  answers: Record<string, string | null>;
  reviewFlags: Record<string, boolean>;
  highConfidenceFlags: Record<string, boolean>;
  questionIds: string[];
  onNavigate: (index: number) => void;
}

export function QuestionNavigator({
  total, currentIndex, answers, reviewFlags, highConfidenceFlags, questionIds, onNavigate,
}: QuestionNavigatorProps) {
  return (
    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
      {questionIds.map((qId, i) => {
        const isAnswered = !!answers[qId];
        const isReview = reviewFlags[qId];
        const isHighConf = highConfidenceFlags[qId];
        const isCurrent = i === currentIndex;

        return (
          <button
            key={qId}
            onClick={() => onNavigate(i)}
            className={cn(
              'relative h-9 w-full rounded-lg text-caption font-semibold transition-all duration-150',
              'border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              isCurrent
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : isAnswered
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30',
            )}
          >
            {i + 1}
            {isReview && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-warning flex items-center justify-center">
                <Flag className="h-2 w-2 text-warning-foreground" />
              </span>
            )}
            {isHighConf && !isReview && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-success flex items-center justify-center">
                <Zap className="h-2 w-2 text-success-foreground" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
