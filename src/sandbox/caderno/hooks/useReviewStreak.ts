import { useMemo } from "react";
import type { NotebookEntry } from "../mockEntries";

export interface UseReviewStreakReturn {
  streak: number;
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function todayKey(): string {
  return toDateKey(new Date().toISOString());
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d.toISOString());
}

export function useReviewStreak(entries: NotebookEntry[]): UseReviewStreakReturn {
  const streak = useMemo(() => {
    const resolvedDays = new Set(
      entries
        .filter((e) => e.resolvedAt !== null)
        .map((e) => toDateKey(e.resolvedAt!))
    );

    if (resolvedDays.size === 0) return 0;

    const today = todayKey();
    const yesterday = yesterdayKey();

    if (!resolvedDays.has(today) && !resolvedDays.has(yesterday)) return 0;

    const startDay = resolvedDays.has(today) ? today : yesterday;
    let count = 0;
    const current = new Date(startDay + "T12:00:00Z");

    while (resolvedDays.has(toDateKey(current.toISOString()))) {
      count++;
      current.setDate(current.getDate() - 1);
    }

    return count;
  }, [entries]);

  return { streak };
}
