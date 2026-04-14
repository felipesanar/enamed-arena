import { useState, useEffect, useRef, useMemo } from 'react';

const RING_CIRCUMFERENCE = 376.99;
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { canViewResultsOrAdminPreview, areResultsReleased } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown } from '@/lib/resultHelpers';
import { trackEvent } from '@/lib/analytics';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import {
  Trophy, CheckCircle2, XCircle, MinusCircle,
  FileText, ArrowLeft, ArrowRight, BookOpen, Download, Loader2,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface ResultadoPageProps {
  /** Rota /admin/preview/... — ignora gate de liberação se houver tentativa finalizada */
  adminPreview?: boolean;
}

export default function ResultadoPage({ adminPreview = false }: ResultadoPageProps) {
  const { id } = useParams<{ id: string }>();
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const prefersReducedMotion = useReducedMotion();

  const { simulado, questions, loading: loadingSim } = useSimuladoDetail(id);
  const { examState, attempt, loading: loadingExam } = useExamResult(id);

  const loading = loadingSim || loadingExam;

  const resultTracked = useRef(false);
  useEffect(() => {
    if (loading || resultTracked.current) return;
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired')) return;
    resultTracked.current = true;
    const breakdown = computePerformanceBreakdown(examState, questions);
    const worstArea = breakdown.byArea.at(-1)?.area ?? 'unknown';
    const bestArea = breakdown.byArea[0]?.area ?? 'unknown';
    trackEvent('resultado_viewed', {
      simulado_id: id ?? '',
      score_percentage: attempt?.score_percentage ?? 0,
      total_correct: attempt?.total_correct ?? 0,
      total_questions: questions.length,
      worst_area: worstArea,
      best_area: bestArea,
      segment,
    });
  }, [loading, examState, attempt, id, questions, segment]);

  const breakdown = useMemo(() => {
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired') || !questions.length) return null;
    return computePerformanceBreakdown(examState, questions);
  }, [examState, questions]);

  const pdf = usePdfDownload({
    simuladoId: id ?? '',
    simuladoTitle: simulado?.title ?? '',
    studentName: profile?.name ?? 'Aluno',
    questions,
    examState: examState ?? null,
    breakdown,
  });

  const [ringOffset, setRingOffset] = useState(RING_CIRCUMFERENCE);

  useEffect(() => {
    const pct = attempt?.score_percentage != null
      ? Math.round(Number(attempt.score_percentage))
      : 0;
    const target = RING_CIRCUMFERENCE * (1 - pct / 100);
    if (prefersReducedMotion) {
      setRingOffset(target);
      return;
    }
    const t = setTimeout(() => setRingOffset(target), 100);
    return () => clearTimeout(t);
  }, [attempt?.score_percentage, prefersReducedMotion]);

  if (loading) {
    return (
      <>
        <div className="space-y-4">
          <SkeletonCard />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (!simulado) {
    return (
      <>
        <EmptyState
          title="Simulado não encontrado"
          description="O simulado que você procura não existe."
          backHref="/simulados"
          backLabel="Voltar ao calendário"
        />
      </>
    );
  }

  const attemptFinished =
    examState?.status === 'submitted' || examState?.status === 'expired';
  // Also allow if results release time has already passed client-side — bypasses stale React Query cache
  const resultsAllowed =
    canViewResultsOrAdminPreview(simulado.status, { adminPreview, attemptFinished }) ||
    (!adminPreview && attemptFinished && areResultsReleased(simulado.resultsReleaseAt));

  if (!resultsAllowed) {
    if (adminPreview) {
      return (
        <>
          <div className="mb-4">
            <Link
              to="/admin/ranking-preview"
              className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao preview do ranking
            </Link>
          </div>
          <EmptyState
            icon={FileText}
            title="Preview indisponível"
            description="Não há tentativa finalizada para este simulado com o usuário logado, ou os resultados ainda não podem ser exibidos."
            backHref="/admin/ranking-preview"
            backLabel="Preview do ranking"
          />
        </>
      );
    }
    return <Navigate to={`/simulados/${id}`} replace />;
  }

  if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired')) {
    return (
      <>
        <div className="mb-4">
          <Link
            to={adminPreview ? '/admin/ranking-preview' : `/simulados/${id}`}
            className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />{' '}
            {adminPreview ? 'Voltar ao preview do ranking' : 'Voltar ao simulado'}
          </Link>
        </div>
        <EmptyState
          icon={FileText}
          title="Sem resultado disponível"
          description="Você não realizou este simulado. Não há resultado para exibir."
          backHref={adminPreview ? '/admin/ranking-preview' : id ? `/simulados/${id}` : '/simulados'}
          backLabel={adminPreview ? 'Preview do ranking' : 'Voltar ao simulado'}
        />
      </>
    );
  }

  const breakdown = computePerformanceBreakdown(examState, questions);
  const { overall } = breakdown;
  const officialCorrect = attempt?.total_correct ?? overall.totalCorrect;
  const officialAnswered = attempt?.total_answered ?? overall.totalAnswered;
  const officialPercentage = attempt?.score_percentage != null
    ? Math.round(Number(attempt.score_percentage))
    : overall.percentageScore;
  const officialIncorrect = officialAnswered - officialCorrect;
  const officialUnanswered = overall.totalQuestions - officialAnswered;

  const pdf = usePdfDownload({
    simuladoId: id ?? '',
    simuladoTitle: simulado.title,
    studentName: profile?.name ?? 'Aluno',
    questions,
    examState,
    breakdown,
  });

  const RING_SIZE = 120;
  const RING_SIZE_SM = 140;
  const ringR = 60;
  const ringStroke = 10;

  return (
    <div className="max-w-md mx-auto w-full py-6 sm:py-10">
      {/* Back link */}
      <div className="mb-4 px-1">
        <Link
          to={adminPreview ? '/admin/ranking-preview' : '/simulados'}
          className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {adminPreview ? 'Preview do ranking' : 'Voltar ao calendário'}
        </Link>
      </div>

      {/* Hero score */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
      >
        <div
          className="rounded-3xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(155deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 45%, hsl(var(--primary) / 0.65) 100%)',
            boxShadow: '0 24px 48px -16px hsl(var(--primary) / 0.5), 0 8px 20px -8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* glow orb */}
          <div
            className="absolute pointer-events-none"
            style={{ top: '-60px', right: '-60px', width: 220, height: 220, background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }}
            aria-hidden
          />

          <div className="relative z-10 px-5 pt-7 pb-0 sm:px-7 sm:pt-9">
            {/* Ring + score */}
            <div className="flex flex-col items-center mb-5 sm:mb-7">
              {/* Responsive ring: 120px mobile, 140px desktop */}
              <div className="relative mb-3" style={{ width: RING_SIZE_SM, height: RING_SIZE_SM }}>
                <svg
                  className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px]"
                  viewBox="0 0 140 140"
                  style={{ transform: 'rotate(-90deg)' }}
                  role="img"
                  aria-label={`${officialPercentage}% de aproveitamento`}
                >
                  <defs>
                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ff9ab0" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="70" cy="70" r={ringR}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={ringStroke}
                  />
                  <circle
                    cx="70" cy="70" r={ringR}
                    fill="none"
                    stroke="url(#ringGrad)"
                    strokeWidth={ringStroke}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    style={{
                      strokeDashoffset: ringOffset,
                      transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 1s ease-out',
                      filter: 'drop-shadow(0 0 8px rgba(255,180,180,0.4))',
                    }}
                  />
                </svg>
                {/* center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5 mb-1" style={{ color: 'rgba(255,255,255,0.45)' }} aria-hidden />
                  <span className="text-3xl sm:text-display font-bold leading-none tabular-nums text-white">
                    {officialPercentage}%
                  </span>
                  <span className="text-[10px] sm:text-overline uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    do total
                  </span>
                </div>
              </div>

              <p className="text-body-sm sm:text-body text-center" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{officialCorrect}</strong>
                {' '}de{' '}
                <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{overall.totalQuestions}</strong>
                {' '}questões corretas
              </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-0">
              {([
                {
                  label: 'Acertos',
                  value: officialCorrect,
                  iconBg: 'rgba(34,197,94,0.15)',
                  iconColor: '#4ade80',
                  icon: <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
                },
                {
                  label: 'Erros',
                  value: officialIncorrect,
                  iconBg: 'rgba(239,68,68,0.15)',
                  iconColor: '#f87171',
                  icon: <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
                },
                {
                  label: 'Em branco',
                  value: officialUnanswered,
                  iconBg: 'rgba(255,255,255,0.08)',
                  iconColor: 'rgba(255,255,255,0.4)',
                  icon: <MinusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
                },
              ] as const).map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2 + i * 0.08 }}
                  className="rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-1.5 text-center"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-[9px] flex items-center justify-center mx-auto mb-1.5 sm:mb-2"
                    style={{ background: stat.iconBg, color: stat.iconColor }}
                  >
                    {stat.icon}
                  </div>
                  <p className="text-heading-3 sm:text-heading-2 leading-none mb-0.5 sm:mb-1 text-white">
                    {stat.value}
                  </p>
                  <p className="text-micro-label sm:text-caption uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA footer */}
          <div
            className="px-5 sm:px-7 pb-5 sm:pb-7 pt-4 sm:pt-5 mt-4"
            style={{
              background: 'rgba(0,0,0,0.2)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <p className="text-caption text-center mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Pronto para conferir questão por questão?
            </p>
            <Link
              to={`/simulados/${id}/correcao`}
              className="relative flex items-center justify-center gap-2 w-full py-3.5 sm:py-[17px] px-5 sm:px-6 rounded-xl sm:rounded-2xl overflow-hidden font-bold text-body-sm sm:text-body"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,220,230,0.08) 30%, rgba(255,255,255,0.05) 50%, rgba(230,200,215,0.12) 70%, rgba(255,255,255,0.2) 100%), linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, #f0e4ea 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(180,140,155,0.3), 0 10px 32px -8px rgba(255,255,255,0.3), 0 4px 12px -4px rgba(0,0,0,0.35)',
                color: '#4a0e22',
              }}
            >
              {/* shimmer sweep */}
              <motion.span
                className="absolute inset-y-0 left-0 w-1/2 pointer-events-none -skew-x-12"
                style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)' }}
                animate={prefersReducedMotion ? {} : { x: ['-100%', '300%'] }}
                transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
                aria-hidden
              />
              <span
                className="absolute inset-x-0 top-0 h-1/2 pointer-events-none rounded-t-xl sm:rounded-t-2xl"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)' }}
                aria-hidden
              />
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 relative z-10" aria-hidden />
              <span className="relative z-10">Ir para correção comentada</span>
              <ArrowRight className="h-4 w-4 sm:h-[18px] sm:w-[18px] relative z-10 ml-auto opacity-50" aria-hidden />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
