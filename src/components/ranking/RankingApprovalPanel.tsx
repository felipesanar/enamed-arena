import React from 'react';
import { Link } from 'react-router-dom';
import { Target, ChevronRight, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApprovalEntry } from '@/lib/ranking-approval';

export type ApprovalPanelState = 'no_profile' | 'loading' | 'ready';

interface Props {
  state: ApprovalPanelState;
  entries: ApprovalEntry[];
  userScore: number | null;
  /** Abre o CutoffScoreModal (tabela completa). */
  onOpenCutoffTable: () => void;
}

/** Posição (0-100%) na régua, com folga nas bordas para os labels. */
function clampPct(v: number): number {
  return Math.max(3, Math.min(97, v));
}

export function RankingApprovalPanel({ state, entries, userScore, onOpenCutoffTable }: Props) {
  if (state === 'loading') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 mb-5">
        <div className="h-4 w-48 rounded bg-muted animate-pulse mb-6" />
        <div className="h-2 rounded-full bg-muted animate-pulse mb-6" />
        <div className="space-y-2">
          <div className="h-9 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (state === 'no_profile') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
          <Target className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="text-body font-semibold text-foreground">Você passaria?</p>
          <p className="text-caption text-muted-foreground">
            Defina sua especialidade e instituições-alvo para comparar sua nota com as notas de corte.
          </p>
        </div>
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-caption font-semibold text-white hover:bg-wine-hover transition-colors shrink-0"
        >
          Completar perfil
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    );
  }

  const withCutoff = entries.filter((e) => e.cutoffGeneral != null);
  const reached = entries.filter((e) => e.status === 'pass').length;
  const verdictAvailable = userScore != null && withCutoff.length > 0;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 mb-5"
      aria-label="Sua nota comparada às notas de corte"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-overline uppercase text-muted-foreground">Você passaria?</p>
          <p className="text-heading-3 font-bold text-foreground">
            Sua nota vs. notas de corte
          </p>
        </div>
        {verdictAvailable && (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-caption font-semibold shrink-0',
              reached > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
            )}
          >
            {reached} de {withCutoff.length} instituiç{withCutoff.length === 1 ? 'ão' : 'ões'} alcançada{reached === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Régua 0–100 */}
      {verdictAvailable && (
        <div className="relative mx-1 mt-10 mb-12" aria-hidden>
          <div className="h-2 rounded-full bg-muted relative overflow-visible">
            <div
              className="absolute left-0 top-0 h-2 rounded-full bg-primary"
              style={{ width: `${clampPct(userScore!)}%` }}
            />
            <div
              className="absolute -top-1 h-4 w-1 rounded-full bg-primary"
              style={{ left: `${clampPct(userScore!)}%` }}
            />
            <span
              className="absolute -top-7 -translate-x-1/2 whitespace-nowrap text-caption font-semibold text-primary"
              style={{ left: `${clampPct(userScore!)}%` }}
            >
              Você · {userScore}%
            </span>
            {withCutoff.map((e, i) => (
              <React.Fragment key={e.institutionId}>
                <div
                  className={cn(
                    'absolute top-2 w-px h-3',
                    e.status === 'pass' ? 'bg-success' : 'bg-destructive',
                  )}
                  style={{ left: `${clampPct(e.cutoffGeneral!)}%` }}
                />
                <span
                  className={cn(
                    'absolute -translate-x-1/2 whitespace-nowrap text-micro-label',
                    e.status === 'pass' ? 'text-success' : 'text-destructive',
                    i % 2 === 0 ? 'top-6' : 'top-10',
                  )}
                  style={{ left: `${clampPct(e.cutoffGeneral!)}%` }}
                >
                  {shortName(e.institutionName)} {e.cutoffGeneral}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Lista por instituição */}
      <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {entries.map((e) => (
          <li key={e.institutionId} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-background">
            <span className="text-body-sm text-foreground truncate min-w-0">{e.institutionName}</span>
            {e.status === 'unavailable' ? (
              <span className="inline-flex items-center gap-1 text-caption text-muted-foreground shrink-0">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                corte indisponível
              </span>
            ) : (
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-caption text-muted-foreground tabular-nums">
                  corte {e.cutoffGeneral}%
                  {e.cutoffQuota != null && <> · cotas {e.cutoffQuota}%</>}
                </span>
                {e.status === 'pass' && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-caption font-semibold text-success tabular-nums">
                    +{e.gap} acima ✓
                  </span>
                )}
                {e.status === 'fail' && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-semibold text-destructive tabular-nums">
                    faltam {e.gap}
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      {verdictAvailable && reached === 0 && (
        <p className="mt-3 text-caption italic text-muted-foreground">
          {closestGap(entries) <= 5
            ? 'Você está muito perto do corte. Mais uma rodada focada e você chega lá!'
            : closestGap(entries) <= 15
              ? 'Você está no caminho certo. Cada simulado te aproxima do corte — continue com consistência.'
              : 'Toda aprovação começa exatamente aqui. A distância de hoje é o combustível de amanhã.'}
        </p>
      )}

      <button
        type="button"
        onClick={onOpenCutoffTable}
        className="mt-3 text-caption font-semibold text-primary hover:underline underline-offset-2"
      >
        Ver tabela completa de notas de corte →
      </button>
    </section>
  );
}

function closestGap(entries: ApprovalEntry[]): number {
  const gaps = entries.filter((e) => e.status === 'fail').map((e) => e.gap);
  return gaps.length ? Math.min(...gaps) : 0;
}

/** Nome curto para o label da régua (evita estourar em mobile). */
function shortName(name: string): string {
  if (name.length <= 18) return name;
  const acronymMatch = name.match(/\(([^)]+)\)/);
  if (acronymMatch) return acronymMatch[1];
  return `${name.slice(0, 16)}…`;
}
