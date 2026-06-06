/**
 * FlashcardItem — card compacto de flashcard na lista do deck.
 *
 * Exibe frente truncada, status SRS (devida/agendada/dominada),
 * imagem de thumbnail se houver, e ações de editar/excluir.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil, Trash2, Image as ImageIcon, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Flashcard } from '@/types/caderno';

function formatSrsDue(dueDateStr: string | null): { label: string; variant: 'due' | 'scheduled' | 'new' } {
  if (!dueDateStr) return { label: 'Nova', variant: 'new' };
  const due = new Date(dueDateStr);
  const now = new Date();
  if (due <= now) return { label: 'Devida', variant: 'due' };
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return { label: 'Amanhã', variant: 'scheduled' };
  return { label: `Em ${diffDays}d`, variant: 'scheduled' };
}

export interface FlashcardItemProps {
  card: Flashcard;
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
}

export function FlashcardItem({ card, onEdit, onDelete }: FlashcardItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const [deleteHovered, setDeleteHovered] = useState(false);

  const srs = formatSrsDue(card.srs_due_at);
  const isMastered = !!card.mastered_at;

  const srsVariantClass = {
    due: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    new: 'bg-muted text-muted-foreground border-border',
  }[srs.variant];

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors duration-150',
        'hover:border-border/80 hover:bg-card/80',
        isMastered && 'opacity-70',
      )}
    >
      {/* Thumbnail de imagem (frente) */}
      {card.front_image_url ? (
        <div className="shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
          <img
            src={card.front_image_url}
            alt="Imagem da frente do card"
            className="h-14 w-14 object-cover"
          />
        </div>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/50">
          <ImageIcon className="h-5 w-5 text-muted-foreground/30" aria-hidden />
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
          {card.front_md.replace(/[#*_`]/g, '').trim() || '(frente vazia)'}
        </p>
        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
          {card.back_md.replace(/[#*_`]/g, '').trim() || '(verso vazio)'}
        </p>

        <div className="mt-2 flex items-center gap-2">
          {isMastered ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
              Dominado
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                srsVariantClass,
              )}
            >
              {srs.label}
            </span>
          )}
          {card.srs_reps > 0 && (
            <span className="text-[10px] text-muted-foreground/60">
              {card.srs_reps} {card.srs_reps === 1 ? 'revisão' : 'revisões'}
            </span>
          )}
        </div>
      </div>

      {/* Ações — visíveis no hover */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Editar flashcard"
              onClick={() => onEdit(card)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Editar</TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Excluir flashcard"
              onMouseEnter={() => setDeleteHovered(true)}
              onMouseLeave={() => setDeleteHovered(false)}
              onClick={() => onDelete(card.id)}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                deleteHovered
                  ? 'bg-destructive/10 text-destructive'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Excluir</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
}
