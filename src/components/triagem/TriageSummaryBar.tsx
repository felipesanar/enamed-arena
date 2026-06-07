/**
 * TriageSummaryBar v2 — barra de ação premium da triagem.
 *
 * Desktop: sticky no rodapé da lista, fundo glass + gradiente, layout em linha.
 * Mobile: usa BottomActionBar (thumb-zone, acima do bottom-nav global).
 *
 * PRESERVA toda lógica de props — só apresentação redesenhada.
 */

import { Loader2, BookOpen, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomActionBar } from '@/components/caderno/ui';
import { useIsMobile } from '@/hooks/useIsMobile';

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
  const isMobile = useIsMobile();
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const disabled = isAdding || selectedCount === 0;

  const addLabel = isAdding
    ? 'Adicionando…'
    : isClassifying
      ? 'Classificando…'
      : allSelected
        ? `Adicionar todas (${selectedCount})`
        : `Adicionar ${selectedCount}`;

  // ── Botão primário (compartilhado) ────────────────────────────────────────
  const primaryBtn = (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      aria-busy={isAdding}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-2',
        'rounded-[var(--c-radius-control)] px-5 py-3',
        'text-sm font-semibold leading-none text-white',
        'bg-[var(--c-gradient-brand)] [background:var(--c-gradient-brand)]',
        'shadow-[var(--c-shadow-sm)]',
        'transition-all duration-[var(--c-duration-fast)]',
        'hover:brightness-110 hover:shadow-[var(--c-shadow-glow)]',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
        disabled && 'cursor-not-allowed opacity-50 hover:brightness-100 hover:shadow-[var(--c-shadow-sm)]',
      )}
    >
      {isAdding || isClassifying ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <BookOpen className="h-4 w-4" aria-hidden />
      )}
      {addLabel}
      {!isAdding && !isClassifying && selectedCount > 0 && (
        <ArrowRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
      )}
    </button>
  );

  // ── Botão secundário (compartilhado) ──────────────────────────────────────
  const secondaryBtn = (
    <button
      type="button"
      onClick={onSkipAll}
      disabled={isAdding}
      className={cn(
        'inline-flex items-center justify-center',
        'rounded-[var(--c-radius-control)] px-4 py-3',
        'text-sm font-medium leading-none',
        'border border-[var(--c-border)] bg-[var(--c-surface)]',
        'transition-colors duration-[var(--c-duration-fast)]',
        'hover:bg-[var(--c-surface-2)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/30',
        isAdding && 'cursor-not-allowed opacity-50',
      )}
      style={{ color: 'var(--c-muted)' }}
    >
      Agora não
    </button>
  );

  // ── Mobile: BottomActionBar (thumb-zone) ──────────────────────────────────
  if (isMobile) {
    return (
      <BottomActionBar className="caderno-root px-4 py-3">
        {primaryBtn}
        {secondaryBtn}
      </BottomActionBar>
    );
  }

  // ── Desktop: sticky inline com glass ─────────────────────────────────────
  return (
    <div
      className={cn(
        'caderno-root sticky bottom-0 z-20 mt-8',
        '-mx-4 sm:mx-0',
        // Fade-in glass from bottom
        'bg-[var(--c-surface)]',
        '[background:linear-gradient(to_top,var(--c-bg)_0%,var(--c-bg)_60%,transparent_100%)]',
        'pt-6 pb-5',
      )}
    >
      {/* Linha divisória sutil */}
      <div
        className="mb-4 h-px"
        style={{ background: 'var(--c-border)' }}
        aria-hidden
      />

      {/* Conteúdo da barra */}
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {/* Contagem */}
        {selectedCount > 0 && !isAdding && !isClassifying && (
          <span
            className="shrink-0 text-[11px] font-medium tabular-nums"
            style={{ color: 'var(--c-muted)' }}
          >
            {selectedCount} de {totalCount} selecionada{totalCount !== 1 ? 's' : ''}
          </span>
        )}

        <div className="flex flex-1 items-center gap-2">
          {primaryBtn}
          {secondaryBtn}
        </div>
      </div>
    </div>
  );
}
