/**
 * TopicSourceForm — fonte "Tema/área": área + tema (texto livre) + quantidade.
 * Reporta um BatchGenerateInput modo 'topic' (ou null se inválido) via onChange.
 */
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_COUNT, MAX_TOPIC_COUNT, clampCount, type BatchGenerateInput } from '@/lib/bulkFlashcards';

const COUNT_OPTIONS = [5, 10, 15];

interface TopicSourceFormProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function TopicSourceForm({ onChange }: TopicSourceFormProps) {
  const [area, setArea] = useState('');
  const [theme, setTheme] = useState('');
  const [count, setCount] = useState<number>(DEFAULT_COUNT);

  useEffect(() => {
    const valid = !!(area.trim() || theme.trim());
    onChange(valid
      ? { mode: 'topic', area: area.trim() || null, theme: theme.trim() || null, count: clampCount(count, MAX_TOPIC_COUNT) }
      : null);
  }, [area, theme, count, onChange]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="bulk-area" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Área</label>
          <input
            id="bulk-area" type="text" value={area} onChange={(e) => setArea(e.target.value)}
            placeholder="Ex: Cardiologia"
            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="bulk-theme" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Tema</label>
          <input
            id="bulk-theme" type="text" value={theme} onChange={(e) => setTheme(e.target.value)}
            placeholder="Ex: Insuficiência Cardíaca"
            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Quantidade</span>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n} type="button" onClick={() => setCount(n)}
              className={cn(
                'flex-1 rounded-[var(--c-radius-control)] border py-2 text-[13px] font-bold transition-colors',
                count === n
                  ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]'
                  : 'border-[var(--c-border)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)]',
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
