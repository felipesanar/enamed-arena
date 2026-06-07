/**
 * FavoritesSourcePicker — fonte "Favoritas" (modo questions).
 * Carrega as questões favoritas, resolve o enunciado de cada uma (agrupando por
 * simulado), deixa selecionar e gera 1 card por favorita.
 * Favoritas sem simulado_id não podem ter o enunciado carregado e são omitidas.
 * Emite BatchGenerateInput modo 'questions' via onChange.
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { simuladosApi } from '@/services/simuladosApi';
import { buildQuestionsInput, MAX_QUESTIONS, type BatchGenerateInput } from '@/lib/bulkFlashcards';
import type { Question } from '@/types';
import type { QuestionFavorite } from '@/types/caderno';

interface ResolvedFavorite {
  favoriteId: string;
  question: Question;
  area: string | null;
  theme: string | null;
}

interface FavoritesSourcePickerProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function FavoritesSourcePicker({ onChange }: FavoritesSourcePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['flashcards', 'favorites-resolved', 'bulk-picker'],
    queryFn: async () => {
      const favorites = (await simuladosApi.listFavorites()) as QuestionFavorite[];
      const withSimulado = favorites.filter((f) => !!f.simulado_id);
      const skipped = favorites.length - withSimulado.length;
      if (skipped > 0) logger.log('[FavoritesSourcePicker] favoritas sem simulado omitidas:', skipped);

      const simuladoIds = Array.from(new Set(withSimulado.map((f) => f.simulado_id as string)));
      const questionLists = await Promise.all(
        simuladoIds.map((id) => simuladosApi.getQuestions(id, true)),
      );
      const byId = new Map<string, Question>();
      for (const list of questionLists) for (const q of list as Question[]) byId.set(q.id, q);

      const resolved: ResolvedFavorite[] = [];
      for (const f of withSimulado) {
        const q = byId.get(f.question_id);
        if (q) resolved.push({ favoriteId: f.id, question: q, area: f.area, theme: f.theme });
      }
      // Favoritas com simulado mas cuja questão não foi encontrada (ex.: removida
      // ou além do limite de carga) também ficam indisponíveis — contamos juntas.
      const notFound = withSimulado.length - resolved.length;
      if (notFound > 0) logger.log('[FavoritesSourcePicker] favoritas com questão não encontrada:', notFound);
      return { resolved, unavailable: skipped + notFound };
    },
  });

  const resolved = useMemo(() => data?.resolved ?? [], [data]);
  const unavailable = data?.unavailable ?? 0;
  const atCap = selected.size >= MAX_QUESTIONS;

  const selectedItems = useMemo(
    () => resolved.filter((r) => selected.has(r.favoriteId)),
    [resolved, selected],
  );

  useEffect(() => {
    onChange(selectedItems.length > 0
      ? buildQuestionsInput(selectedItems.map((r) => ({ q: r.question, area: r.area, theme: r.theme })))
      : null);
  }, [selectedItems, onChange]);

  const toggle = (favId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(favId)) next.delete(favId);
      else if (next.size < MAX_QUESTIONS) next.add(favId);
      return next;
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>;
  }
  if (resolved.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[var(--c-muted)]">Você ainda não tem questões favoritas (com simulado) para usar.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Selecione as favoritas</span>
        <span className={cn('text-[11px] font-semibold', atCap ? 'text-amber-600' : 'text-[var(--c-muted)]')}>{selected.size}/{MAX_QUESTIONS}</span>
      </div>

      <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
        {resolved.map((r) => {
          const checked = selected.has(r.favoriteId);
          const disabled = !checked && atCap;
          return (
            <button
              key={r.favoriteId} type="button" disabled={disabled} onClick={() => toggle(r.favoriteId)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-40',
                checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)]' : 'border-[var(--c-border)] hover:border-[var(--c-wine-300)]',
              )}
            >
              <span className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-500)] text-white' : 'border-[var(--c-muted-2)]',
              )}>
                {checked && <span className="text-[10px] leading-none">✓</span>}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-[var(--c-ink)] line-clamp-2">{r.question.text}</span>
                {(r.area || r.theme) && (
                  <span className="mt-0.5 block text-[11px] text-[var(--c-muted)]">{[r.area, r.theme].filter(Boolean).join(' · ')}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {unavailable > 0 && (
        <p className="text-[11px] text-[var(--c-muted-2)]">{unavailable} favorita{unavailable === 1 ? '' : 's'} não pôde{unavailable === 1 ? '' : 'ram'} ser carregada{unavailable === 1 ? '' : 's'}.</p>
      )}
    </div>
  );
}
