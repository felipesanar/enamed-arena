/**
 * BulkActionBar — barra flutuante de ações em lote para o Caderno de Erros v2.
 *
 * Desktop: pill flutuante centralizado acima do bottom nav.
 * Mobile: usa BottomActionBar sticky (thumb-zone) quando em modo seleção.
 *
 * Ações: marcar resolvidas, adiar (snooze), excluir — com confirmação+undo via toast.
 * Spec: EPIC-5 HU-5.4
 */

import { Check, AlarmClock, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { BottomActionBar } from '@/components/caderno/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface BulkActionBarProps {
  count: number;
  onCancel: () => void;
  onMarkResolved: () => void;
  onSnooze: (days: number) => void;
  onDelete: () => void;
  busy?: boolean;
}

function pluralize(n: number, s: string, p: string) {
  return n === 1 ? s : p;
}

function BulkActions({
  count,
  onCancel,
  onMarkResolved,
  onSnooze,
  onDelete,
  busy,
  compact,
}: BulkActionBarProps & { compact?: boolean }) {
  return (
    <>
      {/* Contagem */}
      <span className="mr-1 min-w-[24px] rounded-full bg-[var(--c-wine-500)] px-2 py-0.5 text-center text-[11px] font-bold tabular-nums text-white">
        {count}
      </span>
      {!compact && (
        <span className="hidden text-[12px] font-semibold text-[var(--c-ink)] sm:block">
          {pluralize(count, 'selecionada', 'selecionadas')}
        </span>
      )}

      <div className="mx-1 h-5 w-px bg-[var(--c-border)]" aria-hidden />

      {/* Marcar como dominadas */}
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={busy}
            onClick={onMarkResolved}
            aria-label="Marcar selecionadas como dominadas"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-success)]/30 bg-[var(--c-success)]/10 px-3 text-[12px] font-semibold text-[var(--c-success)]',
              'transition-all duration-[var(--c-duration-fast)] hover:bg-[var(--c-success)]/20 hover:border-[var(--c-success)]/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-1',
              'disabled:opacity-50',
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
            <span className={compact ? 'sr-only' : 'hidden sm:inline'}>Dominadas</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Marcar como dominadas</TooltipContent>
      </Tooltip>

      {/* Adiar (dropdown) */}
      <DropdownMenu>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy}
                aria-label="Adiar selecionadas"
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 text-[12px] font-semibold text-[var(--c-muted)]',
                  'transition-all duration-[var(--c-duration-fast)] hover:border-[var(--c-wine-300)] hover:text-[var(--c-ink)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-1',
                  'disabled:opacity-50',
                )}
              >
                <AlarmClock className="h-3.5 w-3.5" aria-hidden />
                <span className={compact ? 'sr-only' : 'hidden sm:inline'}>Adiar</span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Adiar selecionadas</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="center" side="top" className="w-36">
          <DropdownMenuItem onClick={() => onSnooze(1)}>
            <AlarmClock className="mr-2 h-3.5 w-3.5" aria-hidden />
            1 dia
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSnooze(3)}>
            <AlarmClock className="mr-2 h-3.5 w-3.5" aria-hidden />
            3 dias
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSnooze(7)}>
            <AlarmClock className="mr-2 h-3.5 w-3.5" aria-hidden />
            7 dias
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSnooze(14)}>
            <AlarmClock className="mr-2 h-3.5 w-3.5" aria-hidden />
            14 dias
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Excluir */}
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            aria-label="Excluir selecionadas"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-[var(--c-radius-control)] border border-[var(--c-destructive)]/30 bg-[var(--c-destructive)]/10 px-3 text-[12px] font-semibold text-[var(--c-destructive)]',
              'transition-all duration-[var(--c-duration-fast)] hover:bg-[var(--c-destructive)]/20 hover:border-[var(--c-destructive)]/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-1',
              'disabled:opacity-50',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            <span className={compact ? 'sr-only' : 'hidden sm:inline'}>Excluir</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Excluir selecionadas</TooltipContent>
      </Tooltip>

      <div className="mx-1 h-5 w-px bg-[var(--c-border)]" aria-hidden />

      {/* Cancelar seleção */}
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar seleção"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-[var(--c-radius-control)] border border-[var(--c-border)] text-[var(--c-muted)]',
              'transition-all duration-[var(--c-duration-fast)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-1',
            )}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Cancelar seleção (Esc)</TooltipContent>
      </Tooltip>
    </>
  );
}

export function BulkActionBar({
  count,
  onCancel,
  onMarkResolved,
  onSnooze,
  onDelete,
  busy = false,
}: BulkActionBarProps) {
  const isMobile = useIsMobile();

  if (count === 0) return null;

  const commonProps = { count, onCancel, onMarkResolved, onSnooze, onDelete, busy };

  if (isMobile) {
    return (
      <BottomActionBar
        role="toolbar"
        aria-label={`${count} ${pluralize(count, 'questão selecionada', 'questões selecionadas')} — ações em lote`}
        className={cn(busy && 'pointer-events-none opacity-70')}
      >
        <BulkActions {...commonProps} compact />
      </BottomActionBar>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label={`${count} ${pluralize(count, 'questão selecionada', 'questões selecionadas')} — ações em lote`}
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
        'flex items-center gap-2 rounded-[var(--c-radius-pill)]',
        'border border-[var(--c-border)] px-3 py-2',
        'shadow-[var(--c-shadow-md)] backdrop-blur-[var(--c-glass-blur)]',
        busy && 'pointer-events-none opacity-70',
      )}
      style={{ background: 'color-mix(in srgb, var(--c-surface) 95%, transparent)' }}
    >
      <BulkActions {...commonProps} />
    </div>
  );
}
