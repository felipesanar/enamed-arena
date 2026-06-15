/**
 * CadernoSourcePicker — fonte "Caderno de erros": lista entradas com checkbox.
 * Carrega via simuladosApi.getErrorNotebook e normaliza a seleção num
 * BatchGenerateInput modo 'questions' (1 card por questão) via onChange.
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { useUser } from '@/contexts/UserContext';
import {
  buildCadernoQuestionsInput, MAX_QUESTIONS,
  type BatchGenerateInput, type CadernoRow,
} from '@/lib/bulkFlashcards';

interface CadernoSourcePickerProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function CadernoSourcePicker({ onChange }: CadernoSourcePickerProps) {
  const { profile } = useUser();
  const userId = profile?.id;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['caderno', 'entries', 'bulk-picker', userId],
    queryFn: () => simuladosApi.getErrorNotebook(userId!),
    enabled: !!userId,
  });

  const entries = rows as CadernoRow[];

  useEffect(() => {
    if (selected.size === 0) { onChange(null); return; }
    onChange(buildCadernoQuestionsInput(entries, selected));
  }, [selected, entries, onChange]);

  const atCap = selected.size >= MAX_QUESTIONS;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_QUESTIONS) next.add(id);
      return next;
    });
  };

  const visible = useMemo(() => entries.filter((e) => e.question_text?.trim()), [entries]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>;
  }
  if (visible.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[var(--c-muted)]">Nenhuma questão no seu Caderno de Erros ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
          Selecione as questões
        </span>
        <span className={cn('text-[11px] font-semibold', atCap ? 'text-amber-600' : 'text-[var(--c-muted)]')}>
          {selected.size}/{MAX_QUESTIONS}
        </span>
      </div>

      <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
        {visible.map((e) => {
          const checked = selected.has(e.id);
          const disabled = !checked && atCap;
          return (
            <button
              key={e.id} type="button" disabled={disabled} onClick={() => toggle(e.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-40',
                checked ? 'border-[var(--c-wine-500)] bg-[var(--c-soft-wine-bg)]' : 'border-[var(--c-border)] hover:border-[var(--c-wine-300)] hover:bg-[var(--c-soft-wine-bg)]',
              )}
            >
              <span className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-500)] text-white' : 'border-[var(--c-muted-2)]',
              )}>
                {checked && <span className="text-[10px] leading-none">✓</span>}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-[var(--c-ink)] line-clamp-2">
                  {e.question_text}
                </span>
                {(e.area || e.theme) && (
                  <span className="mt-0.5 block text-[11px] text-[var(--c-muted)]">
                    {[e.area, e.theme].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
