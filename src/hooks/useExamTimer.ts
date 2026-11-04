/**
 * Deadline-based timer — ported from SanarFlix Academy's useCronometro.
 * Uses absolute deadline instead of countdown, so it naturally survives page refresh.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseExamTimerProps {
  deadline: string | null; // ISO date
  onTimeUp: () => void;
  paused?: boolean;
  attemptKey?: string; // Different attempts may share the same deadline.
  now?: () => number;
  clockReady?: boolean;
  allowTimeUp?: boolean | (() => boolean);
  /** Explicit cancellation of an unstarted expiry; legacy callers remain once-per-key. */
  rearmTimeUp?: () => boolean;
}

export function useExamTimer({ deadline, onTimeUp, paused = false, attemptKey, now = Date.now, clockReady = true, allowTimeUp = true, rearmTimeUp }: UseExamTimerProps) {
  const calcRemaining = useCallback((): number => {
    if (!deadline) return 0;
    const diff = new Date(deadline).getTime() - now();
    if (!Number.isFinite(diff)) return NaN;
    return Math.max(0, Math.floor(diff / 1000));
  }, [deadline, now]);

  const [remaining, setRemaining] = useState(calcRemaining);
  const firedKeysRef = useRef(new Set<string>());
  // Legacy callers without attemptKey retain the per-deadline contract.
  const key = attemptKey ?? deadline;
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;
  const allowTimeUpRef = useRef(allowTimeUp);
  allowTimeUpRef.current = allowTimeUp;
  const rearmTimeUpRef = useRef(rearmTimeUp);
  rearmTimeUpRef.current = rearmTimeUp;

  useEffect(() => {
    setRemaining(calcRemaining());
  }, [deadline, calcRemaining, attemptKey]);

  useEffect(() => {
    if (paused || !deadline || !clockReady || key === null) return;

    const tick = () => {
      const r = calcRemaining();
      setRemaining(r);
      if (rearmTimeUpRef.current?.()) firedKeysRef.current.delete(key);
      const allowed = typeof allowTimeUpRef.current === 'function' ? allowTimeUpRef.current() : allowTimeUpRef.current;
      // An estimated zero or lost ownership must not consume the owner's expiry.
      if (r === 0 && allowed && !firedKeysRef.current.has(key)) {
        firedKeysRef.current.add(key);
        onTimeUpRef.current();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [paused, deadline, calcRemaining, key, clockReady, allowTimeUp, rearmTimeUp]);

  return Number.isFinite(remaining) ? remaining : 0;
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
  if (seconds < 900) return 'text-foreground';
  return 'text-foreground/70';
}

export function getTimerBgClass(seconds: number): string {
  if (seconds < 60) return 'bg-destructive/8';
  if (seconds < 300) return 'bg-warning/8';
  if (seconds < 900) return 'bg-muted/50';
  return 'bg-transparent';
}

/** Pulso suave no último minuto — chama atenção sem alarmar antes da hora. */
export function getTimerPulseClass(seconds: number): string {
  return seconds > 0 && seconds < 60 ? 'animate-pulse' : '';
}
