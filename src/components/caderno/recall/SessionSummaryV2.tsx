/**
 * SessionSummaryV2
 *
 * Post-session statistics screen — Phase 1 only (no AI insight, see spec §5).
 * Shows: dominated / scheduled / remaining / time / top-areas.
 * CTAs: Voltar ao caderno · Treinar mais um simulado · Continuar revisão (if remaining > 0).
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionStats } from '@/hooks/useActiveRecallSession';

interface SessionSummaryV2Props {
  stats: SessionStats;
  remainingCount: number;
  onContinue?: () => void;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <div className={cn('text-[20px] font-extrabold leading-none tracking-[-0.02em] tabular-nums', accent)}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/55">
        {label}
      </div>
    </div>
  );
}

export function SessionSummaryV2({ stats, remainingCount, onContinue }: SessionSummaryV2Props) {
  const { dominated, scheduled, startedAt, areaMap, initialTotal } = stats;
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
  const reviewed = dominated + scheduled;
  const completionPct = initialTotal === 0 ? 0 : Math.round((reviewed / initialTotal) * 100);

  const topAreas = Array.from(areaMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Hero card */}
      <div className="hero-status-card relative overflow-hidden rounded-2xl p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-primary/10 blur-[60px] dark:bg-[rgba(232,56,98,0.16)]"
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-success border border-success/25">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Sessão concluída
          </div>

          <h2 className="mt-3 text-heading-1 text-white tracking-[-0.015em]">
            {dominated > 0 ? 'Mandou bem!' : 'Sessão encerrada.'}
          </h2>
          <p className="mt-1 text-body text-white/65">
            {dominated > 0
              ? `Você dominou ${dominated} ${dominated === 1 ? 'questão' : 'questões'} em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`
              : 'Continue revisando — cada sessão conta.'}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Dominadas" value={dominated} accent="text-success" />
            <Stat label="Agendadas" value={scheduled} accent="text-orange-300" />
            <Stat label="Restantes" value={remainingCount} accent="text-white" />
            <Stat label="Tempo" value={`${minutes}m`} accent="text-white/80" />
          </div>

          {initialTotal > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-[11px] text-white/60">
                <span>{completionPct}% da meta da sessão</span>
                <span className="tabular-nums">
                  {reviewed}/{initialTotal}
                </span>
              </div>
              <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8E1F3D_0%,#E83862_100%)]"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top areas */}
      {topAreas.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
            Áreas trabalhadas nesta sessão
          </p>
          <div className="mt-3 space-y-2">
            {topAreas.map(([area, count]) => (
              <div key={area} className="flex items-center justify-between">
                <span className="text-body-sm font-semibold text-foreground truncate pr-3">
                  {area}
                </span>
                <span className="inline-flex items-center gap-1 text-caption font-bold text-success tabular-nums">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          to="/caderno"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted no-underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao caderno
        </Link>

        <div className="flex items-center gap-2">
          {remainingCount > 0 && onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Continuar revisão ({remainingCount} restantes)
            </button>
          )}
          <Link
            to="/simulados"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all hover:bg-wine-hover no-underline"
          >
            <Zap className="h-4 w-4" aria-hidden />
            Treinar mais um simulado
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
