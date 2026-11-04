import { formatTimer, getTimerBgClass, getTimerPulseClass } from '@/hooks/useExamTimer';
import { cn } from '@/lib/utils';
import { Clock, Check, Keyboard } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExamTimerAnnouncement } from '@/components/exam/ExamTimerAnnouncement';

interface ExamHeaderProps {
  title: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  onFinalize: () => void;
  saving?: boolean;
  answeredCount?: number;
}

export function ExamHeader({
  title, currentQuestion, totalQuestions, timeRemaining, onFinalize, saving = false, answeredCount,
}: ExamHeaderProps) {
  const progressPct = answeredCount !== undefined && totalQuestions > 0
    ? Math.round((answeredCount / totalQuestions) * 100)
    : null;
  return (
    <header
      className="sticky top-0 z-40 border-b border-[hsl(var(--exam-border))]"
      style={{ backgroundColor: 'hsl(var(--exam-header-bg))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      {/* Mobile title strip — contexto do simulado visível em telas pequenas */}
      <div
        className="flex items-center justify-between gap-2 px-4 py-1.5 sm:hidden border-b border-[hsl(var(--exam-border))]/40"
      >
        <p className="flex-1 min-w-0 text-[13px] font-semibold text-foreground truncate">{title}</p>
        <span className={cn(
          'flex shrink-0 items-center gap-1 text-[10px] transition-opacity duration-300',
          saving ? 'text-primary opacity-100' : 'text-muted-foreground opacity-100',
        )}>
          <Check className={cn('h-3 w-3', saving && 'animate-pulse')} />
          {saving ? 'Salvando' : 'Salvo'}
        </span>
      </div>

      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 hidden sm:flex items-center gap-2">
            <p className="text-body font-semibold text-foreground truncate max-w-[200px] lg:max-w-none">{title}</p>
            <span className={cn(
              'flex items-center gap-1 text-[10px] transition-opacity duration-300',
              saving ? 'text-primary opacity-100' : 'text-muted-foreground opacity-100',
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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Ver atalhos de teclado"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Keyboard className="h-4 w-4" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-[calc(100vw-2rem)] w-80">
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">Atalhos de Teclado</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                    <span><kbd>1–5</kbd> Antes de responder: alternativas</span>
                    <span><kbd>1–3</kbd> Depois de responder: confiança baixa, média e alta</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">← →</kbd> Navegação</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">R</kbd> Marcar p/ revisar</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">H</kbd> Alta certeza</span>
                    <span><kbd>Esc</kbd> Abrir confirmação de finalização (pode sair da tela cheia)</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

          <div
            role="timer"
            aria-label={`Tempo restante: ${formatTimer(timeRemaining)}`}
            aria-live="off"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-body text-foreground tabular-nums font-semibold transition-colors duration-500 motion-reduce:animate-none',
              getTimerBgClass(timeRemaining),
            )}
          >
            <Clock className={cn('h-3.5 w-3.5 motion-reduce:animate-none', getTimerPulseClass(timeRemaining))} aria-hidden />
            {formatTimer(timeRemaining)}
          </div>
          <ExamTimerAnnouncement timeRemaining={timeRemaining} />

          <button
            type="button"
            onClick={onFinalize}
            className="min-h-11 px-3 md:px-4 py-1.5 rounded-lg border border-primary/35 bg-primary/10 text-body font-semibold text-foreground hover:bg-primary/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Finalizar
          </button>
        </div>
      </div>

      {/* Barra de progresso de respondidas — feedback contínuo sem ocupar espaço */}
      {progressPct !== null && (
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${answeredCount} de ${totalQuestions} questões respondidas`}
          className="h-[3px] w-full bg-[hsl(var(--exam-border))]/40"
        >
          <div
            className="h-full bg-primary/70 transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </header>
  );
}
