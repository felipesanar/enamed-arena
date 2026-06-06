/**
 * TriageSummaryBar — barra fixa na base da tela de triagem.
 *
 * Exibe o contador de questões selecionadas, o botão primário de confirmação
 * em lote e o link "Agora não".
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TriageSummaryBarProps {
  /** Total de questões candidatas (sem contar as puladas). */
  selectedCount: number;
  /** Total incluindo as puladas (para o label "todas"). */
  totalCount: number;
  /** true enquanto a IA ainda está classificando — desabilita o botão. */
  isClassifying: boolean;
  /** true enquanto o bulk add está em andamento. */
  isAdding: boolean;
  onAdd: () => void;
  onSkipAll: () => void;
}

export function TriageSummaryBar({
  selectedCount,
  totalCount,
  isClassifying,
  isAdding,
  onAdd,
  onSkipAll,
}: TriageSummaryBarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const disabled = isAdding || selectedCount === 0;

  const addLabel = allSelected
    ? `Adicionar todas (${selectedCount}) ao caderno`
    : `Adicionar ${selectedCount} ao caderno`;

  return (
    <div
      className="sticky bottom-0 z-10 mt-6 -mx-4 sm:mx-0 px-4 sm:px-0 pt-4 pb-5 sm:pt-3 sm:pb-4"
      style={{
        background:
          'linear-gradient(to top, hsl(var(--background)) 70%, transparent 100%)',
      }}
    >
      <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-3">
        {/* Botão primário */}
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className={cn(
            'flex-1 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-body font-semibold transition-all',
            'bg-primary text-primary-foreground !text-white',
            'hover:bg-wine-hover active:scale-[0.99] shadow-sm hover:shadow-md',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            disabled && 'opacity-50 cursor-not-allowed hover:bg-primary',
          )}
          aria-busy={isAdding}
        >
          {isAdding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Adicionando…
            </>
          ) : isClassifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Classificando…
            </>
          ) : (
            addLabel
          )}
        </button>

        {/* Link secundário */}
        <button
          type="button"
          onClick={onSkipAll}
          disabled={isAdding}
          className="text-body-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded whitespace-nowrap"
        >
          Agora não — ver resultado
        </button>
      </div>
    </div>
  );
}
