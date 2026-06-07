/**
 * FlashcardItem — card premium do flashcard na grade.
 *
 * Desktop: thumbnail de imagem, frente em preview (markdown limpo),
 *          status SRS badge, ações no hover.
 * Mobile: mesma estrutura, alvos ≥44px, sem hover.
 * Sensação de "deck de estudo premium".
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil, Trash2, Image as ImageIcon, Star, Clock, Zap } from 'lucide-react';
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
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
}

/* ── Component ── */

export function FlashcardItem({ card, onEdit, onDelete }: FlashcardItemProps) {
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
  const cleanBack = card.back_md.replace(/[#*_`[\]]/g, '').trim() || '(verso vazio)';

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <CadernoCard
        variant="interactive"
        className={cn(
          'group relative flex items-start gap-4 p-4',
          isMastered && 'opacity-60',
        )}
        onClick={() => onEdit(card)}
        tabIndex={0}
        role="button"
        aria-label={`Editar flashcard: ${cleanFront}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEdit(card);
          }
        }}
      >
        {/* Thumbnail de imagem */}
        <div className="shrink-0">
          {card.front_image_url ? (
            <div className="h-16 w-16 overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] shadow-[var(--c-shadow-sm)]">
              <img
                src={card.front_image_url}
                alt="Imagem da frente do card"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-xl',
                'border border-dashed border-[var(--c-border)] bg-[var(--c-surface-2)]',
              )}
              aria-hidden
            >
              <ImageIcon className="h-5 w-5 text-[var(--c-muted-2)]" aria-hidden />
            </div>
          )}
        </div>

        {/* Conteúdo principal */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Frente */}
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--c-ink)]">
            {cleanFront}
          </p>
          {/* Verso preview */}
          <p className="line-clamp-1 text-[11px] leading-relaxed text-[var(--c-muted)]">
            {cleanBack}
          </p>

          {/* SRS badge + reps */}
          <div className="flex items-center gap-2 pt-0.5">
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

        {/* Ações — visíveis no hover (desktop) / sempre visíveis (mobile via focus) */}
        <div
          className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
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
            <TooltipContent side="left">Editar</TooltipContent>
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
            <TooltipContent side="left">Excluir</TooltipContent>
          </Tooltip>
        </div>
      </CadernoCard>
    </motion.div>
  );
}
