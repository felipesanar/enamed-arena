/**
 * CreatePanel — bloco "Criar" da página de Flashcards.
 *
 * Card destaque "Gerar com Prof. San" (IA, âmbar, com avatar do Prof.) +
 * card "Criar flashcard" (manual, wine). Substitui a antiga CreateActionsRow.
 */

import { Sparkles, Plus, PenLine, ArrowRight, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import { FlashcardPanel } from './FlashcardPanel';

export interface CreatePanelProps {
  onGenerate: () => void;
  onCreate: () => void;
  /** Desabilita "Criar flashcard" quando nenhum deck está selecionado. */
  createDisabled: boolean;
}

/** Pequenas pílulas que mostram de onde a IA parte. */
const GENERATE_SOURCES = ['seus erros', 'um tema', 'suas anotações'];

export function CreatePanel({ onGenerate, onCreate, createDisabled }: CreatePanelProps) {
  const createButton = (
    <button
      type="button"
      onClick={onCreate}
      disabled={createDisabled}
      className={cn(
        'group flex w-full items-center gap-3 rounded-[var(--c-radius-control)] border p-3.5 text-left',
        'border-[color-mix(in_srgb,var(--c-wine-500)_22%,transparent)] bg-[var(--c-surface)]',
        'transition-all duration-150',
        createDisabled
          ? 'pointer-events-none opacity-45'
          : 'hover:-translate-y-[2px] hover:border-[var(--c-wine-400)] hover:shadow-[var(--c-shadow-sm)] motion-reduce:hover:translate-y-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--c-soft-wine-bg)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--c-wine-500)_16%,var(--c-surface))]">
        <PenLine className="h-[18px] w-[18px] text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-[var(--c-ink)]">Criar flashcard</span>
        <span className="block text-[11.5px] leading-snug text-[var(--c-muted)]">
          Escreva frente e verso, adicione imagens e organize por deck
        </span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-[var(--c-muted-2)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--c-wine-500)]"
        aria-hidden
      />
    </button>
  );

  return (
    <FlashcardPanel
      icon={Plus}
      title="Criar"
      subtitle="Gere com IA ou monte do seu jeito"
      aria-label="Criar"
    >
      <div className="flex flex-1 flex-col gap-3">
        {/* ── Gerar com Prof. San (IA) — destaque ── */}
        <button
          type="button"
          onClick={onGenerate}
          aria-label="Gerar vários flashcards com Prof. San (IA)"
          className={cn(
            'group relative flex flex-1 flex-col overflow-hidden rounded-[var(--c-radius-card)] border p-3.5 text-left',
            'border-amber-400/40 bg-gradient-to-br from-amber-50 via-[var(--c-surface)] to-[var(--c-surface)]',
            'dark:from-amber-500/[0.12] dark:via-[var(--c-surface)] dark:to-[var(--c-surface)]',
            'transition-all duration-200',
            'hover:-translate-y-[2px] hover:border-amber-400 hover:shadow-[0_14px_34px_-16px_rgba(245,158,11,0.55)] motion-reduce:hover:translate-y-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2',
          )}
        >
          {/* glow decorativo */}
          <span
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-400/20 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
            aria-hidden
          />

          <div className="relative flex items-start gap-3.5">
            <span className="relative shrink-0">
              <span className="flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full ring-2 ring-amber-300/60">
                <ProfSanorAvatar size={52} className="!block" />
              </span>
              <span
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--c-surface)] bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm"
                aria-hidden
              >
                <Wand2 className="h-2.5 w-2.5 text-white" aria-hidden />
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-[var(--c-ink)]">Gerar com Prof. San</h3>
                <span className="rounded-[var(--c-radius-pill)] bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                  IA
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--c-muted)]">
                Monte vários flashcards de uma vez. Diga um tema ou parta dos seus erros — o Prof. San escreve frente e verso por você.
              </p>
            </div>
          </div>

          {/* chips de origem */}
          <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-[var(--c-muted-2)]">a partir de</span>
            {GENERATE_SOURCES.map((src) => (
              <span
                key={src}
                className="rounded-[var(--c-radius-pill)] border border-amber-400/30 bg-amber-500/[0.07] px-2 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-300"
              >
                {src}
              </span>
            ))}
          </div>

          {/* CTA */}
          <span
            className={cn(
              'relative mt-3 flex items-center justify-center gap-2 self-stretch rounded-[var(--c-radius-control)] px-4 py-2',
              'bg-gradient-to-r from-amber-400 to-amber-500 text-[13px] font-bold text-white',
              'shadow-[0_8px_20px_-8px_rgba(245,158,11,0.65)] transition-all duration-200',
              'group-hover:shadow-[0_12px_26px_-8px_rgba(245,158,11,0.75)]',
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Gerar flashcards
          </span>
        </button>

        {/* ── Criar manual ── */}
        {createDisabled ? (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span className="block cursor-not-allowed" tabIndex={0}>
                {createButton}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Selecione um deck para adicionar um flashcard</TooltipContent>
          </Tooltip>
        ) : (
          createButton
        )}
      </div>
    </FlashcardPanel>
  );
}
