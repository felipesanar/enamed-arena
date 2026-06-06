/**
 * DrillTimerBar — Cronômetro da sessão de treino cronometrado.
 *
 * Exibe:
 *   - Tempo total decorrido (conta para cima, hh:mm:ss)
 *   - Alvo total (~3 min × nº de questões)
 *   - Tempo médio por questão já revisada (questionsAnswered)
 *   - Indicador de ritmo: "No prazo" / "Atrasado" comparando tempo médio vs 3 min
 *
 * NÃO força avanço de questão — é pressão visual, sem punição.
 * Respeita prefers-reduced-motion para animações da barra de progresso.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Timer, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Ritmo alvo: 3 minutos por questão (180 segundos)
const SECONDS_PER_QUESTION = 180;

export interface DrillTimerBarProps {
  /** ISO timestamp when the session started (captured once on mount) */
  startedAt: number;
  /** Total number of questions in the drill queue */
  totalQuestions: number;
  /** How many questions the student has already answered (advanced past) */
  questionsAnswered: number;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatTarget(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  return `${m} min`;
}

export function DrillTimerBar({
  startedAt,
  totalQuestions,
  questionsAnswered,
}: DrillTimerBarProps) {
  const prefersReducedMotion = useReducedMotion();

  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const targetTotal = totalQuestions * SECONDS_PER_QUESTION;
  // Ideal elapsed given how many questions have been answered
  const idealElapsed = questionsAnswered * SECONDS_PER_QUESTION;
  // If no questions answered yet, no pace info
  const avgPerQuestion = questionsAnswered > 0 ? elapsed / questionsAnswered : 0;

  // Progress: capped at 100% visually
  const progressPct = targetTotal > 0 ? Math.min(100, (elapsed / targetTotal) * 100) : 0;

  // Pace status
  const onPace = elapsed <= idealElapsed + SECONDS_PER_QUESTION * 0.5;
  const behindBy = elapsed - idealElapsed; // positive = behind, negative = ahead

  const paceLabel = questionsAnswered === 0
    ? null
    : onPace
    ? 'No prazo'
    : `Atrasado ${formatElapsed(Math.max(0, behindBy))}`;

  const isOverTarget = elapsed > targetTotal;

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-2.5 flex items-center gap-3',
        isOverTarget
          ? 'border-destructive/30 bg-destructive/[0.06]'
          : onPace || questionsAnswered === 0
          ? 'border-success/25 bg-success/[0.05]'
          : 'border-warning/30 bg-warning/[0.06]',
      )}
      role="status"
      aria-live="off"
      aria-label={`Cronômetro do treino: ${formatElapsed(elapsed)} decorridos de ${formatTarget(targetTotal)} alvo`}
    >
      {/* Icon */}
      <Timer
        className={cn(
          'h-4 w-4 shrink-0',
          isOverTarget
            ? 'text-destructive'
            : onPace || questionsAnswered === 0
            ? 'text-success'
            : 'text-warning',
        )}
        aria-hidden
      />

      {/* Elapsed + target */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'text-[15px] font-extrabold tabular-nums leading-none tracking-[-0.02em]',
              isOverTarget
                ? 'text-destructive'
                : onPace || questionsAnswered === 0
                ? 'text-success'
                : 'text-warning',
            )}
          >
            {formatElapsed(elapsed)}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            alvo {formatTarget(targetTotal)}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="mt-1.5 h-[4px] overflow-hidden rounded-full bg-muted/50"
          aria-hidden
        >
          <motion.div
            className={cn(
              'h-full rounded-full',
              isOverTarget
                ? 'bg-destructive'
                : onPace || questionsAnswered === 0
                ? 'bg-success'
                : 'bg-warning',
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Pace indicator */}
      {paceLabel && (
        <div
          className={cn(
            'shrink-0 flex items-center gap-1 text-[11px] font-semibold',
            isOverTarget || !onPace ? 'text-warning' : 'text-success',
          )}
          aria-label={paceLabel}
        >
          {onPace ? (
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" aria-hidden />
          )}
          <span className="hidden sm:inline">{paceLabel}</span>
        </div>
      )}

      {/* Avg per question */}
      {questionsAnswered > 0 && (
        <div className="shrink-0 text-right hidden md:block">
          <div className="text-[11px] tabular-nums text-muted-foreground">
            {formatElapsed(Math.round(avgPerQuestion))}/q
          </div>
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wide">
            média
          </div>
        </div>
      )}
    </div>
  );
}
