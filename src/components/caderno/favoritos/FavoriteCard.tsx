/**
 * FavoriteCard — card premium de questão favoritada (Caderno v3 design language).
 *
 * Visual: CadernoCard interactive + barra lateral wine + Q#·Área›Tema + prova·data relativa.
 * Ações: coração preenchido (remover) com confirmação leve + undo 5s, "Ver questão" link.
 * Responsivo: mesma estrutura desktop/mobile, alvos ≥44px em mobile.
 *
 * Preservado: lógica de remoção, optimistic+undo, analytics (caderno_favorite_removed).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ExternalLink, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { CadernoCard } from '@/components/caderno/ui';
import type { QuestionFavorite } from '@/types/caderno';

/* ── Helpers ── */

function fmtDateRelative(iso: string): string {
  const now = Date.now();
  const d = new Date(iso).getTime();
  const diff = now - d;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/* ── Skeleton ── */

export function FavoriteCardSkeleton() {
  return (
    <div
      className="flex h-[76px] animate-pulse items-stretch overflow-hidden rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)]"
      aria-busy="true"
      aria-label="Carregando favorito..."
      role="status"
    >
      {/* Accent bar */}
      <div className="w-[3px] shrink-0 self-stretch bg-[var(--c-wine-300)]" />
      {/* Content */}
      <div className="flex flex-1 flex-col justify-center gap-2.5 px-4 py-3">
        <div className="h-3 w-1/3 rounded-md bg-[var(--c-surface-2)]" />
        <div className="h-2.5 w-3/5 rounded-md bg-[var(--c-surface-2)]" />
        <div className="h-2.5 w-2/5 rounded-md bg-[var(--c-surface-2)]" />
      </div>
      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2 px-3">
        <div className="h-8 w-24 rounded-[var(--c-radius-control)] bg-[var(--c-surface-2)]" />
        <div className="h-9 w-9 rounded-[var(--c-radius-control)] bg-[var(--c-surface-2)]" />
      </div>
    </div>
  );
}

/* ── Props ── */

export interface FavoriteCardProps {
  favorite: QuestionFavorite;
  /** Called after the 5s undo window expires without undo — actually removes from DB. */
  onRemove: (id: string) => Promise<void>;
  /** Optimistic: removes the card immediately from the list UI. */
  onRemoveOptimistic: (id: string) => void;
  /** Restores the card if the user undoes within 5s. */
  onRestoreOptimistic: (favorite: QuestionFavorite) => void;
}

/* ── Card ── */

export function FavoriteCard({
  favorite,
  onRemove,
  onRemoveOptimistic,
  onRestoreOptimistic,
}: FavoriteCardProps) {
  const [removing, setRemoving] = useState(false);

  // Q# · Área › Tema
  const questionLabel = favorite.question_id
    ? `Q${favorite.question_id.slice(-4).toUpperCase()}`
    : null;

  const areaTheme = [
    favorite.area ?? null,
    favorite.theme ? `› ${favorite.theme}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const dateLabel = fmtDateRelative(favorite.created_at);

  const correctionHref = favorite.simulado_id
    ? `/simulados/${favorite.simulado_id}/correcao?q=${favorite.question_id}`
    : null;

  const handleRemove = () => {
    if (removing) return;

    onRemoveOptimistic(favorite.id);
    setRemoving(true);

    let undone = false;

    const t = toast({
      title: 'Removido dos favoritos',
      description: areaTheme || undefined,
      duration: 5000,
      action: (
        <ToastAction
          altText="Desfazer remoção dos favoritos"
          onClick={() => {
            undone = true;
            setRemoving(false);
            onRestoreOptimistic(favorite);
            t.dismiss();
          }}
        >
          Desfazer
        </ToastAction>
      ),
    });

    setTimeout(async () => {
      if (undone) return;
      try {
        await onRemove(favorite.id);
        trackEvent('caderno_favorite_removed', {
          favorite_id: favorite.id,
          question_id: favorite.question_id,
          area: favorite.area ?? undefined,
        });
      } catch (err) {
        logger.error('[FavoriteCard] Error removing favorite:', err);
        setRemoving(false);
        onRestoreOptimistic(favorite);
        toast({
          title: 'Não foi possível remover',
          description: 'Tente novamente em instantes.',
          variant: 'destructive',
        });
      }
    }, 5100);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <CadernoCard
        variant="interactive"
        className={cn(
          'group relative flex items-stretch overflow-hidden',
          'transition-all duration-[var(--c-duration-base)]',
          // hover override: wine shadow instead of generic md
          'hover:border-[color-mix(in_srgb,var(--c-wine-300)_50%,transparent)] hover:shadow-[0_6px_24px_-8px_rgba(176,41,74,.18)]',
          removing && 'opacity-50 pointer-events-none',
        )}
      >
        {/* Accent bar — wine gradient */}
        <div
          aria-hidden
          className="w-[3px] shrink-0 self-stretch rounded-l-[var(--c-radius-card)]"
          style={{ background: 'linear-gradient(180deg, var(--c-wine-500), var(--c-wine-700))' }}
        />

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3.5">
          {/* Q# pill + área */}
          <div className="flex items-center gap-2">
            {questionLabel && (
              <span
                className="shrink-0 rounded-full border border-[var(--c-soft-wine-border)] bg-[var(--c-soft-wine-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--c-wine-700)] dark:text-[var(--c-wine-300)]"
                aria-label={`Questão ${questionLabel}`}
              >
                {questionLabel}
              </span>
            )}
            <span
              className="truncate text-[13px] font-semibold tracking-tight text-[var(--c-ink)]"
              title={areaTheme || 'Questão sem área'}
            >
              {areaTheme || (
                <span className="italic text-[var(--c-muted)]">Área não informada</span>
              )}
            </span>
          </div>

          {/* Data relativa */}
          <div className="flex items-center gap-1.5">
            <Calendar
              className="h-3 w-3 shrink-0 text-[var(--c-muted-2)]"
              aria-hidden
            />
            <span className="text-[11px] text-[var(--c-muted)]">
              Favoritado {dateLabel}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 border-l border-[color-mix(in_srgb,var(--c-border)_60%,transparent)] px-3 py-2.5">
          {/* Ver questão */}
          {correctionHref && (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Link
                  to={correctionHref}
                  aria-label={`Ver questão na correção do simulado — ${areaTheme}`}
                  className={cn(
                    'inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 sm:min-h-[36px]',
                    'text-[11px] font-semibold text-[var(--c-muted)] no-underline',
                    'transition-all duration-[var(--c-duration-fast)]',
                    'hover:border-[var(--c-soft-wine-border)] hover:bg-[var(--c-soft-wine-bg)] hover:text-[var(--c-wine-700)]',
                    'dark:hover:text-[var(--c-wine-300)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-1',
                  )}
                >
                  <span className="hidden sm:inline">Ver questão</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left">Ver na correção do simulado</TooltipContent>
            </Tooltip>
          )}

          {/* Remover favorito */}
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                aria-label="Remover dos favoritos"
                aria-pressed={true}
                className={cn(
                  'inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--c-radius-control)] sm:min-h-[36px] sm:min-w-[36px]',
                  'text-[var(--c-wine-500)] transition-all duration-[var(--c-duration-fast)]',
                  'bg-[var(--c-soft-wine-bg)] border border-[var(--c-soft-wine-border)]',
                  'hover:bg-[var(--c-soft-danger-bg)] hover:text-[var(--c-destructive)] hover:border-[var(--c-soft-danger-border)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-1',
                  removing && 'pointer-events-none opacity-40',
                )}
              >
                <Heart
                  className="h-4 w-4 fill-current"
                  aria-hidden
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Remover dos favoritos</TooltipContent>
          </Tooltip>
        </div>
      </CadernoCard>
    </motion.div>
  );
}
