import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Loader2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePdfDownload, getStageLabel } from '@/hooks/usePdfDownload';

function MiniStat({
  label,
  area,
  correct,
  total,
  tone,
}: {
  label: string;
  area: string;
  correct: number;
  total: number;
  tone: 'success' | 'destructive';
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300'
      : 'border-rose-400/25 bg-rose-400/[0.08] text-rose-300';

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2',
        toneClasses,
      )}
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/50">
        {label}
      </span>
      <span className="text-[15px] font-extrabold leading-none tabular-nums">
        {correct}
        <span className="text-white/35">/</span>
        {total}
      </span>
      <span className="truncate max-w-[110px] text-[10px] font-medium text-white/55" title={area}>
        {area}
      </span>
    </div>
  );
}

export function PerformanceHeroCard({
  overall,
  bestArea,
  worstArea,
  prefersReducedMotion,
  pdf,
  simuladoId,
  correcaoVariant,
}: {
  overall: { percentageScore: number; totalCorrect: number; totalQuestions: number };
  bestArea: { area: string; score: number; correct: number; questions: number } | null;
  worstArea: { area: string; score: number; correct: number; questions: number } | null;
  prefersReducedMotion: boolean;
  pdf: ReturnType<typeof usePdfDownload>;
  simuladoId: string;
  correcaoVariant: 'public' | 'admin';
}) {
  const pct = overall.percentageScore;
  const pdfLabel = pdf.stage
    ? `${getStageLabel(pdf.stage)}${pdf.progress ? ` (${pdf.progress.current}/${pdf.progress.total})` : ''}`
    : 'Prova Revisada PDF';
  const correcaoHref =
    correcaoVariant === 'admin'
      ? `/admin/preview/simulados/${simuladoId}/correcao`
      : `/simulados/${simuladoId}/correcao`;

  return (
    <div className="hero-status-card">
      {/* Atmospheric layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-[70px] dark:bg-[rgba(232,56,98,0.18)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-primary/10 blur-[50px] dark:bg-[rgba(12,18,32,0.55)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent dark:bg-[radial-gradient(ellipse_72%_50%_at_18%_12%,rgba(255,255,255,0.08)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent dark:via-white/[0.08]"
      />

      <div className="relative z-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-end md:gap-8">
        {/* Score block */}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(249,168,212,0.9)]">
            Aproveitamento geral
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <p className="text-[36px] font-extrabold leading-none tracking-[-0.035em] text-white tabular-nums sm:text-[44px] md:text-[52px] lg:text-[56px]">
              {overall.totalCorrect}
              <span className="text-white/30">/</span>
              {overall.totalQuestions}
            </p>
            <span className="text-[16px] font-bold tabular-nums text-white/65 md:text-[18px]">
              {pct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-4 max-w-md">
            <div
              className="h-[6px] overflow-hidden rounded-full bg-white/[0.08]"
              role="progressbar"
              aria-valuenow={overall.totalCorrect}
              aria-valuemax={overall.totalQuestions}
              aria-label={`${overall.totalCorrect} de ${overall.totalQuestions} questões corretas`}
            >
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,#B7214A_0%,#FF5C82_100%)]"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.8,
                  ease: 'easeOut',
                  delay: prefersReducedMotion ? 0 : 0.15,
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-white/45">
              {overall.totalCorrect} {overall.totalCorrect === 1 ? 'acerto' : 'acertos'} entre{' '}
              {overall.totalQuestions} {overall.totalQuestions === 1 ? 'questão' : 'questões'}.
            </p>
          </div>
        </div>

        {/* Mini-stats + CTA PDF */}
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          {(bestArea || worstArea) && (
            <div className="grid grid-cols-2 gap-2 md:gap-2.5">
              {bestArea && (
                <MiniStat
                  label="Melhor"
                  area={bestArea.area}
                  correct={bestArea.correct}
                  total={bestArea.questions}
                  tone="success"
                />
              )}
              {worstArea && (
                <MiniStat
                  label="Foco"
                  area={worstArea.area}
                  correct={worstArea.correct}
                  total={worstArea.questions}
                  tone="destructive"
                />
              )}
            </div>
          )}

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center md:justify-end">
          {simuladoId && (
            <Link
              to={correcaoHref}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.22] bg-white/[0.12] px-4 py-2.5 text-[12px] font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:border-white/[0.35] hover:bg-white/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#11192A]"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Ver correção comentada
            </Link>
          )}
          <button
            type="button"
            onClick={pdf.downloadProvaRevisada}
            disabled={pdf.downloading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.06] px-4 py-2.5 text-[12px] font-semibold text-white/85 backdrop-blur-sm transition-all duration-200 hover:border-white/[0.22] hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#11192A]"
          >
            {pdf.downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-3.5 w-3.5" aria-hidden />
            )}
            {pdfLabel}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
