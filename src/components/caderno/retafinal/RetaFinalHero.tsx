/**
 * RetaFinalHero — War Room ENAMED (redesign premium v2).
 *
 * Desktop: hero landscape — countdown grande à esquerda, ProgressRing à direita,
 *          3 stat tiles embaixo.
 * Mobile:  hero compacto vertical — countdown, progress bar, stat tiles scrolláveis.
 *
 * Contrato de apresentação: só recebe props de dados, nenhuma lógica de negócio.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Target, AlertCircle, CalendarCheck, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressRing, ProgressBar } from '@/components/caderno/ui';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { RetaFinalStats } from '@/lib/retaFinalPlan';

interface RetaFinalHeroProps {
  daysUntil: number;
  stats: RetaFinalStats;
  className?: string;
}

function pluralize(n: number, s: string, p: string) {
  return n === 1 ? s : p;
}

// ─── Chip de stat interno ────────────────────────────────────────────────────

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueClass?: string;
}

function StatChip({ icon, label, value, valueClass }: StatChipProps) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-[var(--c-radius-control)] border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-center">
      <div className="text-white/35">{icon}</div>
      <span
        className={cn(
          'text-[22px] font-extrabold leading-none tabular-nums tracking-[-0.04em] md:text-[26px]',
          valueClass ?? 'text-white',
        )}
      >
        {value}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/35">
        {label}
      </span>
    </div>
  );
}

// ─── Versão desktop ──────────────────────────────────────────────────────────

function HeroDesktop({ daysUntil, stats, className }: RetaFinalHeroProps) {
  const shouldReduce = useReducedMotion();
  const total = stats.totalActive + stats.mastered;
  const progressPct = total === 0 ? 0 : Math.round((stats.mastered / total) * 100);

  return (
    <div
      className={cn(
        'caderno-root relative overflow-hidden rounded-[var(--c-radius-card)]',
        'bg-[radial-gradient(ellipse_150%_110%_at_0%_0%,hsl(345_65%_20%)_0%,hsl(240_25%_9%)_55%,hsl(222_28%_7%)_100%)]',
        'border border-white/[0.07]',
        className,
      )}
      aria-label="Painel da Reta Final ENAMED"
    >
      {/* Atmospheric blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[color-mix(in_srgb,var(--c-wine-500)_18%,transparent)] blur-[80px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 right-0 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--c-wine-700)_12%,transparent)] blur-[56px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
      />

      <div className="relative z-10 p-8">
        {/* Top row: countdown + progress ring */}
        <div className="flex items-start justify-between gap-6">
          {/* Left: eyebrow + countdown */}
          <div className="flex-1">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--c-wine-400)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-wine-300)]">
              <Target className="h-3 w-3" aria-hidden />
              Reta Final ENAMED
            </span>

            <motion.div
              initial={shouldReduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {daysUntil > 0 ? (
                <div className="space-y-1">
                  <p className="text-[13px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                    Faltam
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-[72px] font-extrabold leading-none tabular-nums tracking-[-0.05em] text-white">
                      {daysUntil}
                    </span>
                    <span className="text-[22px] font-bold leading-tight text-white/60">
                      {pluralize(daysUntil, 'dia', 'dias')}<br />
                      <span className="text-[14px] font-semibold text-white/40">para o ENAMED</span>
                    </span>
                  </div>
                  <p className="text-[12px] text-white/40 mt-1">
                    Seu plano de revisão está pronto. Foco total agora.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[36px] font-extrabold leading-tight text-white">
                    Boa sorte na prova!
                  </p>
                  <p className="mt-1 text-[13px] text-white/40">
                    Você chegou até aqui. Confie no seu preparo.
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right: ProgressRing */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <ProgressRing
              value={progressPct}
              size={108}
              strokeWidth={7}
              aria-label={`${progressPct}% do caderno dominado`}
            >
              <div className="flex flex-col items-center">
                <span className="text-[24px] font-extrabold leading-none tabular-nums text-white">
                  {progressPct}%
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white/40 mt-0.5">
                  dominado
                </span>
              </div>
            </ProgressRing>
            <p className="text-[11px] text-white/35 tabular-nums text-center">
              {stats.mastered}/{total} questões
            </p>
          </div>
        </div>

        {/* Progress bar (covered / active) */}
        <div className="mt-6 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-white/40">
              Cobertura do plano
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-white/55">
              {stats.covered} cobertos · {stats.uncovered > 0 && (
                <span style={{ color: 'color-mix(in srgb, var(--c-warning) 70%, transparent)' }}>{stats.uncovered} descobertos</span>
              )}
            </span>
          </div>
          <ProgressBar
            value={total === 0 ? 0 : Math.round((stats.covered / (stats.covered + stats.uncovered || 1)) * 100)}
            label={`${stats.covered} questões cobertas pelo plano`}
            className="h-[5px] bg-white/[0.08]"
          />
        </div>

        {/* Stats chips */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatChip
            icon={<AlertCircle className="h-3.5 w-3.5" aria-hidden />}
            label={pluralize(stats.overdue, 'Vencida', 'Vencidas')}
            value={stats.overdue}
            valueClass="text-orange-300"
          />
          <StatChip
            icon={<CalendarCheck className="h-3.5 w-3.5" aria-hidden />}
            label="No plano"
            value={stats.covered}
            valueClass="text-emerald-300"
          />
          <StatChip
            icon={<Trophy className="h-3.5 w-3.5" aria-hidden />}
            label="Dominadas"
            value={stats.mastered}
            valueClass="text-[var(--c-wine-300)]"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Versão mobile ───────────────────────────────────────────────────────────

function HeroMobile({ daysUntil, stats, className }: RetaFinalHeroProps) {
  const shouldReduce = useReducedMotion();
  const total = stats.totalActive + stats.mastered;
  const progressPct = total === 0 ? 0 : Math.round((stats.mastered / total) * 100);
  const coverPct = total === 0 ? 0 : Math.round((stats.covered / (stats.covered + stats.uncovered || 1)) * 100);

  return (
    <div
      className={cn(
        'caderno-root relative overflow-hidden rounded-[var(--c-radius-card)]',
        'bg-[radial-gradient(ellipse_180%_120%_at_0%_0%,hsl(345_65%_20%)_0%,hsl(240_25%_9%)_55%,hsl(222_28%_7%)_100%)]',
        'border border-white/[0.07]',
        className,
      )}
      aria-label="Painel da Reta Final ENAMED"
    >
      {/* Atmospheric blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[color-mix(in_srgb,var(--c-wine-500)_18%,transparent)] blur-[64px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
      />

      <div className="relative z-10 p-5">
        {/* Eyebrow */}
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--c-wine-400)_30%,transparent)] bg-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--c-wine-300)]">
          <Target className="h-2.5 w-2.5" aria-hidden />
          Reta Final ENAMED
        </span>

        {/* Countdown row */}
        <motion.div
          className="flex items-end justify-between gap-4"
          initial={shouldReduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            {daysUntil > 0 ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                  Faltam
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-[52px] font-extrabold leading-none tabular-nums tracking-[-0.04em] text-white">
                    {daysUntil}
                  </span>
                  <span className="text-[16px] font-semibold text-white/55">
                    {pluralize(daysUntil, 'dia', 'dias')}
                  </span>
                </div>
                <p className="text-[11px] text-white/35">para o ENAMED</p>
              </>
            ) : (
              <p className="text-[22px] font-extrabold text-white leading-tight">
                Boa sorte<br />na prova!
              </p>
            )}
          </div>

          {/* Compact ring */}
          <ProgressRing
            value={progressPct}
            size={72}
            strokeWidth={5}
            aria-label={`${progressPct}% dominado`}
          >
            <div className="flex flex-col items-center">
              <span className="text-[16px] font-extrabold leading-none tabular-nums text-white">
                {progressPct}%
              </span>
            </div>
          </ProgressRing>
        </motion.div>

        {/* Coverage bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-[10px] text-white/35">
            <span>Cobertura do plano</span>
            <span className="tabular-nums">{stats.covered}/{stats.totalActive} questões</span>
          </div>
          <ProgressBar
            value={coverPct}
            label={`${stats.covered} questões cobertas`}
            className="h-[4px] bg-white/[0.08]"
          />
        </div>

        {/* Stats chips — scrollável horizontal */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <StatChip
            icon={<AlertCircle className="h-3 w-3" aria-hidden />}
            label={pluralize(stats.overdue, 'Vencida', 'Vencidas')}
            value={stats.overdue}
            valueClass="text-orange-300"
          />
          <StatChip
            icon={<CalendarCheck className="h-3 w-3" aria-hidden />}
            label="No plano"
            value={stats.covered}
            valueClass="text-emerald-300"
          />
          <StatChip
            icon={<Trophy className="h-3 w-3" aria-hidden />}
            label="Dominadas"
            value={stats.mastered}
            valueClass="text-[var(--c-wine-300)]"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Export adaptativo ───────────────────────────────────────────────────────

export function RetaFinalHero({ daysUntil, stats, className }: RetaFinalHeroProps) {
  const isMobile = useIsMobile();
  return isMobile
    ? <HeroMobile daysUntil={daysUntil} stats={stats} className={className} />
    : <HeroDesktop daysUntil={daysUntil} stats={stats} className={className} />;
}
