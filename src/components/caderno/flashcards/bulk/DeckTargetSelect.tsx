/**
 * DeckTargetSelect — escolhe um deck existente OU cria um novo (nome pré-preenchido).
 * Reporta a escolha via onChange: { deckId } para existente ou { newName } para novo.
 */
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Deck } from '@/types/caderno';

export interface DeckTarget {
  deckId: string | null;
  newName: string | null;
}

interface DeckTargetSelectProps {
  decks: Deck[];
  suggestedName: string;
  value: DeckTarget;
  onChange: (t: DeckTarget) => void;
}

export function DeckTargetSelect({ decks, suggestedName, value, onChange }: DeckTargetSelectProps) {
  const [mode, setMode] = useState<'existing' | 'new'>(decks.length > 0 ? 'existing' : 'new');
  const [edited, setEdited] = useState(false);

  // Enquanto em "novo deck" e o usuário não editou o nome manualmente,
  // mantém o nome sugerido sincronizado com a fonte (área/tema/seleção).
  useEffect(() => {
    if (mode === 'new' && !edited) {
      onChange({ deckId: null, newName: suggestedName });
    }
  }, [mode, edited, suggestedName, onChange]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
        Salvar em
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={decks.length === 0}
          onClick={() => { setMode('existing'); onChange({ deckId: decks[0]?.id ?? null, newName: null }); }}
          className={cn(
            'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-40',
            mode === 'existing'
              ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]'
              : 'border-[var(--c-border)] text-[var(--c-muted)]',
          )}
        >
          Baralho existente
        </button>
        <button
          type="button"
          onClick={() => { setMode('new'); setEdited(false); onChange({ deckId: null, newName: suggestedName }); }}
          className={cn(
            'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold transition-colors',
            mode === 'new'
              ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]'
              : 'border-[var(--c-border)] text-[var(--c-muted)]',
          )}
        >
          Novo baralho
        </button>
      </div>

      {mode === 'existing' ? (
        <select
          aria-label="Baralho de destino"
          value={value.deckId ?? decks[0]?.id ?? ''}
          onChange={(e) => onChange({ deckId: e.target.value, newName: null })}
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
        >
          {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      ) : (
        <input
          type="text"
          aria-label="Nome do novo baralho"
          value={value.newName ?? ''}
          maxLength={60}
          placeholder="Nome do baralho…"
          onChange={(e) => { setEdited(true); onChange({ deckId: null, newName: e.target.value }); }}
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
        />
      )}
    </div>
  );
}
