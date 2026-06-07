/**
 * InsightsEmptyState — estado vazio quando has_sufficient_data = false.
 *
 * Exibe mensagem amigável (da API ou padrão) + barra de progresso
 * + CTA para revisar mais questões.
 *
 * Design: clínico premium — borda dashed wine/20, ícone contextual,
 * progress bar gradiente wine, CTA primário com shadow glow.
 */

import { Link } from 'react-router-dom';
import { BookOpen, Microscope } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightsEmptyStateProps {
  /** Mensagem retornada pelo backend (ou null para exibir o padrão). */
  message?: string | null;
  /** Contagem atual de entradas no caderno. */
  entryCount?: number;
}

export function InsightsEmptyState({ message, entryCount = 0 }: InsightsEmptyStateProps) {
  const needed = Math.max(0, 5 - entryCount);
  const pct = Math.min(100, Math.round((entryCount / 5) * 100));

  const defaultMessage =
    needed > 0
      ? `O diagnóstico fica disponível a partir de 5 erros registrados. Adicione mais ${needed} ${needed === 1 ? 'questão' : 'questões'} para ativar a análise.`
      : 'Adicione questões ao caderno para receber um diagnóstico personalizado do Prof. San.';

  const displayMessage = message || defaultMessage;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Diagnóstico indisponível: ainda faltam dados"
      className={cn(
        'flex flex-col items-center gap-6',
        'rounded-[var(--c-radius-card)] border-2 border-dashed border-primary/20',
        'bg-primary/[0.025] px-8 py-14 text-center',
      )}
    >
      {/* Ícone */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--c-surface-2)]">
        <Microscope className="h-10 w-10 text-primary/40" aria-hidden />
        <span
          aria-hidden
          className={cn(
            'absolute -right-1.5 -top-1.5',
            'flex h-6 w-auto min-w-[24px] items-center justify-center rounded-full px-1.5',
            'border border-border bg-[var(--c-surface)]',
            'text-[10px] font-bold tabular-nums text-muted-foreground',
          )}
        >
          {entryCount}/5
        </span>
      </div>

      {/* Texto */}
      <div className="space-y-2 max-w-sm">
        <h3 className="text-heading-3 font-bold text-foreground">
          Diagnóstico em construção
        </h3>
        <p className="text-body text-muted-foreground leading-relaxed">{displayMessage}</p>
      </div>

      {/* Barra de progresso */}
      {entryCount < 5 && (
        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="font-medium">Progresso</span>
            <span className="tabular-nums font-bold">{entryCount} / 5</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]"
            role="progressbar"
            aria-valuenow={entryCount}
            aria-valuemax={5}
            aria-label={`${entryCount} de 5 questões necessárias para ativar insights`}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, hsl(345 65% 42%), hsl(345 65% 30%))',
              }}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      <Link
        to="/caderno"
        className={cn(
          'inline-flex items-center gap-2 rounded-xl',
          'bg-primary px-5 py-2.5',
          'text-[13px] font-semibold text-primary-foreground no-underline',
          'shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)]',
          'transition-all duration-200',
          'hover:brightness-110',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'active:scale-[0.985]',
        )}
      >
        <BookOpen className="h-4 w-4" aria-hidden />
        Revisar questões do caderno
      </Link>
    </div>
  );
}
