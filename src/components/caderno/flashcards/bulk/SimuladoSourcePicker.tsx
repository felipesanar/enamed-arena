/**
 * SimuladoSourcePicker — fonte "Simulado concluído" (modo questions).
 * Lista attempts finalizados; ao escolher um, carrega as questões erradas
 * (is_correct=false) com enunciado e gera 1 card por questão.
 * Emite BatchGenerateInput modo 'questions' via onChange.
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { useUser } from '@/contexts/UserContext';
import { buildQuestionsInput, MAX_QUESTIONS, type BatchGenerateInput } from '@/lib/bulkFlashcards';
import type { Question } from '@/types';

interface SimuladoSourcePickerProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function SimuladoSourcePicker({ onChange }: SimuladoSourcePickerProps) {
  const { profile } = useUser();
  const userId = profile?.id;
  const [attemptId, setAttemptId] = useState<string>('');
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  const { data: attempts = [], isLoading: loadingAttempts } = useQuery({
    queryKey: ['flashcards', 'finished-attempts', userId],
    queryFn: async () => {
      const rows = await simuladosApi.getUserAttempts(userId!, 'online', 200);
      const finished = rows.filter((a: any) => !!a.finished_at);
      const ids = Array.from(new Set(finished.map((a: any) => a.simulado_id)));
      const sims = await Promise.all(ids.map((id) => simuladosApi.getSimulado(id as string)));
      const titleById = new Map(ids.map((id, i) => [id, sims[i]?.title ?? 'Simulado']));
      return finished.map((a: any) => ({
        id: a.id as string,
        simuladoId: a.simulado_id as string,
        title: titleById.get(a.simulado_id) as string,
        score: a.score_percentage as number | null,
        finishedAt: a.finished_at as string,
      }));
    },
    enabled: !!userId,
  });

  const chosen = (attempts as any[]).find((a) => a.id === attemptId) ?? null;

  const { data: wrongQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['flashcards', 'attempt-wrong-questions', attemptId],
    queryFn: async () => {
      const [results, questions] = await Promise.all([
        simuladosApi.getAttemptQuestionResults(chosen!.id),
        simuladosApi.getQuestions(chosen!.simuladoId, true),
      ]);
      const wrongIds = new Set(
        (results as any[]).filter((r) => r.is_correct === false).map((r) => r.question_id),
      );
      return (questions as Question[]).filter((q) => wrongIds.has(q.id));
    },
    enabled: !!chosen,
  });

  const selectedQuestions = useMemo(
    () => (wrongQuestions as Question[]).filter((q) => !deselected.has(q.id)).slice(0, MAX_QUESTIONS),
    [wrongQuestions, deselected],
  );

  useEffect(() => {
    onChange(selectedQuestions.length > 0
      ? buildQuestionsInput(selectedQuestions.map((q) => ({ q })))
      : null);
  }, [selectedQuestions, onChange]);

  const toggle = (id: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loadingAttempts) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>;
  }
  if ((attempts as any[]).length === 0) {
    return <p className="py-8 text-center text-[13px] text-[var(--c-muted)]">Você ainda não concluiu nenhum simulado.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Simulado concluído</span>
        <select
          aria-label="Simulado concluído"
          value={attemptId}
          onChange={(e) => { setAttemptId(e.target.value); setDeselected(new Set()); }}
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
        >
          <option value="">Selecione…</option>
          {(attempts as any[]).map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}{a.score != null ? ` — ${Math.round(a.score)}%` : ''}
            </option>
          ))}
        </select>
      </div>

      {chosen && (
        loadingQuestions ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>
        ) : (wrongQuestions as Question[]).length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--c-muted)]">Nenhuma questão errada neste simulado. 🎉</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Questões erradas</span>
              <span className="text-[11px] font-semibold text-[var(--c-muted)]">{selectedQuestions.length} selecionada{selectedQuestions.length === 1 ? '' : 's'}</span>
            </div>
            <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
              {(wrongQuestions as Question[]).map((q) => {
                const checked = !deselected.has(q.id);
                return (
                  <button
                    key={q.id} type="button" onClick={() => toggle(q.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
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
                      <span className="block text-[12.5px] font-medium text-[var(--c-ink)] line-clamp-2">{q.text}</span>
                      <span className="mt-0.5 block text-[11px] text-[var(--c-muted)]">{[q.area, q.theme].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {(wrongQuestions as Question[]).length > MAX_QUESTIONS && (
              <p className="text-[11px] text-amber-600">Serão usadas as primeiras {MAX_QUESTIONS} questões selecionadas.</p>
            )}
          </div>
        )
      )}
    </div>
  );
}
