/**
 * Deadline-based timer — ported from SanarFlix Academy's useCronometro.
 * Uses absolute deadline instead of countdown, so it naturally survives page refresh.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseExamTimerProps {
  deadline: string | null; // ISO date
  onTimeUp: () => void;
  paused?: boolean;
}

export function useExamTimer({ deadline, onTimeUp, paused = false }: UseExamTimerProps) {
  const calcRemaining = useCallback((): number => {
    if (!deadline) return 0;
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  }, [deadline]);

  const [remaining, setRemaining] = useState(calcRemaining);
  const timeUpFiredRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (paused || !deadline) return;

    const tick = () => {
      const r = calcRemaining();
      setRemaining(r);
      if (r === 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        onTimeUpRef.current();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [paused, deadline, calcRemaining]);

  return remaining;
}

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function getTimerColor(seconds: number): string {
  if (seconds < 60) return 'text-destructive';
  if (seconds < 300) return 'text-warning';
  if (seconds < 900) return 'text-amber-600 dark:text-amber-400';
  return 'text-foreground';
}

export function getTimerBgClass(seconds: number): string {
  if (seconds < 60) return 'bg-destructive/10';
  if (seconds < 300) return 'bg-warning/10';
  if (seconds < 900) return 'bg-amber-50 dark:bg-amber-950/20';
  return 'bg-muted';
}
