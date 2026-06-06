/**
 * CadernoFavoritosPage — aba Favoritos do Caderno de Erros v3 (redesign premium).
 *
 * Rota: /caderno/favoritos  (gate PRO — a casca aplica o gate).
 *
 * Layout:
 *  Desktop — PageHeaderPremium (título + stats) + TabBar sticky + FilterChips primitivos
 *             + busca + grid de FavoriteCard (max-w-[1120px] centrado).
 *  Mobile  — MobileAppBar (via PageHeaderPremium) + TabBar (SegmentedTabs) + 1 coluna
 *             confortável + alvos ≥44px.
 *
 * Preservado integralmente: listFavorites/addFavorite/removeFavorite, query key
 * ['caderno','favorites'], optimistic+undo, analytics, gate PRO.
 */

import '@/components/caderno/ui/caderno-theme.css';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Search } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { simuladosApi } from '@/services/simuladosApi';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { PageTransition } from '@/components/premium/PageTransition';
import { ProGate } from '@/components/ProGate';
import { EmptyState } from '@/components/EmptyState';

import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import type { QuestionFavorite } from '@/types/caderno';

import { FavoriteCard, FavoriteCardSkeleton } from '@/components/caderno/favoritos/FavoriteCard';
import { FavoritesEmptyState } from '@/components/caderno/favoritos/FavoritesEmptyState';

import {
  PageHeaderPremium,
  FilterChip,
  CadernoSkeleton,
} from '@/components/caderno/ui';

/* ── Debounce hook ── */

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ── FavoritosContent ── */

function FavoritosContent() {
  const prefersReducedMotion = useReducedMotion();
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
    queryKey: ['caderno', 'favorites'],
    queryFn: () => simuladosApi.listFavorites(),
    staleTime: 5 * 60 * 1000,
  });

  // Whenever server data arrives/changes, reset optimistic patch
  useEffect(() => {
    if (serverList !== undefined) {
      setOptimisticList(null);
    }
  }, [serverList]);

  const favorites: QuestionFavorite[] = useMemo(
    () => optimisticList ?? serverList ?? [],
    [optimisticList, serverList],
  );

  /* ── Analytics ── */

  const favoritesLength = favorites.length;

  useEffect(() => {
    if (isLoading || tracked.current) return;
    tracked.current = true;
    trackEvent('caderno_erros_viewed', {
      tab: 'favoritos',
      total_favorites: favoritesLength,
    });
  }, [isLoading, favoritesLength]);

  /* ── Remove mutation ── */

  const removeMutation = useMutation({
    mutationFn: (id: string) => simuladosApi.removeFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caderno', 'favorites'] });
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

  /* ── Header stats ── */

  const headerStats = useMemo(() => {
    const stats = [
      { label: 'Favoritos', value: favorites.length, color: 'var(--c-wine-500)' },
      { label: 'Especialidades', value: specialties.length },
    ];
    if (hasActiveFilter) {
      stats.push({ label: 'Filtrados', value: filtered.length });
    }
    return stats;
  }, [favorites.length, specialties.length, filtered.length, hasActiveFilter]);

  /* ── Loading state ── */

  if (isLoading) {
    return (
      <div className="caderno-root">
        <div className="space-y-5 pb-10">
          {/* Header skeleton */}
          <div className="space-y-3 pb-4">
            <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--c-surface-2)]" />
            <div className="h-8 w-52 animate-pulse rounded-xl bg-[var(--c-surface-2)]" />
            <div className="flex gap-6">
              {[56, 72].map((w) => (
                <div key={w} className="space-y-1.5">
                  <div className="h-2.5 w-16 animate-pulse rounded-full bg-[var(--c-surface-2)]" />
                  <div className="h-6" style={{ width: w }} >
                    <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Filter bar skeleton */}
          <div className="flex flex-col gap-2.5">
            <div className="h-10 w-full animate-pulse rounded-[var(--c-radius-control)] bg-[var(--c-surface-2)]" />
            <div className="flex gap-2">
              {[80, 110, 90, 100].map((w) => (
                <div
                  key={w}
                  className="h-8 animate-pulse rounded-full bg-[var(--c-surface-2)]"
                  style={{ width: w }}
                />
              ))}
            </div>
          </div>
          <CadernoSkeleton count={5} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="caderno-root">
        <EmptyState
          variant="error"
          title="Não foi possível carregar os Favoritos"
          description="Houve um problema de conexão com o servidor. Verifique sua internet e tente novamente."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── Main layout ── */

  return (
    <div className="caderno-root">
      <div className="space-y-5 pb-10">

        {/* ── PageHeaderPremium — Desktop: título + stats. Mobile: MobileAppBar + stats scroll ── */}
        <PageHeaderPremium
          title="Favoritos"
          subtitle="Questões de alto valor que você salvou para revisitar."
          stats={headerStats}
        />

        {/* ── Filtros — só renderiza quando há dados ── */}
        {favorites.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3"
          >
            {/* Busca */}
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--c-muted-2)]"
                aria-hidden
              />
              <input
                type="search"
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                placeholder="Buscar por área ou tema…"
                aria-label="Buscar nos favoritos"
                className={cn(
                  'w-full rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)]',
                  'py-2.5 pl-10 pr-4 text-[13px] text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)]',
                  'transition-all duration-[var(--c-duration-fast)]',
                  'focus:border-[var(--c-wine-400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-wine-500)]/30',
                  'min-h-[44px]',
                )}
              />
            </div>

            {/* Chips por especialidade */}
            {specialties.length > 1 && (
              <div
                role="radiogroup"
                aria-label="Filtrar por especialidade"
                className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]"
              >
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
                  Área
                </span>
                <div className="flex items-center gap-1.5">
                  <FilterChip
                    label="Todas"
                    count={favorites.length}
                    active={!specFilter}
                    onClick={() => setSpecFilter(null)}
                    role="radio"
                    aria-checked={!specFilter}
                  />
                  {specialties.map((s) => (
                    <FilterChip
                      key={s}
                      label={s}
                      count={favorites.filter((f) => f.area === s).length}
                      active={specFilter === s}
                      onClick={() => setSpecFilter(specFilter === s ? null : s)}
                      role="radio"
                      aria-checked={specFilter === s}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Contador de resultados ── */}
        {favorites.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
              Favoritos
            </span>
            <span className="text-[11px] tabular-nums text-[var(--c-muted)]">
              {filtered.length} de {favorites.length}
            </span>
          </div>
        )}

        {/* ── Lista ── */}
        {favorites.length === 0 ? (
          <FavoritesEmptyState />
        ) : filtered.length === 0 ? (
          <FavoritesEmptyState isFiltered onClearFilters={hasActiveFilter ? clearFilters : undefined} />
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              className="flex flex-col gap-2"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: prefersReducedMotion ? 0 : 0.03 },
                },
                hidden: {},
              }}
            >
              {filtered.map((favorite) => (
                <FavoriteCard
                  key={favorite.id}
                  favorite={favorite}
                  onRemove={handleRemove}
                  onRemoveOptimistic={handleRemoveOptimistic}
                  onRestoreOptimistic={handleRestoreOptimistic}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Legenda discreta no rodapé ── */}
        {favorites.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--c-muted-2)]">
            <Heart className="h-3 w-3 fill-current text-[var(--c-wine-400)]" aria-hidden />
            Favorite questões diretamente na correção do simulado.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Page export ── */

export default function CadernoFavoritosPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
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
