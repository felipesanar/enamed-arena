/**
 * BulkActionBar — barra flutuante de ações em lote para o Caderno de Erros v2.
 *
 * Aparece quando `count > 0` (modo de seleção ativo).
 * Ações: marcar resolvidas, adiar (snooze), excluir — todas com confirmação/undo via toast.
 * Executa via Promise.all dos métodos por-item.
 * Spec: EPIC-5 HU-5.4 / backlog-fase1-epicos-historias.md
 */

import { Check, AlarmClock, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface BulkActionBarProps {
  /** Número de itens selecionados */
  count: number;
  /** Fechar modo de seleção */
  onCancel: () => void;
  /** Marcar todos como dominadas */
  onMarkResolved: () => void;
  /** Adiar N dias */
  onSnooze: (days: number) => void;
  /** Excluir selecionados */
  onDelete: () => void;
  /** Enquanto ações assíncronas rodam */
  busy?: boolean;
}

function pluralize(n: number, s: string, p: string) {
  return n === 1 ? s : p;
}

export function BulkActionBar({
  count,
  onCancel,
  onMarkResolved,
  onSnooze,
  onDelete,
  busy = false,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${count} ${pluralize(count, 'questão selecionada', 'questões selecionadas')} — ações em lote`}
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
        'flex items-center gap-2 rounded-2xl border border-border/80 bg-card/95 px-3 py-2 shadow-[0_8px_32px_-8px_hsl(0_0%_0%/0.25)]',
        'backdrop-blur-sm',
        busy && 'pointer-events-none opacity-70',
      )}
    >
      {/* Contagem */}
      <span className="mr-1 min-w-[24px] rounded-full bg-primary px-2 py-0.5 text-center text-[11px] font-bold tabular-nums text-primary-foreground">
        {count}
      </span>
      <span className="hidden text-[12px] font-semibold text-foreground sm:block">
        {pluralize(count, 'selecionada', 'selecionadas')}
      </span>

      <div className="mx-1 h-5 w-px bg-border/60" aria-hidden />

      {/* Marcar como dominadas */}
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={busy}
            onClick={onMarkResolved}
            aria-label="Marcar selecionadas como dominadas"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-xl border border-success/30 bg-success/10 px-3 text-[12px] font-semibold text-success',
              'transition-all duration-150 hover:bg-success/20 hover:border-success/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:opacity-50',
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
            <span className="hidden sm:inline">Dominadas</span>
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
                  'inline-flex h-8 items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 text-[12px] font-semibold text-muted-foreground',
                  'transition-all duration-150 hover:border-primary/30 hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:opacity-50',
                )}
              >
                <AlarmClock className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Adiar</span>
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
              'inline-flex h-8 items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 text-[12px] font-semibold text-destructive',
              'transition-all duration-150 hover:bg-destructive/20 hover:border-destructive/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:opacity-50',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Excluir</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Excluir selecionadas</TooltipContent>
      </Tooltip>

      <div className="mx-1 h-5 w-px bg-border/60" aria-hidden />

      {/* Cancelar seleção */}
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar seleção"
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground',
              'transition-all duration-150 hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Cancelar seleção (Esc)</TooltipContent>
      </Tooltip>
    </div>
  );
}
