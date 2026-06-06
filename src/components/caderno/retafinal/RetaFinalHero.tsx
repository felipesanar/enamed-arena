/**
 * RetaFinalHero — hero do War Room ENAMED.
 *
 * Exibe:
 *   - Contagem regressiva "Faltam N dias para o ENAMED"
 *   - Progresso geral (dominadas / total ativo)
 *   - Stats: vencidas hoje, cobertas pelo plano, descobertas
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Target, AlertCircle, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RetaFinalStats } from '@/lib/retaFinalPlan';

interface RetaFinalHeroProps {
  daysUntil: number;
  stats: RetaFinalStats;
  className?: string;
}

function pluralize(n: number, s: string, p: string) {
  return n === 1 ? s : p;
}

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueClass?: string;
}

function StatChip({ icon, label, value, valueClass }: StatChipProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-center">
      <div className="mb-0.5 text-white/40">{icon}</div>
      <span
        className={cn(
          'text-[24px] font-extrabold leading-none tabular-nums tracking-[-0.04em]',
          valueClass ?? 'text-white',
        )}
      >
        {value}
      </span>
      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/40">
        {label}
      </span>
    </div>
  );
}

export function RetaFinalHero({ daysUntil, stats, className }: RetaFinalHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const total = stats.totalActive + stats.mastered;
  const progressPct = total === 0 ? 0 : Math.round((stats.mastered / total) * 100);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[22px]',
        'bg-[radial-gradient(ellipse_140%_90%_at_0%_0%,hsl(345_65%_22%)_0%,hsl(225_25%_10%)_60%,hsl(222_28%_8%)_100%)]',
        'border border-white/[0.06] p-7',
        className,
      )}
      aria-label="Painel da Reta Final ENAMED"
    >
      {/* Atmospheric decorative layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-14 -top-14 h-56 w-56 rounded-full bg-primary/20 blur-[72px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-primary/10 blur-[48px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent"
      />

      <div className="relative z-10 space-y-5">
        {/* Eyebrow */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary mb-2">
              <Target className="h-2.5 w-2.5" aria-hidden />
              War Room ENAMED
            </span>
            <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-white md:text-[26px]">
              {daysUntil > 0 ? (
                <>
                  Faltam{' '}
                  <span className="text-primary tabular-nums">{daysUntil}</span>{' '}
                  {pluralize(daysUntil, 'dia', 'dias')} para o ENAMED
                </>
              ) : (
                'Boa sorte na prova!'
              )}
            </h2>
            <p className="mt-1 text-[12px] text-white/50">
              {daysUntil > 0
                ? 'Seu plano de revisão está pronto. Foco total agora.'
                : 'Você chegou até aqui. Confie no seu preparo.'}
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2.5">
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
            icon={<Target className="h-3.5 w-3.5" aria-hidden />}
            label="Ativas"
            value={stats.totalActive}
          />
        </div>

        {/* Barra de progresso de domínio */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-white/50">Questões dominadas</span>
            <span className="text-[12px] font-bold tabular-nums text-white/80">
              {stats.mastered} / {total}
            </span>
          </div>
          <div
            className="h-[6px] overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-valuenow={stats.mastered}
            aria-valuemax={total}
            aria-label={`${stats.mastered} de ${total} questões dominadas — ${progressPct}%`}
          >
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,hsl(345_65%_30%)_0%,hsl(345_65%_55%)_100%)]"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.9,
                ease: 'easeOut',
                delay: prefersReducedMotion ? 0 : 0.2,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-white/35 tabular-nums">
            {progressPct}% do caderno dominado
            {stats.uncovered > 0 && (
              <span className="ml-2 text-orange-300/70">
                · {stats.uncovered}{' '}
                {pluralize(stats.uncovered, 'questão não', 'questões não')} caberá antes da prova
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
