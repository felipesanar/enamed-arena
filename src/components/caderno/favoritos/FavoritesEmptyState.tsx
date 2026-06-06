/**
 * FavoritesEmptyState — estado vazio da aba Favoritos.
 *
 * Exibido quando o usuário não tem nenhuma questão favoritada ainda.
 * CTA direciona ao simulados para encorajar o aluno a fazer uma prova.
 */

import { Link } from 'react-router-dom';
import { Heart, Zap } from 'lucide-react';

interface FavoritesEmptyStateProps {
  /** Quando true, indica que há favoritos mas a busca/filtro não retornou resultados. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

export function FavoritesEmptyState({ isFiltered, onClearFilters }: FavoritesEmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <Heart
          className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30"
          aria-hidden
        />
        <p className="text-body-sm font-semibold text-foreground">
          Nenhum favorito encontrado
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          Tente ajustar os filtros ou o termo de busca.
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-wine-hover focus-visible:outline-none focus-visible:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-10 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
        <Heart className="h-7 w-7 text-primary" aria-hidden />
      </div>

      <h3 className="text-heading-2 text-foreground">Nenhum favorito ainda</h3>

      <p className="mx-auto mt-2 max-w-md text-body leading-relaxed text-muted-foreground">
        Favorite questões de alto valor durante a correção do simulado — aquelas que valem
        revisar mesmo sem ter errado, como pegadinhas clássicas ou temas prevalentes.
      </p>

      <p className="mx-auto mt-2 max-w-sm text-caption text-muted-foreground/70">
        {/* TODO (CorrecaoPage): botão de coração em cada questão da correção chama
            addFavorite({ question_id, simulado_id, area, theme }) via simuladosApi.
            Enquanto não implementado, o CTA abaixo é a saída. */}
        Na correção de qualquer simulado, toque no{' '}
        <Heart
          className="inline-block h-3.5 w-3.5 text-primary"
          aria-label="ícone de coração"
        />{' '}
        ao lado da questão para salvá-la aqui.
      </p>

      <Link
        to="/simulados"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200 hover:bg-wine-hover no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]"
      >
        <Zap className="h-4 w-4" aria-hidden />
        Ver simulados disponíveis
      </Link>
    </div>
  );
}
