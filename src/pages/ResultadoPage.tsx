import { useState, useEffect, useRef } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { EmptyState } from '@/components/EmptyState';
import { UpgradeBanner } from '@/components/UpgradeBanner';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useUser } from '@/contexts/UserContext';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { canViewResultsOrAdminPreview } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown } from '@/lib/resultHelpers';
import { SEGMENT_ACCESS } from '@/types';
import { trackEvent } from '@/lib/analytics';
import {
  Trophy, CheckCircle2, XCircle, MinusCircle, ClipboardCheck,
  BarChart3, FileText, ArrowLeft, ArrowRight, BookOpen, Star, TrendingDown,
} from 'lucide-react';

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
  }, [loading, examState, id, questions, segment]);

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
  const resultsAllowed = canViewResultsOrAdminPreview(simulado.status, {
    adminPreview,
    attemptFinished,
  });

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
  const { overall, byArea } = breakdown;
  const officialCorrect = attempt?.total_correct ?? overall.totalCorrect;
  const officialAnswered = attempt?.total_answered ?? overall.totalAnswered;
  const officialPercentage = attempt?.score_percentage != null
    ? Math.round(Number(attempt.score_percentage))
    : overall.percentageScore;
  const officialIncorrect = officialAnswered - officialCorrect;
  const officialUnanswered = overall.totalQuestions - officialAnswered;
  const bestArea = byArea[0];
  const worstArea = byArea[byArea.length - 1];
  const hasComparativo = SEGMENT_ACCESS[segment].comparativo;
  const hasCadernoErros = SEGMENT_ACCESS[segment].cadernoErros;

  const RING_CIRCUMFERENCE = 376.99
  const ringTargetOffset = RING_CIRCUMFERENCE * (1 - officialPercentage / 100)
  const [ringOffset, setRingOffset] = useState(RING_CIRCUMFERENCE)

  useEffect(() => {
    if (prefersReducedMotion) {
      setRingOffset(ringTargetOffset)
      return
    }
    const t = setTimeout(() => setRingOffset(ringTargetOffset), 100)
    return () => clearTimeout(t)
  }, [ringTargetOffset, prefersReducedMotion])

  return (
    <>

      {/* Hero score */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        className="mb-8"
      >
        <div
          className="rounded-3xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(155deg, #7a1a32 0%, #5c1225 45%, #3d0b18 100%)',
            boxShadow: '0 32px 64px -20px rgba(142,31,61,0.7), 0 8px 24px -8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* glow orb */}
          <div
            className="absolute pointer-events-none"
            style={{ top: '-60px', right: '-60px', width: 260, height: 260, background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }}
            aria-hidden
          />

          <div className="relative z-10 px-7 pt-9 pb-7">
            {/* Ring + score */}
            <div className="flex flex-col items-center mb-7">
              <div className="relative mb-3.5" style={{ width: 140, height: 140 }}>
                <svg
                  width="140"
                  height="140"
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
                    cx="70" cy="70" r="60"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="70" cy="70" r="60"
                    fill="none"
                    stroke="url(#ringGrad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    style={{
                      strokeDashoffset: ringOffset,
                      transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 1s ease-out',
                      filter: 'drop-shadow(0 0 8px rgba(255,180,180,0.4))',
                    }}
                  />
                </svg>
                {/* center text — absolute over the SVG */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Trophy className="h-5 w-5 mb-1" style={{ color: 'rgba(255,255,255,0.45)' }} />
                  <span className="text-display font-bold leading-none tabular-nums" style={{ color: '#fff' }}>
                    {officialPercentage}%
                  </span>
                  <span className="text-overline uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    do total
                  </span>
                </div>
              </div>

              <p className="text-body text-center" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{officialCorrect}</strong>
                {' '}de{' '}
                <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{overall.totalQuestions}</strong>
                {' '}questões corretas
              </p>
            </div>

              {/* Stat cards */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {([
                  {
                    label: 'Acertos',
                    value: officialCorrect,
                    iconBg: 'rgba(34,197,94,0.15)',
                    iconColor: '#4ade80',
                    icon: <CheckCircle2 className="h-4 w-4" />,
                  },
                  {
                    label: 'Erros',
                    value: officialIncorrect,
                    iconBg: 'rgba(239,68,68,0.15)',
                    iconColor: '#f87171',
                    icon: <XCircle className="h-4 w-4" />,
                  },
                  {
                    label: 'Em branco',
                    value: officialUnanswered,
                    iconBg: 'rgba(255,255,255,0.08)',
                    iconColor: 'rgba(255,255,255,0.4)',
                    icon: <MinusCircle className="h-4 w-4" />,
                  },
                  {
                    label: 'Respondidas',
                    value: officialAnswered,
                    iconBg: 'rgba(99,179,237,0.15)',
                    iconColor: '#7dd3fc',
                    icon: <ClipboardCheck className="h-4 w-4" />,
                  },
                ] as const).map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="rounded-2xl py-3 px-1.5 text-center"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-[9px] flex items-center justify-center mx-auto mb-2"
                      style={{ background: stat.iconBg, color: stat.iconColor }}
                    >
                      {stat.icon}
                    </div>
                    <p className="text-heading-2 leading-none mb-1" style={{ color: '#fff' }}>
                      {stat.value}
                    </p>
                    <p className="text-caption uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {stat.label}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 -4px 16px' }} />

              {/* Highlights */}
              {byArea.length > 1 && (
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  <div
                    className="rounded-2xl p-3.5 flex items-center gap-2.5"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
                    >
                      <Star className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-wider font-bold mb-0.5" style={{ color: '#4ade80' }}>
                        Ponto forte
                      </p>
                      <p className="text-body font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {bestArea.area}
                      </p>
                      <p className="text-caption" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {bestArea.correct}/{bestArea.questions} · {bestArea.score}%
                      </p>
                    </div>
                  </div>
                  <div
                    className="rounded-2xl p-3.5 flex items-center gap-2.5"
                    style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}
                    >
                      <TrendingDown className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-wider font-bold mb-0.5" style={{ color: '#fb923c' }}>
                        Oportunidade
                      </p>
                      <p className="text-body font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {worstArea.area}
                      </p>
                      <p className="text-caption" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {worstArea.correct}/{worstArea.questions} · {worstArea.score}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA perolado */}
              <div
                className="rounded-b-3xl -mx-7 -mb-7 px-7 pb-7 pt-5"
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
                  className="relative flex items-center justify-center gap-2.5 w-full py-[17px] px-6 rounded-2xl overflow-hidden font-bold text-body"
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
                  {/* top gloss */}
                  <span
                    className="absolute inset-x-0 top-0 h-1/2 pointer-events-none rounded-t-2xl"
                    style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)' }}
                    aria-hidden
                  />
                  <BookOpen className="h-5 w-5 relative z-10" aria-hidden />
                  <span className="relative z-10">Ir para correção comentada</span>
                  <ArrowRight className="h-[18px] w-[18px] relative z-10 ml-auto opacity-50" aria-hidden />
                </Link>
              </div>
          </div>
        </div>
      </motion.div>

      {!hasCadernoErros && (
        <div className="mb-8">
          <UpgradeBanner
            title="Salve questões no Caderno de Erros"
            description="Com o PRO: ENAMED, adicione questões ao seu Caderno de Erros direto da correção."
            ctaText="Conhecer o PRO: ENAMED"
          />
        </div>
      )}

      {hasComparativo && (
        <div className="mt-4">
          <Link
            to="/comparativo"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-transparent text-muted-foreground text-body font-medium hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            Comparativo
          </Link>
        </div>
      )}
    </>
  );
}
