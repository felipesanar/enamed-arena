import { formatTimer, getTimerColor, getTimerBgClass } from '@/hooks/useExamTimer';
import { cn } from '@/lib/utils';
import { Clock, Save, Keyboard } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ExamHeaderProps {
  title: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  onFinalize: () => void;
}

export function ExamHeader({
  title, currentQuestion, totalQuestions, timeRemaining, onFinalize,
}: ExamHeaderProps) {
  const progress = (currentQuestion / totalQuestions) * 100;

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        {/* Left: title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 hidden sm:block">
            <p className="text-body font-semibold text-foreground truncate">{title}</p>
          </div>
        </div>

        {/* Center: progress */}
        <div className="flex items-center gap-2">
          <span className="text-caption text-muted-foreground whitespace-nowrap">
            {currentQuestion}/{totalQuestions}
          </span>
          <div className="w-20 md:w-36 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Right: shortcuts + timer + finalize */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Keyboard shortcuts tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Keyboard className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">Atalhos de Teclado</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">1-5</kbd> Alternativas</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">← →</kbd> Navegação</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">R</kbd> Revisar</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">H</kbd> Alta certeza</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> Finalizar</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Auto-save indicator */}
          <div className="hidden sm:flex items-center gap-1 text-caption text-muted-foreground">
            <Save className="h-3 w-3" />
          </div>

          {/* Timer */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-body font-semibold',
              getTimerBgClass(timeRemaining),
              getTimerColor(timeRemaining),
              timeRemaining < 60 && 'animate-pulse',
            )}
          >
            <Clock className="h-4 w-4" />
            {formatTimer(timeRemaining)}
          </div>

          {/* Finalize button */}
          <button
            onClick={onFinalize}
            className="px-3 md:px-4 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-body-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            Finalizar
          </button>
        </div>
      </div>
    </header>
  );
}
