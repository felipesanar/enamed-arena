import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExamAttempt } from '@/types/exam';
import { saveAttempt } from '@/lib/exam-persistence';

const AUTO_SAVE_INTERVAL = 15_000; // 15 seconds

interface UseExamTimerOptions {
  attempt: ExamAttempt;
  onTimeUp: () => void;
  onTick: (remaining: number) => void;
}

export function useExamTimer({ attempt, onTimeUp, onTick }: UseExamTimerOptions) {
  const [remaining, setRemaining] = useState(attempt.timeRemainingSeconds);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  useEffect(() => {
    if (attempt.status !== 'in_progress') return;

    const interval = setInterval(() => {
      setRemaining(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          clearInterval(interval);
          onTimeUp();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [attempt.status, onTimeUp]);

  // Sync remaining back to parent periodically
  useEffect(() => {
    const interval = setInterval(() => {
      onTick(remainingRef.current);
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [onTick]);

  return remaining;
}

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
