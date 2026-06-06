/**
 * DrillTimerBar — Cronômetro compacto da sessão de treino cronometrado.
 *
 * Desktop: exibição completa com pace e média/q.
 * Mobile: compacto (só tempo + barra), encaixa na topbar.
 *
 * NÃO força avanço de questão — é pressão visual, sem punição.
 * Respeita prefers-reduced-motion.
 */

import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Timer, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECONDS_PER_QUESTION = 180;

export interface DrillTimerBarProps {
  startedAt: number;
  totalQuestions: number;
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
  const idealElapsed = questionsAnswered * SECONDS_PER_QUESTION;
  const avgPerQuestion = questionsAnswered > 0 ? elapsed / questionsAnswered : 0;
  const progressPct = targetTotal > 0 ? Math.min(100, (elapsed / targetTotal) * 100) : 0;
  const onPace = elapsed <= idealElapsed + SECONDS_PER_QUESTION * 0.5;
  const behindBy = elapsed - idealElapsed;
  const isOverTarget = elapsed > targetTotal;

  const paceLabel =
    questionsAnswered === 0
      ? null
      : onPace
      ? 'No prazo'
      : `Atrasado ${formatElapsed(Math.max(0, behindBy))}`;

  const stateColor = isOverTarget
    ? 'text-destructive'
    : onPace || questionsAnswered === 0
    ? 'text-emerald-500'
    : 'text-amber-500';

  const barColor = isOverTarget
    ? '#DC2626'
    : onPace || questionsAnswered === 0
    ? '#16A34A'
    : '#F59E0B';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[var(--c-radius-control)] border px-3.5 py-2',
        'backdrop-blur-sm',
        isOverTarget
          ? 'border-destructive/25 bg-destructive/[0.06]'
          : onPace || questionsAnswered === 0
          ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
          : 'border-amber-500/20 bg-amber-500/[0.05]',
      )}
      role="status"
      aria-live="off"
      aria-label={`Cronômetro do treino: ${formatElapsed(elapsed)} decorridos de ${formatTarget(targetTotal)} alvo`}
    >
      <Timer className={cn('h-3.5 w-3.5 shrink-0', stateColor)} aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn('text-[14px] font-extrabold tabular-nums leading-none tracking-[-0.02em]', stateColor)}>
            {formatElapsed(elapsed)}
          </span>
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70 tabular-nums">
            alvo {formatTarget(targetTotal)}
          </span>
        </div>

        <div className="h-[3px] overflow-hidden rounded-full bg-[var(--c-surface-2)]" aria-hidden>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'linear' }}
          />
        </div>
      </div>

      {paceLabel && (
        <div
          className={cn(
            'hidden shrink-0 items-center gap-1 text-[11px] font-semibold sm:flex',
            isOverTarget || !onPace ? 'text-amber-500' : 'text-emerald-500',
          )}
          aria-label={paceLabel}
        >
          {onPace ? (
            <TrendingUp className="h-3 w-3" aria-hidden />
          ) : (
            <TrendingDown className="h-3 w-3" aria-hidden />
          )}
          <span className="hidden md:inline">{paceLabel}</span>
        </div>
      )}

      {questionsAnswered > 0 && (
        <div className="hidden shrink-0 text-right lg:block">
          <div className="text-[11px] tabular-nums text-muted-foreground">
            {formatElapsed(Math.round(avgPerQuestion))}/q
          </div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground/60">média</div>
        </div>
      )}
    </div>
  );
}
