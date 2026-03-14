import { formatTimer } from '@/hooks/use-exam-timer';
import { cn } from '@/lib/utils';
import { Clock, Save } from 'lucide-react';

interface ExamHeaderProps {
  title: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  lastSaved: string;
  onExit: () => void;
}

export function ExamHeader({
  title, currentQuestion, totalQuestions, timeRemaining, lastSaved, onExit,
}: ExamHeaderProps) {
  const isLowTime = timeRemaining < 600; // less than 10 min
  const isCritical = timeRemaining < 120; // less than 2 min

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        {/* Left: title + progress */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onExit}
            className="text-caption text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ✕
          </button>
          <div className="min-w-0 hidden sm:block">
            <p className="text-body font-semibold text-foreground truncate">{title}</p>
          </div>
        </div>

        {/* Center: progress */}
        <div className="flex items-center gap-2">
          <span className="text-caption text-muted-foreground">
            {currentQuestion}/{totalQuestions}
          </span>
          <div className="w-24 md:w-40 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(currentQuestion / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Right: timer + auto-save */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-caption text-muted-foreground">
            <Save className="h-3 w-3" />
            <span>Salvo</span>
          </div>
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-body font-semibold',
              isCritical
                ? 'bg-destructive/10 text-destructive animate-pulse'
                : isLowTime
                  ? 'bg-warning/10 text-warning'
                  : 'bg-muted text-foreground',
            )}
          >
            <Clock className="h-4 w-4" />
            {formatTimer(timeRemaining)}
          </div>
        </div>
      </div>
    </header>
  );
}
