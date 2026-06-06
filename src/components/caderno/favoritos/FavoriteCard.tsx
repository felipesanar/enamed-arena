/**
 * FavoriteCard — card de questão favoritada na aba Favoritos do Caderno v2.
 *
 * Exibe: Q# · Área › Tema · prova · data relativa.
 * Ações: remover favorito (coração preenchido) com confirmação leve + undo (toast),
 *        link "Ver questão" → correção do simulado.
 *
 * Dispara: caderno_favorite_removed via trackEvent.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
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
    <div className="flex h-[64px] animate-pulse items-stretch gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="w-[3px] shrink-0 self-stretch rounded-full bg-muted/60" />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <div className="h-3 w-2/5 rounded-md bg-muted/60" />
        <div className="h-2.5 w-3/5 rounded-md bg-muted/40" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="h-7 w-20 rounded-lg bg-muted/60" />
        <div className="h-7 w-7 rounded-[8px] bg-muted/60" />
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

  const title = [
    favorite.area ?? null,
    favorite.theme ? `› ${favorite.theme}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const subtitle = fmtDateRelative(favorite.created_at);

  const correctionHref = favorite.simulado_id
    ? `/simulados/${favorite.simulado_id}/correcao?q=${favorite.question_id}`
    : null;

  const handleRemove = () => {
    if (removing) return;

    // Optimistic: remove from UI immediately
    onRemoveOptimistic(favorite.id);
    setRemoving(true);

    let undone = false;

    const t = toast({
      title: 'Removido dos favoritos',
      description: title || undefined,
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'group relative flex items-stretch gap-0 overflow-hidden rounded-xl border bg-card',
        'border-border transition-all duration-200',
        'hover:border-primary/20 hover:shadow-[0_6px_18px_-12px_hsl(345_65%_30%/0.2)]',
      )}
    >
      {/* Accent bar — wine/primary */}
      <div
        aria-hidden
        className="w-[3px] shrink-0 self-stretch bg-primary/60"
      />

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2.5">
        <span
          className="block truncate text-[13px] font-semibold tracking-[-0.005em] text-foreground"
          title={title || 'Questão sem área'}
        >
          {title || <span className="text-muted-foreground italic">Área não informada</span>}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          Favoritado {subtitle}
        </span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5 border-l border-border/60 px-2.5 py-2">
        {/* Ver questão */}
        {correctionHref && (
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <Link
                to={correctionHref}
                aria-label={`Ver questão na correção do simulado — ${title}`}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1.5',
                  'text-[11px] font-semibold text-muted-foreground no-underline',
                  'transition-all duration-150 hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                Ver questão
                <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
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
              aria-pressed={false}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-[8px] transition-all duration-150',
                'text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'hover:bg-destructive/10 hover:text-destructive',
                removing && 'pointer-events-none opacity-40',
              )}
            >
              <Heart
                className="h-3.5 w-3.5 fill-current"
                aria-hidden
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Remover dos favoritos</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
}
