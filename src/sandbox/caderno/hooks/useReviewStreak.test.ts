import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReviewStreak } from "./useReviewStreak";
import type { NotebookEntry } from "../mockEntries";

function makeEntry(resolvedAt: string | null): NotebookEntry {
  return {
    id: Math.random().toString(),
    questionId: "q1",
    simuladoId: "s1",
    simuladoTitle: "S1",
    questionNumber: 1,
    questionText: "Q",
    area: "Cardiologia",
    theme: "T",
    errorType: "lacuna",
    note: null,
    createdAt: "2026-04-01T00:00:00Z",
    resolvedAt,
  };
}

describe("useReviewStreak", () => {
  it("returns 0 when no entries are resolved", () => {
    const entries = [makeEntry(null), makeEntry(null)];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(0);
  });

  it("returns 1 when only today has resolutions", () => {
    const today = new Date().toISOString();
    const entries = [makeEntry(today)];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const d = (daysAgo: number) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString();
    };
    // Resolved today, yesterday, 2 days ago → streak = 3
    const entries = [makeEntry(d(0)), makeEntry(d(1)), makeEntry(d(2))];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(3);
  });

  it("stops counting at a gap", () => {
    const d = (daysAgo: number) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString();
    };
    // Today + 2 days ago (gap on yesterday) → streak = 1
    const entries = [makeEntry(d(0)), makeEntry(d(2))];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(1);
  });

  it("returns 0 when most recent resolved day is not today or yesterday", () => {
    const d = (daysAgo: number) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString();
    };
    const entries = [makeEntry(d(3)), makeEntry(d(4))];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(0);
  });
});
