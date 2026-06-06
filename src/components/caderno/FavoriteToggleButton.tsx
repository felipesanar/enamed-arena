/**
 * FavoriteToggleButton — botão de coração (toggle) para favoritar/desfavoritar
 * uma questão diretamente na correção do simulado.
 *
 * Apenas PRO (canUseNotebook=true) enxerga o botão.
 * Carrega a lista de favoritos via React Query (uma vez, com staleTime generoso)
 * para refletir o estado correto ao montar.
 *
 * Optimistic update: alterna imediatamente no UI, dispara a mutação em background.
 * Em caso de erro faz rollback + toast.
 *
 * Dispara: caderno_favorite_added / caderno_favorite_removed via trackEvent.
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { simuladosApi } from '@/services/simuladosApi';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { QuestionFavorite } from '@/types/caderno';

/* ── Constants ── */

const FAVORITES_QUERY_KEY = ['caderno', 'favorites'] as const;
const STALE_TIME = 5 * 60 * 1000; // 5 min — matches project default

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

/* ── Inner (rendered only when PRO, so hooks are unconditional here) ── */

function FavoriteToggleButtonInner({
  questionId,
  simuladoId,
  area,
  theme,
}: Omit<FavoriteToggleButtonProps, 'canUseNotebook'>) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  // Load favorites list once (stale 5 min). Drives the filled/outline state.
  const { data: favorites = [] } = useQuery<QuestionFavorite[]>({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: () => simuladosApi.listFavorites(),
    staleTime: STALE_TIME,
  });

  const isFavorited = favorites.some((f) => f.question_id === questionId);

  const handleToggle = useCallback(async () => {
    if (pending) return;
    setPending(true);

    // Optimistic update: mutate the cache before the network round-trip.
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
        // Rollback.
        queryClient.setQueryData<QuestionFavorite[]>(FAVORITES_QUERY_KEY, previous);
        toast({ title: 'Não foi possível remover', variant: 'destructive' });
      }
    } else {
      // Add optimistically with a placeholder row.
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
        // Replace the optimistic placeholder with the real row from the DB.
        queryClient.setQueryData<QuestionFavorite[]>(FAVORITES_QUERY_KEY, (curr = []) =>
          curr.map((f) => (f.id === optimisticEntry.id ? created : f)),
        );
        trackEvent('caderno_favorite_added', { question_id: questionId, simulado_id: simuladoId, area });
        toast({ title: 'Adicionado aos favoritos', duration: 2500 });
      } catch (err) {
        logger.error('[FavoriteToggleButton] Error adding favorite:', err);
        // Rollback.
        queryClient.setQueryData<QuestionFavorite[]>(FAVORITES_QUERY_KEY, previous);
        toast({ title: 'Não foi possível favoritar', variant: 'destructive' });
      }
    }

    setPending(false);
  }, [pending, isFavorited, questionId, simuladoId, area, theme, queryClient]);

  const label = isFavorited ? 'Remover dos favoritos' : 'Favoritar';

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
            'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-semibold transition-all',
            'border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
            isFavorited
              ? 'bg-primary/15 text-primary border-primary/40 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
              : 'bg-muted/40 text-muted-foreground border-border/70 hover:bg-primary/10 hover:text-primary hover:border-primary/30',
            pending && 'pointer-events-none opacity-50',
          )}
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-all',
              isFavorited ? 'fill-current' : 'fill-none',
            )}
            aria-hidden
          />
          {isFavorited ? 'Favoritado' : 'Favoritar'}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
