/**
 * FlashcardPanel — casca dos blocos "Estudar" e "Criar".
 *
 * Card branco com cabeçalho (ícone-chip + título + subtítulo) e corpo flexível.
 * Usado lado a lado em CadernoFlashcardsPage para dividir as ações em dois blocos.
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FlashcardPanelProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Conteúdo opcional alinhado à direita do cabeçalho (ex.: contador). */
  headerAside?: ReactNode;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function FlashcardPanel({
  icon: Icon,
  title,
  subtitle,
  headerAside,
  children,
  className,
  'aria-label': ariaLabel,
}: FlashcardPanelProps) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className={cn(
        'flex flex-col rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)]',
        'p-4 shadow-[var(--c-shadow-sm)] sm:p-5',
        className,
      )}
    >
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--c-soft-wine-bg)]">
          <Icon className="h-[18px] w-[18px] text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold leading-tight text-[var(--c-ink)]">{title}</h2>
          <p className="truncate text-[11.5px] leading-tight text-[var(--c-muted)]">{subtitle}</p>
        </div>
        {headerAside && <div className="shrink-0">{headerAside}</div>}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}
