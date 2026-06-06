/**
 * CadernoFavoritosPage — aba Favoritos do Caderno de Erros v2.
 *
 * Rota: /caderno/favoritos  (gate PRO — a casca CadernoPage aplica o gate).
 * Abas: só "Favoritos" ativo; demais abas renderizadas via TabBar (padrão existente).
 *
 * Funcionalidades:
 *   - Lista de questões favoritadas via simuladosApi.listFavorites() + React Query.
 *   - Filtro por especialidade (área) — chips simples reutilizando padrão do FilterBar.
 *   - Busca textual client-side (área, tema, debounced 300ms).
 *   - Remover favorito com otimismo + undo (5s) + toast.
 *   - Estados: loading (skeleton), vazio (FavoritesEmptyState), busca sem resultado.
 *
 * TODO (CorrecaoPage): o ponto de ADICIONAR favorito fica na correção do simulado.
 *   Em cada questão, renderize um botão de coração que chama:
 *     await simuladosApi.addFavorite({ question_id, simulado_id, area, theme })
 *   e invalide a query 'favorites' para sincronizar com esta aba.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Search, Check } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

import { simuladosApi } from '@/services/simuladosApi';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { EmptyState } from '@/components/EmptyState';

import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import type { QuestionFavorite } from '@/types/caderno';

import { TabBar } from '@/components/caderno/TabBar';
import { FavoriteCard, FavoriteCardSkeleton } from '@/components/caderno/favoritos/FavoriteCard';
import { FavoritesEmptyState } from '@/components/caderno/favoritos/FavoritesEmptyState';

/* ── Debounce hook ── */

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ── Chip de filtro — padrão FilterBar ── */

