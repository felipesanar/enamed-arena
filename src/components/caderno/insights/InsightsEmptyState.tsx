/**
 * InsightsEmptyState — estado vazio quando has_sufficient_data = false.
 *
 * Exibe mensagem amigável (da API ou padrão) + CTA para revisar mais questões.
 */

import { Link } from 'react-router-dom';
import { BookOpen, Microscope } from 'lucide-react';

interface InsightsEmptyStateProps {
  /** Mensagem retornada pelo backend (ou null para exibir o padrão). */
  message?: string | null;
  /** Contagem atual de entradas no caderno. */
  entryCount?: number;
}

export function InsightsEmptyState({ message, entryCount = 0 }: InsightsEmptyStateProps) {
  const needed = Math.max(0, 5 - entryCount);
  const defaultMessage =
    needed > 0
      ? `Insights disponíveis a partir de 5 erros no caderno. Adicione mais ${needed} ${needed === 1 ? 'questão' : 'questões'} para ativar o diagnóstico.`
      : 'Adicione questões ao caderno para receber um diagnóstico personalizado do Prof. San.';

  const displayMessage = message || defaultMessage;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Insights indisponíveis — dados insuficientes"
      className="flex flex-col items-center gap-5 rounded-3xl border-2 border-dashed border-primary/20 bg-primary/[0.03] px-8 py-14 text-center"
    >
      {/* Ilustração */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60">
        <Microscope className="h-10 w-10 text-primary/50" aria-hidden />
        <span
          aria-hidden
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold text-muted-foreground"
        >
          {entryCount}/5
        </span>
      </div>

      {/* Título */}
      <div className="space-y-2 max-w-sm">
        <h3 className="text-heading-3 font-bold text-foreground">
          Diagnóstico em construção
        </h3>
        <p className="text-body text-muted-foreground leading-relaxed">{displayMessage}</p>
      </div>

      {/* Progresso visual */}
      {entryCount < 5 && (
        <div className="w-full max-w-xs">
          <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Progresso</span>
            <span className="tabular-nums font-semibold">{entryCount} / 5</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={entryCount}
            aria-valuemax={5}
            aria-label={`${entryCount} de 5 questões necessárias para ativar insights`}
          >
            <div
              className="h-full rounded-full bg-primary/50 transition-all duration-700"
              style={{ width: `${(entryCount / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      <Link
        to="/caderno"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground no-underline shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200 hover:bg-wine-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]"
      >
        <BookOpen className="h-4 w-4" aria-hidden />
        Revisar questões do caderno
      </Link>
    </div>
  );
}
