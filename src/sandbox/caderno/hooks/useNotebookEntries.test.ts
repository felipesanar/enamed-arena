import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotebookEntries } from "./useNotebookEntries";
import { MOCK_ENTRIES } from "../mockEntries";

describe("useNotebookEntries", () => {
  it("initialises with all entries", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    expect(result.current.entries).toHaveLength(12);
  });

  it("filtered returns all when typeFilter=all and specFilter=null", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    expect(result.current.filtered).toHaveLength(12);
  });

  it("pending contains only unresolved entries", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    expect(result.current.pending.every((e) => e.resolvedAt === null)).toBe(true);
    expect(result.current.pending).toHaveLength(8);
  });

  it("resolved contains only resolved entries", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    expect(result.current.resolved.every((e) => e.resolvedAt !== null)).toBe(true);
    expect(result.current.resolved).toHaveLength(4);
  });

  it("heroEntry is the oldest pending entry (min createdAt)", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    const hero = result.current.heroEntry;
    expect(hero).not.toBeNull();
    expect(hero!.id).toBe("e1"); // oldest pending
  });

  it("setTypeFilter filters by error type", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.setTypeFilter("lacuna"));
    expect(result.current.filtered.every((e) => e.errorType === "lacuna")).toBe(true);
  });

  it("setSpecFilter filters by area", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.setSpecFilter("Cardiologia"));
    expect(result.current.filtered.every((e) => e.area === "Cardiologia")).toBe(true);
  });

  it("markResolved sets resolvedAt and moves entry to resolved", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.markResolved("e1"));
    const entry = result.current.entries.find((e) => e.id === "e1");
    expect(entry!.resolvedAt).not.toBeNull();
    expect(result.current.resolved.some((e) => e.id === "e1")).toBe(true);
    expect(result.current.pending.some((e) => e.id === "e1")).toBe(false);
  });

  it("heroEntry updates after markResolved", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.markResolved("e1"));
    expect(result.current.heroEntry!.id).toBe("e2");
  });

  it("remove deletes the entry from all lists", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.remove("e1"));
    expect(result.current.entries.some((e) => e.id === "e1")).toBe(false);
  });

  it("heroEntry is null when no pending entries match filter", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    // atencao has only 1 pending entry (e6), filter it out via spec
    act(() => result.current.setTypeFilter("atencao"));
    act(() => result.current.setSpecFilter("Cardiologia")); // e6 is Infectologia
    expect(result.current.heroEntry).toBeNull();
  });
});