interface FilterChipProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, count, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)]'
          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      {active ? (
        <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
      ) : null}
      {label}
      {typeof count === 'number' && (
        <span className={cn('text-[10px] font-bold tabular-nums', active ? 'opacity-80' : 'opacity-55')}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── FavoritosContent ── */

function FavoritosContent() {
  const queryClient = useQueryClient();

  // Optimistic list (client-side patch over query data)
  const [optimisticList, setOptimisticList] = useState<QuestionFavorite[] | null>(null);

  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [searchRaw, setSearchRaw] = useState('');
  const searchDebounced = useDebounce(searchRaw, 300);

  const tracked = useRef(false);

  /* ── Query ── */

  const {
    data: serverList,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => simuladosApi.listFavorites(),
    staleTime: 5 * 60 * 1000,
  });

  // Whenever the server data arrives/changes, reset the optimistic patch
  useEffect(() => {
    if (serverList !== undefined) {
      setOptimisticList(null);
    }
  }, [serverList]);

  const favorites: QuestionFavorite[] = optimisticList ?? serverList ?? [];

  /* ── Analytics ── */

  useEffect(() => {
    if (isLoading || tracked.current) return;
    tracked.current = true;
    trackEvent('caderno_erros_viewed', {
      tab: 'favoritos',
      total_favorites: favorites.length,
    });
  }, [isLoading, favorites.length]);

  /* ── Remove mutation ── */

  const removeMutation = useMutation({
    mutationFn: (id: string) => simuladosApi.removeFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (err) => {
      logger.error('[CadernoFavoritosPage] Remove favorite error:', err);
    },
  });

  /* ── Optimistic handlers ── */

  const handleRemoveOptimistic = useCallback((id: string) => {
    setOptimisticList((prev) => {
      const base = prev ?? serverList ?? [];
      return base.filter((f) => f.id !== id);
    });
  }, [serverList]);

  const handleRestoreOptimistic = useCallback((favorite: QuestionFavorite) => {
    setOptimisticList((prev) => {
      const base = prev ?? serverList ?? [];
      // Insert back in original position by created_at desc
      const withRestored = [...base, favorite].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return withRestored;
    });
  }, [serverList]);

  const handleRemove = useCallback(async (id: string) => {
    await removeMutation.mutateAsync(id);
  }, [removeMutation]);

  /* ── Derived data ── */

  const specialties = useMemo(
    () =>
      Array.from(new Set(favorites.map((f) => f.area).filter((a): a is string => !!a))).sort(),
    [favorites],
  );

  const filtered = useMemo(() => {
    let data = favorites;
    if (specFilter) data = data.filter((f) => f.area === specFilter);
    if (searchDebounced.trim()) {
      const q = searchDebounced.toLowerCase();
      data = data.filter(
        (f) =>
          f.area?.toLowerCase().includes(q) ||
          f.theme?.toLowerCase().includes(q),
      );
    }
    return data;
  }, [favorites, specFilter, searchDebounced]);

  const hasActiveFilter = !!specFilter || searchDebounced.trim().length > 0;

  const clearFilters = () => {
    setSpecFilter(null);
    setSearchRaw('');
  };

  /* ── States ── */

  if (isLoading) {
    return (
      <div className="space-y-5">
        {/* Simula a barra de filtro */}
        <div className="flex flex-col gap-2.5">
          <div className="h-9 w-full animate-pulse rounded-xl bg-muted/60" />
          <div className="flex gap-1.5">
            {[80, 110, 90, 100].map((w) => (
              <div key={w} className="h-8 animate-pulse rounded-full bg-muted/60" style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <FavoriteCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        variant="error"
        title="Não foi possível carregar os Favoritos"
        description="Houve um problema de conexão com o servidor. Verifique sua internet e tente novamente."
        onRetry={() => refetch()}
      />
    );
  }

  /* ── Main layout ── */

  return (
    <StaggerContainer className="space-y-5 md:space-y-6">

      {/* Filtros — só renderiza quando há dados */}
      {favorites.length > 0 && (
        <StaggerItem>
          <div className="flex flex-col gap-2.5">
            {/* Busca */}
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
                aria-hidden
              />
              <input
                type="search"
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                placeholder="Buscar por área ou tema…"
                aria-label="Buscar nos favoritos"
                className={cn(
                  'w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60',
                  'transition-colors duration-150 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                )}
              />
            </div>

            {/* Chips por especialidade */}
            {specialties.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
                <span className="w-[44px] shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Área
                </span>
                <div role="radiogroup" aria-label="Filtrar por especialidade" className="flex items-center gap-1.5">
                  <FilterChip
                    label="Todas"
                    count={favorites.length}
                    active={!specFilter}
                    onClick={() => setSpecFilter(null)}
                  />
                  {specialties.map((s) => (
                    <FilterChip
                      key={s}
                      label={s}
                      count={favorites.filter((f) => f.area === s).length}
                      active={specFilter === s}
                      onClick={() => setSpecFilter(specFilter === s ? null : s)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </StaggerItem>
      )}

      {/* Contador de resultados */}
      {favorites.length > 0 && (
        <StaggerItem>
          <div className="flex items-center justify-between">
            <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
              Favoritos
            </span>
            <span className="text-caption text-muted-foreground tabular-nums">
              {filtered.length} de {favorites.length}
            </span>
          </div>
        </StaggerItem>
      )}

      {/* Lista */}
      <StaggerItem>
        {favorites.length === 0 ? (
          <FavoritesEmptyState />
        ) : filtered.length === 0 ? (
          <FavoritesEmptyState isFiltered onClearFilters={hasActiveFilter ? clearFilters : undefined} />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="flex flex-col gap-2">
              {filtered.map((favorite) => (
                <FavoriteCard
                  key={favorite.id}
                  favorite={favorite}
                  onRemove={handleRemove}
                  onRemoveOptimistic={handleRemoveOptimistic}
                  onRestoreOptimistic={handleRestoreOptimistic}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </StaggerItem>

      {/* Legenda discreta no rodapé */}
      {favorites.length > 0 && (
        <StaggerItem>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Heart className="h-3 w-3 fill-current text-primary/50" aria-hidden />
            {/* TODO (CorrecaoPage): botão de coração em cada questão da correção
                chama addFavorite({ question_id, simulado_id, area, theme })
                e invalida queryClient.invalidateQueries(['favorites']). */}
            Favorite questões diretamente na correção do simulado.
          </p>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

/* ── Page export ── */

export default function CadernoFavoritosPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      {/* TabBar sempre visível, antes do gate, igual ao CadernoPage */}
      <TabBar />

      {!hasAccess ? (
        <ProGate
          icon={Heart}
          feature="Favoritos"
          description="Salve questões de alto valor para revisitar sempre que quiser — pegadinhas clássicas, temas prevalentes, qualquer questão que vale fixar."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Salvar questões favoritas direto da correção',
            'Filtrar por especialidade e buscar por tema',
            'Acessar a correção completa de qualquer favorito',
          ]}
        />
      ) : (
        <FavoritosContent />
      )}
    </PageTransition>
  );
}
