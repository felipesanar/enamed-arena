/**
 * NotesEmptyState — estado vazio da aba Anotações.
 * Usa CadernoEmptyState do design system.
 */

import { NotebookPen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadernoEmptyState } from '@/components/caderno/ui';

interface NotesEmptyStateProps {
  onCreateNote: () => void;
}

export function NotesEmptyState({ onCreateNote }: NotesEmptyStateProps) {
  return (
    <CadernoEmptyState
      icon={<NotebookPen className="h-7 w-7 text-[var(--c-wine-500)]" aria-hidden />}
      title="Nenhuma anotação ainda"
      description="Crie anotações livres com título e texto. Use para resumir temas, registrar dicas clínicas ou organizar ideias de estudo."
      action={
        <button
          type="button"
          onClick={onCreateNote}
          className={cn(
            'inline-flex items-center gap-2 rounded-[var(--c-radius-control)]',
            'bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)]',
            'px-5 py-2.5 text-[13px] font-semibold text-white',
            'shadow-[var(--c-shadow-glow)]',
            'transition-all duration-[var(--c-duration-base)] hover:brightness-110 active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/60 focus-visible:ring-offset-2',
          )}
          aria-label="Criar primeira anotação"
        >
          <NotebookPen className="h-4 w-4" aria-hidden />
          Criar primeira anotação
        </button>
      }
    />
  );
}
