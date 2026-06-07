import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { pluralize } from './helpers';
import { StatLegend } from './StatLegend';

/* ──────────────────────────────────────────────────────────────────────────
 * HeroStatusCard — bloco dark premium, idioma da HomeHeroPerformanceCard
 * ────────────────────────────────────────────────────────────────────────── */

export function HeroStatusCard({
  pending,
  resolved,
  total,
  specialties,
  streak,
  prefersReducedMotion,
}: {
  pending: number;
  resolved: number;
  total: number;
  specialties: number;
  streak: number;
  prefersReducedMotion: boolean;
}) {
  const progressPct = total === 0 ? 0 : Math.round((resolved / total) * 100);

  return (
    <div className="hero-status-card">
      {/* Atmospheric layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-primary/10 blur-[60px] dark:bg-[rgba(232,56,98,0.16)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-primary/5 blur-[40px] dark:bg-[rgba(12,18,32,0.55)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_18%_12%,rgba(255,255,255,0.08)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
      />

      <div className="relative z-10">
        {/* Top row: eyebrow + title + streak */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(249,168,212,0.9)]">
              Revisão ativa
            </p>
            <p className="mt-1 text-[18px] font-bold leading-tight tracking-[-0.015em] text-white md:text-[20px]">
              Seu progresso no Caderno
            </p>
          </div>

          {streak > 0 && (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2">
              <Flame className="h-4 w-4 text-orange-400" aria-hidden />
              <div className="text-right">
                <div className="text-[15px] font-extrabold leading-none tracking-[-0.02em] text-orange-300 tabular-nums">
                  {streak}
                </div>
                <div className="text-[9px] font-medium uppercase tracking-wide text-white/45">
                  dias
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar — protagonista visual */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-medium text-white/65">
              {resolved} de {total} {pluralize(total, 'resolvida', 'resolvidas')}
            </span>
            <span className="text-[15px] font-extrabold tabular-nums text-white tracking-[-0.02em]">
              {progressPct}%
            </span>
          </div>
          <div
            className="mt-2 h-[6px] overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-valuenow={resolved}
            aria-valuemax={total}
            aria-label={`${resolved} de ${total} questões resolvidas`}
          >
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,#8E1F3D_0%,#E83862_100%)]"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.8,
                ease: 'easeOut',
                delay: prefersReducedMotion ? 0 : 0.15,
              }}
            />
          </div>

          {/* Legenda compacta — métricas como apoio, sem repetição */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
            <StatLegend
              label={pluralize(pending, 'pendente', 'pendentes')}
              value={pending}
              dotClass="bg-orange-400"
              valueClass="text-orange-300"
            />
            <StatLegend
              label={pluralize(resolved, 'resolvida', 'resolvidas')}
              value={resolved}
              dotClass="bg-emerald-400"
              valueClass="text-emerald-300"
            />
            <span className="text-white/45">·</span>
            <span className="text-white/65">
              <span className="font-bold tabular-nums text-white">{specialties}</span>{' '}
              {pluralize(specialties, 'especialidade', 'especialidades')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
