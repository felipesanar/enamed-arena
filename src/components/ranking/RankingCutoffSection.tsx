import React from 'react';
import { Link } from 'react-router-dom';
import { Target, HelpCircle, ChevronRight } from 'lucide-react';
import type { ApprovalEntry } from '@/lib/ranking-approval';
import { useCutoffScope } from '@/hooks/useCutoffContext';

export type ApprovalPanelState = 'no_profile' | 'loading' | 'ready';

interface Props {
  state: ApprovalPanelState;
  entries: ApprovalEntry[];
  userScore: number | null;
  onOpenCutoffTable: () => void;
}

/** Historical thresholds are informational, not comparable score scales. */
export function RankingCutoffSection({ state, entries, onOpenCutoffTable }: Props) {
  const { cutoffContext } = useCutoffScope();
  const references = [...new Set((cutoffContext?.matches ?? []).map(match =>
    `${match.reference_label || 'Referência indisponível'} · ${match.source || 'Fonte indisponível'}`))];
  const referenceDescription = references.length ? references.join('; ') : 'Referência indisponível · Fonte indisponível';
  // ── Sem perfil ────────────────────────────────────────────────────────────
  if (state === 'no_profile') {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent">
          <Target className="h-[18px] w-[18px] text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-foreground">Você passaria?</p>
          <p className="text-caption text-muted-foreground">
            Defina sua especialidade e instituições-alvo para comparar sua nota com as notas de corte.
          </p>
        </div>
        <Link
          to="/configuracoes"
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-2 text-caption font-semibold text-white transition-colors hover:bg-wine-hover"
        >
          Completar perfil <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    );
  }

  // ── Carregando ──────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 h-4 w-44 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  // ── Pronto ────────────────────────────────────────────────────────────────
  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-card"
      aria-label="Sua nota comparada às notas de corte"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <Target className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-micro-label uppercase tracking-wider text-muted-foreground">Notas de corte</p>
          <p className="text-body-sm font-semibold text-foreground">{referenceDescription}</p>
        </div>
      </div>

      {/* Referência por instituição */}
      <ul className="divide-y divide-border px-5">
        {entries.map((e) => {
          if (e.status === 'unavailable') {
            return (
              <li key={e.institutionId} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate text-body-sm text-foreground">{e.institutionName}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden /> corte indisponível
                </span>
              </li>
            );
          }

          return (
            <li key={e.institutionId} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 truncate text-body-sm text-foreground">{e.institutionName}</p>
                <p className="text-caption text-muted-foreground tabular-nums">corte {e.cutoffGeneral}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-2.5">
        <span className="text-micro-label text-muted-foreground">
          Escalas podem diferir; não indica chance de aprovação.
        </span>
        <button
          type="button"
          onClick={onOpenCutoffTable}
          className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline underline-offset-2"
        >
          Ver tabela completa <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
