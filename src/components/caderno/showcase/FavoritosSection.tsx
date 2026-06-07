/**
 * FavoritosSection — showcase da aba Favoritos do Caderno v3.
 *
 * Rota de sandbox: /sandbox/caderno-v3 (já existente no projeto).
 * Renderiza todos os estados com mock data para QA no browser sem auth.
 *
 * Estados cobertos:
 *  1. Lista preenchida (3 especialidades, 6 favoritos)
 *  2. Filtro por especialidade ativo
 *  3. Busca sem resultado (filtrado)
 *  4. Estado vazio (nunca favoritou)
 *  5. Loading (skeletons)
 *  6. FavoriteToggleButton (ativo + inativo)
 */

import { useState } from 'react';
import { Heart, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  PageHeaderPremium,
  FilterChip,
  CadernoSkeleton,
  CadernoEmptyState,
} from '@/components/caderno/ui';
import { FavoriteCard } from '@/components/caderno/favoritos/FavoriteCard';
import { FavoritesEmptyState } from '@/components/caderno/favoritos/FavoritesEmptyState';
import type { QuestionFavorite } from '@/types/caderno';

// ─── Mock data ────────────────────────────────────────────────────────────────

const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const MOCK_FAVORITES: QuestionFavorite[] = [
  {
    id: 'fav-1',
    user_id: 'mock-user',
    question_id: 'q-00a1',
    simulado_id: 'sim-1',
    area: 'Cardiologia',
    theme: 'Síndrome Coronariana Aguda — IAMCSST',
    created_at: daysAgo(0),
  },
  {
    id: 'fav-2',
    user_id: 'mock-user',
    question_id: 'q-00b2',
    simulado_id: 'sim-1',
    area: 'Clínica Médica',
    theme: 'Pneumonia Adquirida na Comunidade',
    created_at: daysAgo(1),
  },
  {
    id: 'fav-3',
    user_id: 'mock-user',
    question_id: 'q-00c3',
    simulado_id: 'sim-2',
    area: 'Neurologia',
    theme: 'AVC Isquêmico — janela terapêutica',
    created_at: daysAgo(3),
  },
  {
    id: 'fav-4',
    user_id: 'mock-user',
    question_id: 'q-00d4',
    simulado_id: 'sim-2',
    area: 'Cardiologia',
    theme: 'Fibrilação Atrial — anticoagulação',
    created_at: daysAgo(8),
  },
  {
    id: 'fav-5',
    user_id: 'mock-user',
    question_id: 'q-00e5',
    simulado_id: 'sim-3',
    area: 'Pediatria',
    theme: 'Desidratação — classificação OMS',
    created_at: daysAgo(14),
  },
  {
    id: 'fav-6',
    user_id: 'mock-user',
    question_id: 'q-00f6',
    simulado_id: null,
    area: 'Clínica Médica',
    theme: 'Insuficiência Renal Aguda — KDIGO',
    created_at: daysAgo(30),
  },
];

// ─── Sub-seção helper ─────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-muted)]">
      {label}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--c-border)]" aria-hidden />;
}

// ─── Estado: lista preenchida ─────────────────────────────────────────────────

function FilledState() {
  const [favorites, setFavorites] = useState<QuestionFavorite[]>(MOCK_FAVORITES);
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [searchRaw, setSearchRaw] = useState('');

  const specialties = Array.from(new Set(favorites.map((f) => f.area).filter(Boolean) as string[])).sort();

  const filtered = favorites.filter((f) => {
    const areaMatch = !specFilter || f.area === specFilter;
    const searchMatch =
      !searchRaw.trim() ||
      f.area?.toLowerCase().includes(searchRaw.toLowerCase()) ||
      f.theme?.toLowerCase().includes(searchRaw.toLowerCase());
    return areaMatch && searchMatch;
  });

  const handleRemoveOptimistic = (id: string) =>
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  const handleRestoreOptimistic = (fav: QuestionFavorite) =>
    setFavorites((prev) =>
      [...prev, fav].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    );
  const handleRemove = async (_id: string) => {
    // mock: no-op (already removed optimistically)
  };

  const headerStats = [
    { label: 'Favoritos', value: favorites.length, color: 'var(--c-wine-500)' },
    { label: 'Especialidades', value: specialties.length },
  ];

  return (
    <div className="caderno-root space-y-5">
      <SectionLabel label="Estado: lista preenchida + filtros + busca (interativo)" />

      <PageHeaderPremium
        title="Favoritos"
        subtitle="Questões de alto valor que você salvou para revisitar."
        stats={headerStats}
      />

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
            'min-h-[44px] focus:border-[var(--c-wine-400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-wine-500)]/30',
            'transition-all duration-[var(--c-duration-fast)]',
          )}
        />
      </div>

      {/* FilterChips */}
      <div
        role="radiogroup"
        aria-label="Filtrar por especialidade"
        className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]"
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

      {/* Contador */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
          Favoritos
        </span>
        <span className="text-[11px] tabular-nums text-[var(--c-muted)]">
          {filtered.length} de {favorites.length}
        </span>
      </div>

      {/* Lista */}
      <AnimatePresence mode="popLayout">
        <motion.div
          className="flex flex-col gap-2"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.035 } },
            hidden: {},
          }}
        >
          {filtered.map((fav) => (
            <FavoriteCard
              key={fav.id}
              favorite={fav}
              onRemove={handleRemove}
              onRemoveOptimistic={handleRemoveOptimistic}
              onRestoreOptimistic={handleRestoreOptimistic}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {filtered.length === 0 && favorites.length > 0 && (
        <FavoritesEmptyState
          isFiltered
          onClearFilters={() => { setSpecFilter(null); setSearchRaw(''); }}
        />
      )}

      {/* Legenda rodapé */}
      <p className="flex items-center gap-1.5 text-[11px] text-[var(--c-muted-2)]">
        <Heart className="h-3 w-3 fill-current text-[var(--c-wine-400)]" aria-hidden />
        Favorite questões diretamente na correção do simulado.
      </p>
    </div>
  );
}

// ─── Estado: vazio ────────────────────────────────────────────────────────────

function EmptyListState() {
  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado: vazio (nunca favoritou)" />
      <div className="max-w-xl">
        <FavoritesEmptyState />
      </div>
    </div>
  );
}

