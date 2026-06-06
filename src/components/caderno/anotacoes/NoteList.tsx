/**
 * NoteList — lista de anotações do usuário.
 *
 * Exibe título + preview do corpo + data relativa.
 * Nota selecionada fica destacada com borda primary.
 * Suporta deletar com confirmação + undo via toast.
 */

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, NotebookPen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { UserNote } from '@/types/caderno';

interface NoteListProps {
  notes: UserNote[];
  selectedId: string | null;
  onSelect: (note: UserNote) => void;
  onDelete: (note: UserNote) => void;
}

function relativeDate(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

function bodyPreview(md: string): string {
  // Strip markdown syntax for a plain-text preview (max 80 chars)
  const plain = md
    .replace(/#{1,6}\s/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
  return plain.length > 80 ? plain.slice(0, 77) + '…' : plain;
}

export function NoteList({ notes, selectedId, onSelect, onDelete }: NoteListProps) {
  if (notes.length === 0) return null;

  return (
    <nav
      aria-label="Lista de anotações"
      className="flex flex-col gap-1"
    >
      {notes.map((note) => {
        const isActive = note.id === selectedId;
        return (
          <div
            key={note.id}
            className={cn(
              'group relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all duration-150',
              'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
              isActive
                ? 'border-primary/40 bg-primary/[0.05]'
                : 'border-border bg-card hover:border-primary/20 hover:bg-accent/30',
            )}
          >
            {/* Clickable area for selection */}
            <button
              type="button"
              onClick={() => onSelect(note)}
              className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none"
              aria-label={`Abrir anotação: ${note.title || 'Sem título'}`}
              aria-pressed={isActive}
            >
              <NotebookPen
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-[13px] font-semibold leading-snug',
                    isActive ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {note.title || <span className="italic text-muted-foreground">Sem título</span>}
                </p>
                {note.body_md && (
                  <p className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed text-muted-foreground">
                    {bodyPreview(note.body_md)}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  {relativeDate(note.updated_at)}
                </p>
              </div>
            </button>

            {/* Delete button */}
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(note);
                  }}
                  aria-label={`Excluir anotação: ${note.title || 'Sem título'}`}
                  className={cn(
                    'mt-0.5 shrink-0 rounded-lg p-1.5 transition-all duration-150',
                    'text-muted-foreground/40 opacity-0 group-hover:opacity-100',
                    'hover:bg-destructive/10 hover:text-destructive',
                    'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1',
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Excluir anotação</TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </nav>
  );
}
