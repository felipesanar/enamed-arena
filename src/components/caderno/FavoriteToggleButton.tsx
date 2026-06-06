/**
 * FavoriteToggleButton — botão de coração premium (toggle) para favoritar/desfavoritar
 * uma questão diretamente na correção do simulado (Caderno v3 design language).
 *
 * Apenas PRO (canUseNotebook=true) enxerga o botão.
 * Carrega a lista de favoritos via React Query (staleTime 5min) para estado correto.
 *
 * Optimistic update: alterna imediatamente, dispara mutação em background.
 * Em caso de erro faz rollback + toast.
 *
 * Preservado: caderno_favorite_added / caderno_favorite_removed analytics,
 *             query key ['caderno','favorites'], addFavorite/removeFavorite.
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { simuladosApi } from '@/services/simuladosApi';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { QuestionFavorite } from '@/types/caderno';

/* ── Constants ── */

const FAVORITES_QUERY_KEY = ['caderno', 'favorites'] as const;
const STALE_TIME = 5 * 60 * 1000; // 5 min

/* ── Props ── */

export interface FavoriteToggleButtonProps {
  questionId: string;
  simuladoId: string;
  area: string;
  theme: string;
  /** Whether the current user has PRO access to the caderno. */
  canUseNotebook: boolean;
}

/* ── Component ── */

export function FavoriteToggleButton({
  questionId,
  simuladoId,
  area,
  theme,
  canUseNotebook,
}: FavoriteToggleButtonProps) {
  // Only render for PRO users.
  if (!canUseNotebook) return null;

  return (
    <FavoriteToggleButtonInner
      questionId={questionId}
      simuladoId={simuladoId}
      area={area}
      theme={theme}
    />
  );
}

/* ── Inner (hooks unconditional — only rendered when PRO) ── */

function FavoriteToggleButtonInner({
  questionId,
  simuladoId,
  area,
  theme,
}: Omit<FavoriteToggleButtonProps, 'canUseNotebook'>) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const { data: favorites = [] } = useQuery<QuestionFavorite[]>({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: () => simuladosApi.listFavorites(),
    staleTime: STALE_TIME,
  });

  const isFavorited = favorites.some((f) => f.question_id === questionId);

  const handleToggle = useCallback(async () => {
    if (pending) return;
    setPending(true);

    const previous = queryClient.getQueryData<QuestionFavorite[]>(FAVORITES_QUERY_KEY) ?? [];

    if (isFavorited) {
      // Remove optimistically.
      queryClient.setQueryData<QuestionFavorite[]>(
        FAVORITES_QUERY_KEY,
        previous.filter((f) => f.question_id !== questionId),
      );

      try {
        await simuladosApi.removeFavorite(questionId, true);
        trackEvent('caderno_favorite_removed', { question_id: questionId, area });
        toast({ title: 'Removido dos favoritos', duration: 2500 });
      } catch (err) {
        logger.error('[FavoriteToggleButton] Error removing favorite:', err);
        queryClient.setQueryData<QuestionFavorite[]>(FAVORITES_QUERY_KEY, previous);
        toast({ title: 'Não foi possível remover', variant: 'destructive' });
      }
    } else {
      // Add optimistically.
      const optimisticEntry: QuestionFavorite = {
        id: `optimistic-${questionId}`,
        user_id: '',
        question_id: questionId,
        simulado_id: simuladoId,
        area,
        theme,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<QuestionFavorite[]>(FAVORITES_QUERY_KEY, [
        optimisticEntry,
        ...previous,
      ]);

      try {
        const created = await simuladosApi.addFavorite({
          question_id: questionId,
          simulado_id: simuladoId,
          area,
          theme,
        });
        queryClient.setQueryData<QuestionFavorite[]>(FAVORITES_QUERY_KEY, (curr = []) =>
          curr.map((f) => (f.id === optimisticEntry.id ? created : f)),
        );
        trackEvent('caderno_favorite_added', { question_id: questionId, simulado_id: simuladoId, area });
        toast({ title: 'Adicionado aos favoritos', duration: 2500 });
      } catch (err) {
        logger.error('[FavoriteToggleButton] Error adding favorite:', err);
        queryClient.setQueryData<QuestionFavorite[]>(FAVORITES_QUERY_KEY, previous);
        toast({ title: 'Não foi possível favoritar', variant: 'destructive' });
      }
    }

    setPending(false);
  }, [pending, isFavorited, questionId, simuladoId, area, theme, queryClient]);

  const label = isFavorited ? 'Remover dos favoritos' : 'Favoritar esta questão';

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          aria-label={label}
          aria-pressed={isFavorited}
          className={cn(
            // Base — sempre ≥44px alvo, rounded premium
            'relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-3.5 py-2.5',
            'text-[12px] font-semibold border',
            'transition-all duration-[var(--c-duration-base)] ease-[var(--c-ease-standard)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-1',
            // Favorited state
            isFavorited
              ? [
                  'border-[var(--c-wine-300)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]',
                  'dark:bg-[var(--c-wine-900)]/40 dark:border-[var(--c-wine-700)]/60 dark:text-[var(--c-wine-300)]',
                  'hover:border-[var(--c-destructive)]/40 hover:bg-[var(--c-destructive)]/8 hover:text-[var(--c-destructive)]',
                  'shadow-[0_2px_8px_-2px_rgba(176,41,74,.22)]',
                ].join(' ')
              : [
                  'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-muted)]',
                  'hover:border-[var(--c-wine-300)] hover:bg-[var(--c-wine-50)] hover:text-[var(--c-wine-700)]',
                  'dark:hover:bg-[var(--c-wine-900)]/30 dark:hover:text-[var(--c-wine-300)]',
                ].join(' '),
            pending && 'pointer-events-none opacity-50',
          )}
        >
          {/* Heart icon — animated fill */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isFavorited ? 'filled' : 'outline'}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
              aria-hidden
            >
              <Heart
                className={cn(
                  'h-4 w-4 transition-colors duration-[var(--c-duration-fast)]',
                  isFavorited ? 'fill-current' : 'fill-none',
                )}
              />
            </motion.span>
          </AnimatePresence>

          {/* Label */}
          <span>
            {isFavorited ? 'Favoritado' : 'Favoritar'}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
