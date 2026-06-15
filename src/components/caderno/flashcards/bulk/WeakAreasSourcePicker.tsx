/**
 * WeakAreasSourcePicker — fonte "Pontos fracos" (modo topic).
 * Ranqueia os temas mais fracos do Caderno de Erros (rankWeakThemes) e deixa
 * o usuário escolher um; emite BatchGenerateInput modo 'topic' via onChange.
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { useUser } from '@/contexts/UserContext';
import { rankWeakThemes } from '@/lib/weakAreas';
import {
  buildTopicInput, mapErrorRowsToWeakEntries, DEFAULT_COUNT,
  type BatchGenerateInput, type ErrorNotebookWeakRow,
} from '@/lib/bulkFlashcards';

const COUNT_OPTIONS = [5, 10, 15];

interface WeakAreasSourcePickerProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function WeakAreasSourcePicker({ onChange }: WeakAreasSourcePickerProps) {
  const { profile } = useUser();
  const userId = profile?.id;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [count, setCount] = useState<number>(DEFAULT_COUNT);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['caderno', 'weak-areas', 'bulk-picker', userId],
    queryFn: () => simuladosApi.getErrorNotebook(userId!),
    enabled: !!userId,
  });

  const ranked = useMemo(
    () => rankWeakThemes(mapErrorRowsToWeakEntries(rows as ErrorNotebookWeakRow[])),
    [rows],
  );

  const selected = ranked.find((r) => `${r.area}|${r.theme}` === selectedKey) ?? null;

  useEffect(() => {
    onChange(selected ? buildTopicInput(selected.area, selected.theme, count) : null);
  }, [selected, count, onChange]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>;
  }
  if (ranked.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[var(--c-muted)]">Sem pontos fracos suficientes ainda. Marque mais questões no Caderno de Erros.</p>;
  }

  return (
    <div className="space-y-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Seu ponto fraco</span>
      <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
        {ranked.map((r) => {
          const key = `${r.area}|${r.theme}`;
          const active = key === selectedKey;
          return (
            <button
              key={key} type="button" onClick={() => setSelectedKey(key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                active ? 'border-[var(--c-wine-500)] bg-[var(--c-soft-wine-bg)]' : 'border-[var(--c-border)] hover:border-[var(--c-wine-300)] hover:bg-[var(--c-soft-wine-bg)]',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <TrendingDown className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-[var(--c-ink)] truncate">{r.theme}</span>
                <span className="block text-[11px] text-[var(--c-muted)]">{r.area} · {r.pending} pendente{r.pending === 1 ? '' : 's'}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Quantidade</span>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n} type="button" onClick={() => setCount(n)}
              className={cn(
                'flex-1 rounded-[var(--c-radius-control)] border py-2 text-[13px] font-bold transition-colors',
                count === n ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]' : 'border-[var(--c-border)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)]',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
