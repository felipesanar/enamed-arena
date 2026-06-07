/**
 * AnotacoesSourceForm — fonte "Anotações" (modo text).
 * O usuário cola um texto livre OU escolhe uma anotação salva (body_md).
 * Emite BatchGenerateInput modo 'text' (ou null) via onChange.
 */
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { DEFAULT_COUNT, MAX_TOPIC_COUNT, clampCount, type BatchGenerateInput } from '@/lib/bulkFlashcards';
import type { UserNote } from '@/types/caderno';

const COUNT_OPTIONS = [5, 10, 15];

interface AnotacoesSourceFormProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function AnotacoesSourceForm({ onChange }: AnotacoesSourceFormProps) {
  const [mode, setMode] = useState<'paste' | 'note'>('paste');
  const [text, setText] = useState('');
  const [noteId, setNoteId] = useState<string>('');
  const [count, setCount] = useState<number>(DEFAULT_COUNT);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['caderno', 'notes', 'bulk-picker'],
    queryFn: () => simuladosApi.listNotes(),
  });

  const selectedNote = (notes as UserNote[]).find((n) => n.id === noteId);
  const rawText = mode === 'paste' ? text.trim() : (selectedNote?.body_md?.trim() ?? '');

  useEffect(() => {
    onChange(rawText
      ? { mode: 'text', rawText, count: clampCount(count, MAX_TOPIC_COUNT) }
      : null);
  }, [rawText, count, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button" onClick={() => setMode('paste')}
          className={cn(
            'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold transition-colors',
            mode === 'paste' ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]' : 'border-[var(--c-border)] text-[var(--c-muted)]',
          )}
        >
          Colar texto
        </button>
        <button
          type="button" onClick={() => setMode('note')}
          className={cn(
            'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold transition-colors',
            mode === 'note' ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]' : 'border-[var(--c-border)] text-[var(--c-muted)]',
          )}
        >
          Usar anotação salva
        </button>
      </div>

      {mode === 'paste' ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Cole aqui seu resumo ou anotação… o Prof. San fatia em flashcards."
          aria-label="Texto para gerar flashcards"
          className="w-full resize-none rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-wine-400)]"
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>
      ) : (notes as UserNote[]).length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--c-muted)]">Você ainda não tem anotações salvas.</p>
      ) : (
        <select
          aria-label="Anotação"
          value={noteId}
          onChange={(e) => setNoteId(e.target.value)}
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
        >
          <option value="">Selecione uma anotação…</option>
          {(notes as UserNote[]).map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
        </select>
      )}

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
