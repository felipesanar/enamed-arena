import { formatTimer, getTimerColor, getTimerBgClass } from '@/hooks/useExamTimer';
import { cn } from '@/lib/utils';
import { Clock, Check, Keyboard } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ExamHeaderProps {
  title: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  onFinalize: () => void;
  saving?: boolean;
}

export function ExamHeader({
  title, currentQuestion, totalQuestions, timeRemaining, onFinalize, saving = false,
}: ExamHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-[hsl(var(--exam-border))]"
      style={{ backgroundColor: 'hsl(var(--exam-header-bg))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 hidden sm:flex items-center gap-2">
            <p className="text-body font-semibold text-foreground truncate max-w-[200px] lg:max-w-none">{title}</p>
            <span className={cn(
              'flex items-center gap-1 text-[10px] transition-opacity duration-300',
              saving ? 'text-primary opacity-100' : 'text-muted-foreground/50 opacity-100',
            )}>
              <Check className={cn('h-3 w-3', saving && 'animate-pulse')} />
              {saving ? 'Salvando' : 'Salvo'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-body-sm font-semibold text-foreground tabular-nums">
            {currentQuestion}
          </span>
          <span className="text-caption text-muted-foreground">/</span>
          <span className="text-body-sm text-muted-foreground tabular-nums">
            {totalQuestions}
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Ver atalhos de teclado"
                  className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Keyboard className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">Atalhos de Teclado</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">1-5</kbd> Alternativas</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">← →</kbd> Navegação</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">R</kbd> Marcar p/ revisar</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">H</kbd> Alta certeza</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> Finalizar</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div
            role="timer"
            aria-label={`Tempo restante: ${formatTimer(timeRemaining)}`}
            aria-live={timeRemaining < 120 ? 'polite' : 'off'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-body tabular-nums font-semibold transition-colors duration-500',
              getTimerBgClass(timeRemaining),
              getTimerColor(timeRemaining),
            )}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {formatTimer(timeRemaining)}
          </div>

          <button
            type="button"
            onClick={onFinalize}
            className="px-3 md:px-4 py-1.5 rounded-lg border border-primary/35 bg-primary/10 text-body font-semibold text-primary hover:bg-primary/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Finalizar
          </button>
        </div>
      </div>
    </header>
  );
}
