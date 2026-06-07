/**
 * PageHero — hero dark do Caderno v2.
 *
 * Porta visual do sandbox (stats grid + ProgressBar + streak) + countdown ENAMED
 * da spec, re-acoplado ao design system Tailwind/wine do projeto.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Data do próximo ENAMED — atualizar por ciclo (dono: Conteúdo/Ops). */
export const ENAMED_DATE = new Date('2026-11-28T00:00:00-03:00');

function calcDaysUntilEnamed(): number {
  const now = new Date();
  const diff = ENAMED_DATE.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function pluralize(n: number, s: string, p: string) {
  return n === 1 ? s : p;
}

interface StatItemProps {
  label: string;
  value: number;
  valueClass?: string;
}

function StatItem({ label, value, valueClass }: StatItemProps) {
  return (
    <div className="text-center">
      <div
        className={cn(
          'text-[28px] font-extrabold leading-none tracking-[-0.04em] tabular-nums',
          valueClass ?? 'text-white',
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/45">
        {label}
      </div>
    </div>
  );
}

export interface PageHeroProps {
  pendingCount: number;
  resolvedCount: number;
  totalCount: number;
  specialtyCount: number;
  streak: number;
}

export function PageHero({
  pendingCount,
  resolvedCount,
  totalCount,
  specialtyCount,
  streak,
}: PageHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const progressPct = totalCount === 0 ? 0 : Math.round((resolvedCount / totalCount) * 100);
  const daysUntilEnamed = calcDaysUntilEnamed();

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[22px]',
        'bg-[radial-gradient(ellipse_140%_90%_at_0%_0%,hsl(345_65%_22%)_0%,hsl(225_25%_10%)_60%,hsl(222_28%_8%)_100%)]',
        'border border-white/[0.06] p-7',
      )}
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

      <div className="relative z-10">
        {/* Eyebrow + PRO badge */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <span className="inline-block rounded-full border border-primary/30 bg-primary/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary mb-2">
              PRO
            </span>
            <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-white md:text-[26px]">
              Caderno de Erros
            </h2>
            <p className="mt-1 text-[12px] text-white/50">
              Suas questões para dominar antes da prova.
            </p>
          </div>

          {/* Streak badge */}
          {streak > 0 && (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2">
              <Flame className="h-4 w-4 text-orange-400" aria-hidden />
              <div className="text-right">
                <div className="text-[16px] font-extrabold leading-none tracking-[-0.02em] text-orange-300 tabular-nums">
                  {streak}
                </div>
                <div className="text-[9px] font-medium uppercase tracking-wide text-white/45">
                  {pluralize(streak, 'dia', 'dias')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats grid — 4 columns */}
        <div className="mb-5 grid grid-cols-4 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <StatItem label="Pendentes" value={pendingCount} valueClass="text-orange-300" />
          <StatItem label="Resolvidas" value={resolvedCount} valueClass="text-emerald-300" />
          <StatItem label="Total" value={totalCount} />
          <StatItem
            label={pluralize(specialtyCount, 'Especialidade', 'Especialidades')}
            value={specialtyCount}
          />
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-white/50">Progresso</span>
            <span className="text-[12px] font-bold tabular-nums text-white/80">
              {resolvedCount} / {totalCount}
            </span>
          </div>
          <div
            className="h-[6px] overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-valuenow={resolvedCount}
            aria-valuemax={totalCount}
            aria-label={`${resolvedCount} de ${totalCount} questões resolvidas (${progressPct}%)`}
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
        </div>

        {/* Countdown ENAMED */}
        {daysUntilEnamed > 0 && (
          <p className="text-[11px] text-white/40">
            <span className="font-bold tabular-nums text-white/65">{daysUntilEnamed}</span>{' '}
            {pluralize(daysUntilEnamed, 'dia', 'dias')} para o ENAMED
          </p>
        )}
      </div>
    </div>
  );
}
