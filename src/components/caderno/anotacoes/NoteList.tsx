/**
 * NoteList — lista de anotações do usuário.
 *
 * Desktop: lista vertical compacta com preview + data relativa.
 * Mobile: cards 1 coluna com alvo ≥ 44px.
 * Nota selecionada destacada com borda wine + bg tint.
 */

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, NotebookPen } from 'lucide-react';
import { motion } from 'framer-motion';
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
    <nav aria-label="Lista de anotações" className="flex flex-col gap-1.5">
      {notes.map((note, idx) => {
        const isActive = note.id === selectedId;
        const preview = bodyPreview(note.body_md);
        return (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.22,
              delay: idx * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div
              className={cn(
                'group relative flex cursor-pointer items-start rounded-[var(--c-radius-control)] border transition-all',
                'duration-[var(--c-duration-base)]',
                'focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] focus-within:ring-offset-1',
                isActive
                  ? [
                      'border-[color-mix(in_srgb,var(--c-wine-500)_30%,transparent)] bg-[var(--c-wine-50)]',
                      'dark:border-[color-mix(in_srgb,var(--c-wine-500)_25%,transparent)] dark:bg-[color-mix(in_srgb,var(--c-wine-900)_20%,transparent)]',
                      'shadow-[var(--c-shadow-sm)]',
                    ]
                  : [
                      'border-[var(--c-border)] bg-[var(--c-surface)]',
                      'hover:border-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)] hover:bg-[var(--c-surface-2)]',
                    ],
              )}
            >
              {/* Active accent bar */}
              {isActive && (
                <span
                  className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--c-radius-control)] bg-[var(--c-wine-500)]"
                  aria-hidden
                />
              )}

              {/* Clickable selection area */}
              <button
                type="button"
                onClick={() => onSelect(note)}
                className={cn(
                  'flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left',
                  'focus-visible:outline-none',
                  isActive && 'pl-4',
                )}
                aria-label={`Abrir anotação: ${note.title || 'Sem título'}`}
                aria-pressed={isActive}
              >
                <NotebookPen
                  className={cn(
                    'mt-0.5 h-3.5 w-3.5 shrink-0',
                    isActive
                      ? 'text-[var(--c-wine-500)]'
                      : 'text-[var(--c-muted-2)]',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-[13px] font-semibold leading-snug',
                      isActive
                        ? 'text-[var(--c-wine-700)] dark:text-[var(--c-wine-300)]'
                        : 'text-[var(--c-ink)]',
                    )}
                  >
                    {note.title || (
                      <span className="font-normal italic text-[var(--c-muted)]">
                        Sem título
                      </span>
                    )}
                  </p>
                  {preview && (
                    <p className="mt-0.5 line-clamp-1 text-[11.5px] leading-relaxed text-[var(--c-muted)]">
                      {preview}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] font-medium text-[var(--c-muted-2)]">
                    {relativeDate(note.updated_at)}
                  </p>
                </div>
              </button>

              {/* Delete button — appears on hover / always accessible via keyboard */}
              <div className="flex shrink-0 items-start py-2 pr-2">
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
                        'flex h-7 w-7 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-all duration-150 sm:min-h-0 sm:min-w-0',
                        'text-[var(--c-muted-2)] opacity-0 group-hover:opacity-100',
                        'hover:bg-destructive/10 hover:text-destructive',
                        'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1',
                        // Mobile: always visible (no hover)
                        'max-[767px]:opacity-100',
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Excluir anotação</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        );
      })}
    </nav>
  );
}
