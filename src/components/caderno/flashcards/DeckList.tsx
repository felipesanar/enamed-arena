/**
 * DeckList — seletor de decks premium.
 *
 * Desktop: chips elegantes em linha com count badge.
 * Mobile: mesmo layout scrollável horizontal (1 linha).
 * Botão "+ Novo deck" com inline input animado.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Layers, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterChip } from '@/components/caderno/ui';
import type { Deck } from '@/types/caderno';

export interface DeckListProps {
  decks: Deck[];
  selectedDeckId: string | null;
  onSelect: (deckId: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  isCreating: boolean;
}

export function DeckList({ decks, selectedDeckId, onSelect, onCreate, isCreating }: DeckListProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed || isCreating) return;
    await onCreate(trimmed);
    setNewName('');
    setShowInput(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setShowInput(false);
      setNewName('');
    }
  };

  return (
    <div className="space-y-2">
      {/* Label overline */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
          Decks
        </span>
        <span className="text-[10px] text-[var(--c-muted-2)]">
          {decks.length} {decks.length === 1 ? 'deck' : 'decks'}
        </span>
      </div>

      {/* Chips scrolláveis */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Selecionar deck"
      >
        {/* Chip "Todos" */}
        <FilterChip
          label="Todos"
          active={selectedDeckId === null}
          onClick={() => onSelect(null)}
          role="option"
          aria-selected={selectedDeckId === null}
        />

        {/* Chips de decks */}
        <AnimatePresence mode="popLayout">
          {decks.map((deck) => (
            <motion.div
              key={deck.id}
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0"
            >
              <FilterChip
                label={deck.name}
                active={selectedDeckId === deck.id}
                onClick={() => onSelect(deck.id)}
                role="option"
                aria-selected={selectedDeckId === deck.id}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Inline input / botão novo deck */}
        <AnimatePresence mode="wait">
          {showInput ? (
            <motion.div
              key="input"
              initial={prefersReducedMotion ? false : { opacity: 0, width: 32 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, width: 32 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex shrink-0 items-center gap-1"
            >
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={60}
                placeholder="Nome do deck…"
                aria-label="Nome do novo deck"
                className={cn(
                  'h-8 w-36 rounded-[var(--c-radius-pill)] border border-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] bg-[var(--c-surface)] px-3',
                  'text-[12px] font-medium text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)]',
                  'outline-none transition-colors focus:border-[var(--c-wine-500)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)]',
                )}
              />
              <button
                type="button"
                aria-label="Confirmar criação de deck"
                disabled={!newName.trim() || isCreating}
                onClick={handleCreate}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  'bg-[var(--c-wine-500)] text-white',
                  'transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
                  (!newName.trim() || isCreating) && 'cursor-not-allowed opacity-40',
                )}
              >
                {isCreating ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                )}
              </button>
              <button
                type="button"
                aria-label="Cancelar criação de deck"
                onClick={() => { setShowInput(false); setNewName(''); }}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  'border border-[var(--c-border)] text-[var(--c-muted)]',
                  'transition-colors hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
                )}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              type="button"
              onClick={() => setShowInput(true)}
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              aria-label="Criar novo deck"
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--c-radius-pill)] border border-dashed px-3',
                'border-[var(--c-border)] text-[11px] font-semibold text-[var(--c-muted)]',
                'transition-colors duration-150 hover:border-[var(--c-wine-300)] hover:text-[var(--c-wine-600)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
              )}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Novo deck
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
