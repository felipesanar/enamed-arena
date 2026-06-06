/**
 * SessionSummaryV2 — Tela pós-sessão com stats celebratórios.
 *
 * Redesign premium:
 * - Hero com gradiente wine + glow.
 * - StatTile + ProgressRing para stats principais.
 * - Top áreas com barra de progresso proporcional.
 * - CTAs hierárquicos.
 */

import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ChevronRight, Zap, Trophy, Clock, BarChart2, RefreshCw } from 'lucide-react';
import { ProgressRing, ProgressBar } from '@/components/caderno/ui/ProgressRing';
import { cn } from '@/lib/utils';
import type { SessionStats } from '@/hooks/useActiveRecallSession';

interface SessionSummaryV2Props {
  stats: SessionStats;
  remainingCount: number;
  onContinue?: () => void;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

export function SessionSummaryV2({ stats, remainingCount, onContinue }: SessionSummaryV2Props) {
  const prefersReducedMotion = useReducedMotion();
  const { dominated, scheduled, startedAt, areaMap, initialTotal } = stats;
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
  const reviewed = dominated + scheduled;
  const completionPct = initialTotal === 0 ? 0 : Math.round((reviewed / initialTotal) * 100);
  const dominatedPct = reviewed === 0 ? 0 : Math.round((dominated / reviewed) * 100);

  const topAreas = Array.from(areaMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const maxAreaCount = topAreas[0]?.[1] ?? 1;

  const isGreatSession = dominated > 0 && dominatedPct >= 60;

  return (
    <motion.div
      className="caderno-root mx-auto max-w-2xl space-y-4"
      variants={prefersReducedMotion ? undefined : containerVariants}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="visible"
    >
      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <motion.div
        variants={prefersReducedMotion ? undefined : itemVariants}
        className="relative overflow-hidden rounded-[var(--c-radius-card)] p-6"
        style={{
          background: 'linear-gradient(135deg, var(--c-wine-700, #7A1A32) 0%, var(--c-wine-900, #3E0E1A) 100%)',
        }}
      >
        {/* Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-[72px]"
          style={{ background: 'radial-gradient(circle, rgba(176,41,74,.28), transparent 70%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full blur-[56px]"
          style={{ background: 'radial-gradient(circle, rgba(176,41,74,.18), transparent 70%)' }}
        />

        <div className="relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-[var(--c-radius-pill)] border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            {isGreatSession ? (
              <Trophy className="h-3 w-3" aria-hidden />
            ) : (
              <CheckCircle2 className="h-3 w-3" aria-hidden />
            )}
            Sessão concluída
          </div>

          {/* Heading */}
          <h2 className="mt-3 text-heading-1 font-extrabold tracking-[-0.02em] text-white">
            {dominated > 0
              ? isGreatSession
                ? 'Excelente sessão!'
                : 'Mandou bem!'
              : 'Sessão encerrada.'}
          </h2>
          <p className="mt-1 text-body text-white/65">
            {dominated > 0
              ? `Você dominou ${dominated} ${dominated === 1 ? 'questão' : 'questões'} em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`
              : 'Continue revisando — cada sessão conta.'}
          </p>

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Dominadas',
                value: dominated,
                color: '#4ade80',
                icon: CheckCircle2,
              },
              {
                label: 'Agendadas',
                value: scheduled,
                color: '#fb923c',
                icon: RefreshCw,
              },
              {
                label: 'Restantes',
                value: remainingCount,
                color: 'rgba(255,255,255,0.9)',
                icon: BarChart2,
              },
              {
                label: 'Tempo',
                value: `${minutes}m`,
                color: 'rgba(255,255,255,0.75)',
                icon: Clock,
              },
            ].map(({ label, value, color, icon: Icon }) => (
              <div
                key={label}
                className="flex flex-col gap-1.5 rounded-[var(--c-radius-control)] border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 opacity-60" style={{ color }} aria-hidden />
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/50">
                    {label}
                  </span>
                </div>
                <span
                  className="text-[22px] font-extrabold leading-none tabular-nums tracking-[-0.02em]"
                  style={{ color }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Completion progress */}
          {initialTotal > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-[11px] text-white/55">
                <span>{completionPct}% da meta da sessão</span>
                <span className="tabular-nums">
                  {reviewed}/{initialTotal}
                </span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${completionPct}%`,
                    background: 'linear-gradient(90deg, #B0294A 0%, #E83862 100%)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Accuracy ring + top areas ─────────────────────────────────────── */}
      {reviewed > 0 && (
        <motion.div
          variants={prefersReducedMotion ? undefined : itemVariants}
          className="grid gap-4 sm:grid-cols-[auto_1fr]"
        >
          {/* Accuracy ring */}
          <div className="flex flex-col items-center justify-center rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow-sm)] sm:w-[140px]">
            <ProgressRing
              value={dominatedPct}
              size={80}
              strokeWidth={7}
            >
              <span className="text-[18px] font-extrabold tabular-nums text-[var(--c-wine-500)]">
                {dominatedPct}%
              </span>
            </ProgressRing>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)] text-center">
              Taxa de domínio
            </p>
          </div>

          {/* Top areas */}
          {topAreas.length > 0 && (
            <div className="rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow-sm)]">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-muted)]">
                Áreas trabalhadas
              </p>
              <div className="space-y-3">
                {topAreas.map(([area, count]) => (
                  <div key={area}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="truncate pr-3 text-[12px] font-semibold text-[var(--c-ink)]">
                        {area}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-emerald-500 tabular-nums">
                        {count}
                      </span>
                    </div>
                    <ProgressBar
                      value={Math.round((count / maxAreaCount) * 100)}
                      className="h-[4px]"
                      label={`${area}: ${count} dominadas`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── CTAs ─────────────────────────────────────────────────────────── */}
      <motion.div
        variants={prefersReducedMotion ? undefined : itemVariants}
        className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <Link
          to="/caderno"
          className="inline-flex items-center justify-center gap-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--c-ink)] transition-all duration-150 hover:bg-[var(--c-surface-2)] no-underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao caderno
        </Link>

        <div className="flex items-center gap-2">
          {remainingCount > 0 && onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--c-ink)] transition-all duration-150 hover:bg-[var(--c-surface-2)]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Continuar ({remainingCount})
            </button>
          )}
          <Link
            to="/simulados"
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5 text-[13px] font-bold text-white no-underline',
              'transition-all duration-150 hover:opacity-90',
              'shadow-[0_4px_16px_-4px_rgba(176,41,74,.45)]',
            )}
            style={{
              background: 'linear-gradient(135deg, var(--c-wine-500, #B0294A), var(--c-wine-700, #7A1A32))',
            }}
          >
            <Zap className="h-4 w-4" aria-hidden />
            Treinar mais
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
