/**
 * CreateActionsRow — CTAs de criação em destaque no corpo da página.
 *
 * Dois cards grandes: "Gerar com Prof. San" (IA, âmbar) e "Criar flashcard"
 * (wine outline). Substituem os botões pequenos do header.
 */

import { Sparkles, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface CreateActionsRowProps {
  onGenerate: () => void;
  onCreate: () => void;
  /** Desabilita "Criar flashcard" quando nenhum deck está selecionado. */
  createDisabled: boolean;
}

export function CreateActionsRow({ onGenerate, onCreate, createDisabled }: CreateActionsRowProps) {
  const createButton = (
    <button
      type="button"
      onClick={onCreate}
      disabled={createDisabled}
      className={cn(
        'group flex w-full flex-1 items-center gap-3 rounded-[var(--c-radius-card)] border p-4 text-left',
        'border-[color-mix(in_srgb,var(--c-wine-500)_25%,transparent)] bg-[var(--c-surface)]',
        'transition-all duration-150',
        createDisabled
          ? 'pointer-events-none opacity-50'
          : 'hover:-translate-y-[1px] hover:border-[var(--c-wine-400)] hover:shadow-[var(--c-shadow-sm)] motion-reduce:hover:translate-y-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--c-wine-50)]">
        <Plus className="h-5 w-5 text-[var(--c-wine-600)]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-[var(--c-ink)]">Criar flashcard</span>
        <span className="block text-[11.5px] text-[var(--c-muted)]">
          Escreva frente e verso, com imagem se quiser
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--c-muted-2)] transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      {/* Gerar com IA */}
      <button
        type="button"
        onClick={onGenerate}
        className={cn(
          'group flex flex-1 items-center gap-3 rounded-[var(--c-radius-card)] border p-4 text-left',
          'border-amber-400/40 bg-gradient-to-r from-amber-500/[0.07] to-transparent',
          'transition-all duration-150',
          'hover:-translate-y-[1px] hover:border-amber-400 hover:shadow-[var(--c-shadow-sm)] motion-reduce:hover:translate-y-0',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
          <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--c-ink)]">
            Gerar com Prof. San
            <span className="rounded-[var(--c-radius-pill)] bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">
              IA
            </span>
          </span>
          <span className="block text-[11.5px] text-[var(--c-muted)]">
            Vários cards de uma vez, a partir dos seus erros ou de um tema
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--c-muted-2)] transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </button>

      {/* Criar manual */}
      {createDisabled ? (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span className="block flex-1 cursor-not-allowed" tabIndex={0}>{createButton}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Selecione um deck para adicionar um flashcard</TooltipContent>
        </Tooltip>
      ) : (
        createButton
      )}
    </div>
  );
}