// ─── Estado: busca sem resultado ──────────────────────────────────────────────

function FilteredEmptyState() {
  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="Estado: busca/filtro sem resultado" />
      <div className="max-w-xl">
        <FavoritesEmptyState isFiltered onClearFilters={() => undefined} />
      </div>
    </div>
  );
}

// ─── Estado: loading ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="caderno-root space-y-5">
      <SectionLabel label="Estado: carregando (skeletons)" />
      <div className="max-w-2xl space-y-3">
        <div className="space-y-3 pb-4">
          <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--c-surface-2)]" />
          <div className="h-8 w-40 animate-pulse rounded-xl bg-[var(--c-surface-2)]" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-[var(--c-radius-control)] bg-[var(--c-surface-2)]" />
        <div className="flex gap-2">
          {[80, 110, 90].map((w) => (
            <div key={w} className="h-8 animate-pulse rounded-full bg-[var(--c-surface-2)]" style={{ width: w }} />
          ))}
        </div>
        <CadernoSkeleton count={4} />
      </div>
    </div>
  );
}

// ─── FavoriteToggleButton showcase (inline, sem hook real) ───────────────────

function ToggleButtonShowcase() {
  const [favorited, setFavorited] = useState(false);

  return (
    <div className="caderno-root space-y-6">
      <SectionLabel label="FavoriteToggleButton — estados favorito/não-favorito (interativo)" />
      <div className="flex flex-wrap items-center gap-4">
        {/* Inline mock do botão para não precisar de Query/API */}
        <button
          type="button"
          aria-label={favorited ? 'Remover dos favoritos' : 'Favoritar esta questão'}
          aria-pressed={favorited}
          onClick={() => setFavorited((v) => !v)}
          className={cn(
            'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-3.5 py-2.5',
            'text-[12px] font-semibold border transition-all duration-[var(--c-duration-base)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
            favorited
              ? 'border-[var(--c-wine-300)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)] shadow-[0_2px_8px_-2px_rgba(176,41,74,.22)]'
              : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)] hover:bg-[var(--c-wine-50)] hover:text-[var(--c-wine-700)]',
          )}
        >
          <Heart className={cn('h-4 w-4 transition-colors', favorited ? 'fill-current' : 'fill-none')} aria-hidden />
          {favorited ? 'Favoritado' : 'Favoritar'}
        </button>

        <p className="text-[12px] text-[var(--c-muted)]">
          Clique para alternar estado · aria-pressed reflete estado correto
        </p>
      </div>
    </div>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function FavoritosSection() {
  return (
    <div className="caderno-root space-y-12 bg-[var(--c-bg)] p-6 md:p-10">
      <div>
        <h2 className="mb-1 text-heading-2 font-bold text-[var(--c-ink)]">
          Favoritos
        </h2>
        <p className="text-body text-[var(--c-muted)]">
          Showcase de todos os estados da aba Favoritos — Caderno de Erros v3.
        </p>
      </div>

      <Divider />
      <FilledState />
      <Divider />
      <EmptyListState />
      <Divider />
      <FilteredEmptyState />
      <Divider />
      <LoadingState />
      <Divider />
      <ToggleButtonShowcase />
    </div>
  );
}

export default FavoritosSection;
