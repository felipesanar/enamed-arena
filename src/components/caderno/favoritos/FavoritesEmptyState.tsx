/**
 * FavoritesEmptyState — estado vazio premium da aba Favoritos (Caderno v3).
 *
 * Usa CadernoEmptyState do design system para consistência.
 * Variantes: lista vazia (nunca favoritou) e busca sem resultado (filtros ativos).
 */

import { Link } from 'react-router-dom';
import { Heart, Zap, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadernoEmptyState } from '@/components/caderno/ui';

interface FavoritesEmptyStateProps {
  /** Quando true, indica que há favoritos mas a busca/filtro não retornou resultados. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

export function FavoritesEmptyState({ isFiltered, onClearFilters }: FavoritesEmptyStateProps) {
  if (isFiltered) {
    return (
      <CadernoEmptyState
        icon={
          <SlidersHorizontal
            className="h-7 w-7 text-[var(--c-muted)]"
            aria-hidden
          />
        }
        title="Nenhum favorito encontrado"
        description="Tente ajustar os filtros ou o termo de busca."
        action={
          onClearFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2',
                'text-[12px] font-semibold text-[var(--c-muted)]',
                'transition-colors duration-[var(--c-duration-fast)] hover:border-[var(--c-wine-300)] hover:text-[var(--c-ink)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
              )}
            >
              Limpar filtros
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <CadernoEmptyState
      icon={
        <Heart
          className="h-7 w-7 text-[var(--c-wine-500)]"
          aria-hidden
        />
      }
      title="Nenhum favorito ainda"
      description={
        [
          'Favorite, na correção do simulado, as questões que valem rever: ',
          'pegadinhas clássicas, temas que mais caem ou qualquer uma que você quer fixar.',
        ].join('')
      }
      action={
        <div className="flex flex-col items-center gap-3">
          {/* Instrução */}
          <p className="flex items-center gap-1.5 text-[12px] text-[var(--c-muted-2)]">
            Toque no
            <Heart
              className="inline-block h-3.5 w-3.5 fill-current text-[var(--c-wine-500)]"
              aria-label="ícone de coração"
            />
            ao lado de qualquer questão na correção.
          </p>

          {/* CTA primário */}
          <Link
            to="/simulados"
            className={cn(
              'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5 no-underline',
              'text-[13px] font-bold text-white',
              'bg-gradient-to-br from-[var(--c-wine-500)] to-[var(--c-wine-700)]',
              'shadow-[var(--c-shadow-glow)] transition-all duration-[var(--c-duration-base)]',
              'hover:shadow-[0_8px_32px_-8px_rgba(176,41,74,.55)] hover:-translate-y-0.5',
              'active:scale-[0.99]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
            )}
          >
            <Zap className="h-4 w-4" aria-hidden />
            Ver simulados disponíveis
          </Link>
        </div>
      }
    />
  );
}
