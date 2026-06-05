import { Check, Flame, RotateCcw } from 'lucide-react';
import { pluralize } from './helpers';

/* ──────────────────────────────────────────────────────────────────────────
 * ZeroPendingCard — tudo resolvido, momento de expressão contido
 * ────────────────────────────────────────────────────────────────────────── */

export function ZeroPendingCard({
  resolvedCount,
  streak,
  onShowResolved,
}: {
  resolvedCount: number;
  streak: number;
  onShowResolved: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-success/20 bg-gradient-to-br from-success/[0.06] via-card to-card p-8 text-center shadow-[0_12px_32px_-20px_hsl(152_60%_36%/0.3)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-success/[0.08] blur-3xl"
      />
      <div className="relative">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-success/30 bg-success/10">
          <Check className="h-7 w-7 text-success" strokeWidth={2.5} aria-hidden />
        </div>
        <h3 className="text-heading-2 text-foreground">Caderno zerado 🎯</h3>
        <p className="mx-auto mt-2 max-w-sm text-body-sm leading-relaxed text-muted-foreground">
          Você revisou e resolveu todas as questões. Esse é o nível que separa aprovados de reprovados.
        </p>

        <div className="mt-5 flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-[28px] font-extrabold leading-none tracking-[-0.03em] text-success tabular-nums">
              {resolvedCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {pluralize(resolvedCount, 'resolvida', 'resolvidas')}
            </div>
          </div>
          {streak > 0 && (
            <div className="text-center">
              <div className="inline-flex items-baseline gap-1 text-[28px] font-extrabold leading-none tracking-[-0.03em] text-orange-500 tabular-nums">
                <Flame className="h-6 w-6" aria-hidden />
                {streak}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {pluralize(streak, 'dia de streak', 'dias de streak')}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onShowResolved}
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Ver questões resolvidas
        </button>
      </div>
    </div>
  );
}
