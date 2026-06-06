/**
 * DeckList — lista de decks do usuário + criação de novo deck.
 *
 * Exibe decks como chips selecionáveis + botão "+ Novo deck" com inline input.
 * Deck selecionado fica destacado; "Todos" lista flashcards de todos os decks.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Layers, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
          Decks
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          {decks.length} {decks.length === 1 ? 'deck' : 'decks'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Chip "Todos" */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={selectedDeckId === null}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            selectedDeckId === null
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground',
          )}
        >
          <Layers className="h-3 w-3" aria-hidden />
          Todos
        </button>

        {/* Chips de decks */}
        <AnimatePresence mode="popLayout">
          {decks.map((deck) => (
            <motion.button
              key={deck.id}
              type="button"
              onClick={() => onSelect(deck.id)}
              aria-pressed={selectedDeckId === deck.id}
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selectedDeckId === deck.id
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground',
              )}
            >
              {deck.name}
            </motion.button>
          ))}
        </AnimatePresence>

        {/* Inline input / botão novo deck */}
        <AnimatePresence mode="wait">
          {showInput ? (
            <motion.div
              key="input"
              initial={prefersReducedMotion ? false : { opacity: 0, width: 40 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, width: 40 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1"
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
                  'h-8 w-36 rounded-full border border-primary/40 bg-card px-3 text-[12px] font-medium text-foreground',
                  'placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-1 focus:ring-primary',
                )}
              />
              <button
                type="button"
                aria-label="Confirmar criação de deck"
                disabled={!newName.trim() || isCreating}
                onClick={handleCreate}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground transition-opacity',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  (!newName.trim() || isCreating) && 'opacity-50 cursor-not-allowed',
                )}
              >
                {isCreating ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3 w-3" aria-hidden />
                )}
              </button>
              <button
                type="button"
                aria-label="Cancelar criação de deck"
                onClick={() => { setShowInput(false); setNewName(''); }}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-dashed border-border/60 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground/70',
                'transition-colors hover:border-border hover:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
