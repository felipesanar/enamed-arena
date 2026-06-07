/**
 * CadernoHero — hero "dark wine" da página /caderno (Caderno de Erros v2).
 *
 * Substitui o header chapado. Reaproveita a base `.hero-status-card` (fundo
 * vinho escuro com variante dark) e eleva: anel de domínio + barra de progresso
 * protagonista, chips de streak e contagem ENAMED, legenda de KPIs e CTA
 * "Iniciar revisão" integrado. Respeita prefers-reduced-motion.
 */

import { motion } from 'framer-motion';
import { Flame, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CadernoHeroProps {
  total: number;
  dominadas: number;
  pending: number;
  devidasHoje: number;
  specialties: number;
  streak: number;
  daysLeft: number;
  isEnamedNear: boolean;
  prefersReducedMotion: boolean;
}

const RING_SIZE = 132;
const RING_STROKE = 11;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

function ProgressDial({
  pct,
  dominadas,
  total,
  prefersReducedMotion,
}: {
  pct: number;
  dominadas: number;
  total: number;
  prefersReducedMotion: boolean;
}) {
  const offset = RING_C - (pct / 100) * RING_C;
  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label={`${pct}% de domínio — ${dominadas} de ${total} questões dominadas`}
    >
      {/* Disco de fundo — separa o anel do gradiente do card */}
      <div
        aria-hidden
        className="absolute inset-[7px] z-0 rounded-full border border-white/10 bg-black/25 shadow-[inset_0_2px_14px_rgba(0,0,0,0.45)]"
      />
      <svg width={RING_SIZE} height={RING_SIZE} className="relative z-[1] -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="cadernoHeroRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="55%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={RING_STROKE}
        />
        {/* Progresso */}
        <motion.circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="url(#cadernoHeroRing)"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_C}
          initial={{ strokeDashoffset: prefersReducedMotion ? offset : RING_C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: prefersReducedMotion ? 0 : 1, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.2 }}
          style={{ filter: 'drop-shadow(0 0 7px rgba(52,211,153,0.55))' }}
        />
      </svg>
      <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center">
        <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
          {pct}
          <span className="text-[16px] font-bold text-white/55">%</span>
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-300/90">
          domínio
        </span>
      </div>
    </div>
  );
}

function Kpi({
  value,
  label,
  dotClass,
  valueClass,
}: {
  value: number;
  label: string;
  dotClass: string;
  valueClass: string;
}) {
  return (
    <div className="flex min-w-[68px] flex-col gap-1">
      <span className={cn('text-[22px] font-extrabold leading-none tabular-nums drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]', valueClass)}>
        {value}
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/70">
        <span className={cn('h-2 w-2 rounded-full', dotClass)} aria-hidden />
        {label}
      </span>
    </div>
  );
}

function KpiDivider() {
  return <span className="hidden h-9 w-px self-center bg-white/10 sm:block" aria-hidden />;
}

export function CadernoHero({
  total,
  dominadas,
  pending,
  devidasHoje,
  specialties,
  streak,
  daysLeft,
  isEnamedNear,
  prefersReducedMotion,
}: CadernoHeroProps) {
  const pct = total === 0 ? 0 : Math.round((dominadas / total) * 100);
  const enter = (delay: number) =>
    prefersReducedMotion
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: 'easeOut' as const, delay },
        };

  return (
    <section
      className="hero-status-card !rounded-[22px] !p-5 md:!px-7 md:!py-6"
      aria-label="Seu progresso no Caderno de Erros"
    >
      {/* Camadas atmosféricas */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[rgba(232,56,98,0.18)] blur-[70px]" />
      <div aria-hidden className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-[rgba(249,168,212,0.10)] blur-[55px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_15%_10%,rgba(255,255,255,0.07)_0%,transparent_55%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-7">
        {/* ── Coluna principal ── */}
        <div className="min-w-0 flex-1">
          <motion.div {...enter(0)} className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[rgba(249,168,212,0.9)]">
              Revisão ativa
            </p>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/[0.14] px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
                <Flame className="h-3 w-3" aria-hidden />
                {streak} {streak === 1 ? 'dia' : 'dias'}
              </span>
            )}
            {daysLeft > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold',
                  isEnamedNear
                    ? 'border-[rgba(249,168,212,0.4)] bg-[rgba(232,56,98,0.18)] text-white'
                    : 'border-white/10 bg-white/[0.06] text-white/70',
                )}
              >
                <Clock className="h-3 w-3" aria-hidden />
                ENAMED em {daysLeft}d
              </span>
            )}
          </motion.div>

          <motion.h1
            {...enter(0.06)}
            className="mt-1.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white md:text-[26px]"
          >
            Seu progresso no Caderno
          </motion.h1>
          <motion.p {...enter(0.1)} className="mt-1 max-w-xl text-[13px] leading-relaxed text-white/60">
            Revise suas questões organizadas por causa e especialidade — recall ativo com repetição espaçada.
          </motion.p>

          {/* Barra de progresso protagonista */}
          <motion.div {...enter(0.16)} className="mt-4 max-w-md">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-medium text-white/65">
                {dominadas} de {total} {total === 1 ? 'dominada' : 'dominadas'}
              </span>
              <span className="text-[13px] font-extrabold tabular-nums tracking-[-0.02em] text-white">{pct}%</span>
            </div>
            <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-white/[0.09]">
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,#8E1F3D_0%,#E83862_60%,#F9A8D4_100%)]"
                initial={{ width: prefersReducedMotion ? `${pct}%` : 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.9, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.25 }}
              />
            </div>
          </motion.div>

          {/* KPIs — faixa contida com acentos distintos por métrica */}
          <motion.div
            {...enter(0.22)}
            className="mt-4 inline-flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm"
          >
            <Kpi value={devidasHoje} label="devidas hoje" dotClass="bg-amber-400" valueClass="text-amber-300" />
            <KpiDivider />
            <Kpi value={pending} label="pendentes" dotClass="bg-sky-400" valueClass="text-sky-300" />
            <KpiDivider />
            <Kpi value={dominadas} label="dominadas" dotClass="bg-emerald-400" valueClass="text-emerald-300" />
            <KpiDivider />
            <Kpi
              value={specialties}
              label={specialties === 1 ? 'especialidade' : 'especialidades'}
              dotClass="bg-violet-400"
              valueClass="text-violet-300"
            />
          </motion.div>
        </div>

        {/* ── Anel de domínio ── */}
        <motion.div
          {...(prefersReducedMotion
            ? { initial: false as const }
            : { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.6, ease: 'easeOut', delay: 0.12 } })}
          className="mx-auto md:mx-0"
        >
          <ProgressDial pct={pct} dominadas={dominadas} total={total} prefersReducedMotion={prefersReducedMotion} />
        </motion.div>
      </div>
    </section>
  );
}
