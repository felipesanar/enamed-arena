import { useState, useMemo } from "react";
import type { NotebookEntry } from "../mockEntries";
import type { ErrorTypeKey } from "../errorTypes";

export interface UseNotebookEntriesReturn {
  entries: NotebookEntry[];
  filtered: NotebookEntry[];
  pending: NotebookEntry[];
  resolved: NotebookEntry[];
  heroEntry: NotebookEntry | null;
  activeTypeFilter: ErrorTypeKey | "all";
  activeSpecFilter: string | null;
  setTypeFilter: (t: ErrorTypeKey | "all") => void;
  setSpecFilter: (s: string | null) => void;
  markResolved: (id: string) => void;
  remove: (id: string) => void;
}

export function useNotebookEntries(
  initial: NotebookEntry[]
): UseNotebookEntriesReturn {
  const [entries, setEntries] = useState<NotebookEntry[]>(initial);
  const [activeTypeFilter, setActiveTypeFilter] = useState<ErrorTypeKey | "all">("all");
  const [activeSpecFilter, setActiveSpecFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (activeTypeFilter !== "all" && e.errorType !== activeTypeFilter) return false;
      if (activeSpecFilter !== null && e.area !== activeSpecFilter) return false;
      return true;
    });
  }, [entries, activeTypeFilter, activeSpecFilter]);

  const pending = useMemo(
    () =>
      filtered
        .filter((e) => e.resolvedAt === null)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [filtered]
  );

  const resolved = useMemo(
    () => filtered.filter((e) => e.resolvedAt !== null),
    [filtered]
  );

  const heroEntry = pending.length > 0 ? pending[0] : null;

  function markResolved(id: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, resolvedAt: new Date().toISOString() } : e
      )
    );
  }

  function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return {
    entries,
    filtered,
    pending,
    resolved,
    heroEntry,
    activeTypeFilter,
    activeSpecFilter,
    setTypeFilter: setActiveTypeFilter,
    setSpecFilter: setActiveSpecFilter,
    markResolved,
    remove,
  };
}
