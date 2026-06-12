/**
 * FlashcardItem — carta vertical do flashcard no grid.
 *
 * Clique abre o preview (flip) — edição só pelo lápis.
 * Sem preview da resposta: a frente é a estrela.
 * Imagem da frente vira capa quando existe.
 */

import { forwardRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil, Trash2, Star, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadernoCard } from '@/components/caderno/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Flashcard } from '@/types/caderno';

/* ── SRS helpers ── */

function formatSrsDue(dueDateStr: string | null): {
  label: string;
  variant: 'due' | 'scheduled' | 'new';
} {
  if (!dueDateStr) return { label: 'Nova', variant: 'new' };
  const due = new Date(dueDateStr);
  const now = new Date();
  if (due <= now) return { label: 'Devida', variant: 'due' };
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return { label: 'Amanhã', variant: 'scheduled' };
  return { label: `Em ${diffDays}d`, variant: 'scheduled' };
}

const SRS_VARIANT_STYLES = {
  due: {
    chip: 'bg-orange-500/12 text-orange-500 border-orange-500/20',
    icon: Zap,
  },
  scheduled: {
    chip: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: Clock,
  },
  new: {
    chip: 'bg-[var(--c-surface-2)] text-[var(--c-muted)] border-[var(--c-border)]',
    icon: Star,
  },
} as const;

/* ── Props ── */

export interface FlashcardItemProps {
  card: Flashcard;
  onPreview: (card: Flashcard) => void;
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
}

/* ── Component ── */

export const FlashcardItem = forwardRef<HTMLDivElement, FlashcardItemProps>(
  function FlashcardItem({ card, onPreview, onEdit, onDelete }, ref) {
  const prefersReducedMotion = useReducedMotion();
  const [deleteHovered, setDeleteHovered] = useState(false);

  const srs = formatSrsDue(card.srs_due_at);
  const isMastered = !!card.mastered_at;
  const srsStyle = isMastered
    ? { chip: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Star }
    : SRS_VARIANT_STYLES[srs.variant];
  const SrsIcon = srsStyle.icon;
  const srsLabel = isMastered ? 'Dominado' : srs.label;

  const cleanFront = card.front_md.replace(/[#*_`[\]]/g, '').trim() || '(frente vazia)';

  return (
    <motion.div
      ref={ref}
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <CadernoCard
        variant="interactive"
        className={cn(
          'group relative flex h-full flex-col overflow-hidden',
          isMastered && 'opacity-60',
        )}
        onClick={() => onPreview(card)}
        tabIndex={0}
        role="button"
        aria-label={`Ver flashcard: ${cleanFront}`}
        onKeyDown={(e) => {
          if (e.repeat) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPreview(card);
          }
        }}
      >
        {/* Capa (imagem da frente) */}
        {card.front_image_url && (
          <div className="h-28 w-full overflow-hidden border-b border-[var(--c-border)] bg-[var(--c-surface-2)]">
            <img
              src={card.front_image_url}
              alt=""
              aria-hidden
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        )}

        {/* Pergunta */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p
            className={cn(
              'line-clamp-3 text-[14px] font-semibold leading-snug text-[var(--c-ink)]',
              !card.front_image_url && 'min-h-[3.5rem]',
            )}
          >
            {cleanFront}
          </p>

          {/* Rodapé: badge SRS + revisões */}
          <div className="mt-auto flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] border px-2 py-0.5 text-[10px] font-bold',
                srsStyle.chip,
              )}
            >
              <SrsIcon className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
              {srsLabel}
            </span>
            {card.srs_reps > 0 && (
              <span className="text-[10px] text-[var(--c-muted-2)]">
                {card.srs_reps} {card.srs_reps === 1 ? 'revisão' : 'revisões'}
              </span>
            )}
          </div>
        </div>

        {/* Ações — hover no desktop, sempre visíveis no mobile (sm:) */}
        <div
          className={cn(
            'absolute right-2 top-2 flex gap-1 rounded-lg bg-[color-mix(in_srgb,var(--c-surface)_85%,transparent)] p-0.5 backdrop-blur-sm',
            'opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Editar flashcard"
                onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-[var(--c-radius-control)]',
                  'text-[var(--c-muted)] transition-colors duration-150',
                  'hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
                )}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Editar</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Excluir flashcard"
                onMouseEnter={() => setDeleteHovered(true)}
                onMouseLeave={() => setDeleteHovered(false)}
                onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-[var(--c-radius-control)]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
                  deleteHovered
                    ? 'bg-destructive/10 text-destructive'
                    : 'text-[var(--c-muted)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]',
                )}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Excluir</TooltipContent>
          </Tooltip>
        </div>
      </CadernoCard>
    </motion.div>
  );
});
FlashcardItem.displayName = 'FlashcardItem';
