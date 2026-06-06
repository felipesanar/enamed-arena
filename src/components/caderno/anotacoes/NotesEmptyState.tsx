/**
 * NotesEmptyState — estado vazio da aba Anotações.
 * Exibido quando o usuário ainda não criou nenhuma nota.
 */

import { NotebookPen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotesEmptyStateProps {
  onCreateNote: () => void;
}

export function NotesEmptyState({ onCreateNote }: NotesEmptyStateProps) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.03] p-10 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
        <NotebookPen className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h3 className="text-heading-2 text-foreground">Nenhuma anotação ainda</h3>
      <p className="mx-auto mt-2 max-w-sm text-body leading-relaxed text-muted-foreground">
        Crie anotações livres com título e texto. Use para resumir um tema,
        registrar uma dica clínica ou organizar ideias de estudo.
      </p>
      <button
        type="button"
        onClick={onCreateNote}
        className={cn(
          'mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5',
          'text-body-sm font-semibold text-primary-foreground',
          'shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)]',
          'transition-all duration-200 hover:bg-wine-hover active:scale-[0.99]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        aria-label="Criar primeira anotação"
      >
        <NotebookPen className="h-4 w-4" aria-hidden />
        Criar primeira anotação
      </button>
    </div>
  );
}
