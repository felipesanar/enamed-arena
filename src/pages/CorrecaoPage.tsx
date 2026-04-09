import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, Link, Navigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { PremiumCard } from '@/components/PremiumCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { AddToNotebookModal } from '@/components/AddToNotebookModal';
import { SimuladoResultNav } from '@/components/simulado/SimuladoResultNav';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { canViewResultsOrAdminPreview } from '@/lib/simulado-helpers';
import { computeSimuladoScore } from '@/lib/resultHelpers';
import { SEGMENT_ACCESS } from '@/types';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import {
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  FileText, BookOpen, Flag, Zap, Grid3X3, Sparkles,
} from 'lucide-react';
import { QuestionImage } from '@/components/exam/QuestionImage';

interface CorrecaoPageProps {
  adminPreview?: boolean;
}

export default function CorrecaoPage({ adminPreview = false }: CorrecaoPageProps) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const canUseNotebook = SEGMENT_ACCESS[segment].cadernoErros;

  const { simulado, questions, loading: loadingSim } = useSimuladoDetail(id);
  const { examState, attempt, attemptQuestionResults, loading: loadingExam } = useExamResult(id);

  const initialQuestionParam = Number(searchParams.get('q') || '1');
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, initialQuestionParam - 1));
  const [showNav, setShowNav] = useState(false);
  const [notebookModal, setNotebookModal] = useState(false);
  const [notebookRefresh, setNotebookRefresh] = useState(0);

  const EXPLANATION_MAX_H = 160 // px

  const [expandedExplanations, setExpandedExplanations] = useState<Set<number>>(new Set())
  const [explanationOverflows, setExplanationOverflows] = useState(false)
  const explanationRef = useRef<HTMLParagraphElement>(null)

  const questionsWithCorrection = useMemo(
    () =>
      questions.map((question) => ({
        ...question,
        correctOptionId: attemptQuestionResults[question.id]?.correct_option_id ?? '',
      })),
    [questions, attemptQuestionResults],
  );

  // Sync currentIndex with search params — must be before early returns
  useEffect(() => {
    const q = Number(searchParams.get('q') || '1');
    if (!Number.isNaN(q) && q > 0 && questionsWithCorrection.length > 0) {
      setCurrentIndex(Math.max(0, Math.min(questionsWithCorrection.length - 1, q - 1)));
    }
  }, [searchParams, questionsWithCorrection.length]);

  useEffect(() => {
    const el = explanationRef.current
    if (!el) { setExplanationOverflows(false); return }
    setExplanationOverflows(el.scrollHeight > el.clientHeight)
  }, [currentIndex, questionsWithCorrection[currentIndex]?.explanation])

  const loading = loadingSim || loadingExam;

  const score = useMemo(() => {
    if (!examState || !questionsWithCorrection.length) return null;
    return computeSimuladoScore(examState, questionsWithCorrection);
  }, [examState, questionsWithCorrection]);

  useEffect(() => {
    if (!id || !simulado) return;
    trackEvent('correction_viewed', {
      simulado_id: id,
      simulado_title: simulado.title,
      segment,
    });
  }, [id, simulado, segment]);

  if (loading) {
    return <><div className="space-y-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div></>;
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
            description="Não há tentativa finalizada para este simulado com o usuário logado, ou a correção ainda não pode ser exibida."
            backHref="/admin/ranking-preview"
            backLabel="Preview do ranking"
          />
        </>
      );
    }
    return <Navigate to={`/simulados/${id}`} replace />;
  }

  if (!examState || !score || (examState.status !== 'submitted' && examState.status !== 'expired')) {
    return (
      <>
        <div className="mb-4">
          <Link
            to={adminPreview ? '/admin/ranking-preview' : `/simulados/${id}`}
            className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />{' '}
            {adminPreview ? 'Voltar ao preview do ranking' : 'Voltar'}
          </Link>
        </div>
        <EmptyState
          icon={FileText}
          title="Sem correção disponível"
          description="Você não realizou este simulado."
          backHref={adminPreview ? '/admin/ranking-preview' : id ? `/simulados/${id}` : '/simulados'}
          backLabel={adminPreview ? 'Preview do ranking' : 'Voltar ao simulado'}
        />
      </>
    );
  }

  const question = questionsWithCorrection[currentIndex];
  const result = score.questionResults[currentIndex];
  const answer = examState.answers[question?.id];

  if (!question || !result) return null;

  // useEffect for search params moved above early returns

  const handleNavigate = (idx: number) => {
    setCurrentIndex(idx);
    setShowNav(false);
  };

  return (
    <>
      <PageBreadcrumb
        items={
          adminPreview
            ? [
                { label: 'Admin', href: '/admin' },
                { label: 'Preview ranking', href: '/admin/ranking-preview' },
                { label: `Simulado #${simulado.sequenceNumber}`, href: `/simulados/${id}` },
                { label: 'Correção' },
              ]
            : [
                { label: 'Simulados', href: '/simulados' },
                { label: `Simulado #${simulado.sequenceNumber}`, href: `/simulados/${id}` },
                { label: 'Correção' },
              ]
        }
        className="mb-4"
      />

      <PageHeader
        title="Gabarito Comentado"
        subtitle={`${simulado.title} — ${attempt?.total_correct ?? score.totalCorrect}/${score.totalQuestions} acertos (${attempt?.score_percentage != null ? Math.round(Number(attempt.score_percentage)) : score.percentageScore}%)${adminPreview ? ' · preview admin' : ''}`}
        badge={adminPreview ? 'Admin · preview · Correção' : `Simulado #${simulado.sequenceNumber} · Correção`}
      />

      {id && (
        <div className="mb-6">
          <SimuladoResultNav simuladoId={id} variant={adminPreview ? 'admin' : 'public'} />
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            >
              <PremiumCard className="p-5 md:p-6 mb-4">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-body font-bold text-foreground">Questão {question.number}</span>
                    <span className="text-caption text-muted-foreground">de {questions.length}</span>
                    <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">{question.area}</span>
                    <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">{question.theme}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {answer?.markedForReview && (
                      <span className="inline-flex items-center gap-1 text-caption text-info bg-info/10 px-2 py-0.5 rounded-md font-medium">
                        <Flag className="h-3 w-3" /> Revisão
                      </span>
                    )}
                    {answer?.highConfidence && (
                      <span className="inline-flex items-center gap-1 text-caption text-success bg-success/10 px-2 py-0.5 rounded-md font-medium">
                        <Zap className="h-3 w-3" /> Alta certeza
                      </span>
                    )}
                    {result.isCorrect ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-success/10 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Acertou
                      </span>
                    ) : result.wasAnswered ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-destructive/10 text-destructive">
                        <XCircle className="h-3.5 w-3.5" /> Errou
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-warning/10 text-warning">Em branco</span>
                    )}
                  </div>
                </div>

                <p className="text-body-lg leading-relaxed text-foreground whitespace-pre-wrap mb-5">{question.text}</p>

                {question.imageUrl && (
                  <div className="mb-6">
                    <QuestionImage src={question.imageUrl} alt={`Imagem da questão ${question.number}`} />
                  </div>
                )}

                <div className="space-y-2.5">
                  {question.options.map(opt => {
                    const isCorrect = opt.id === question.correctOptionId;
                    const isUserSelection = opt.id === result.selectedOptionId;
                    const isWrongSelection = isUserSelection && !isCorrect;

                    return (
                      <div key={opt.id} className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border-2 transition-colors',
                        isCorrect ? 'bg-success/5 border-success/30' : isWrongSelection ? 'bg-destructive/5 border-destructive/30' : 'bg-card border-transparent',
                      )}>
                        <span className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-lg text-caption font-bold shrink-0',
                          isCorrect ? 'bg-success/15 text-success' : isWrongSelection ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground',
                        )}>{opt.label}</span>
                        <span className={cn('text-body leading-relaxed flex-1 pt-0.5', isCorrect && 'text-foreground font-medium', isWrongSelection && 'text-foreground')}>{opt.text}</span>
                        {isCorrect && <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-1" />}
                        {isWrongSelection && <XCircle className="h-4 w-4 text-destructive shrink-0 mt-1" />}
                      </div>
                    );
                  })}
                </div>
              </PremiumCard>

              {(question.explanation || question.explanationImageUrl) && (
                <PremiumCard className="p-5 md:p-6 mb-4 border-primary/10 bg-primary/[0.02]">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h3 className="text-body font-bold text-primary">Comentário do Professor</h3>
                  </div>
                  {question.explanation && (
                    <p className="text-body text-muted-foreground leading-relaxed whitespace-pre-wrap">{question.explanation}</p>
                  )}
                  {question.explanationImageUrl && (
                    <div className="mt-4">
                      <QuestionImage src={question.explanationImageUrl} alt={`Imagem do comentário da questão ${question.number}`} />
                    </div>
                  )}
                </PremiumCard>
              )}

              <div className="mb-6">
                {canUseNotebook ? (
                  <button
                    onClick={() => setNotebookModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-body-sm font-medium transition-all bg-secondary text-secondary-foreground hover:bg-muted border border-border/50"
                  >
                    <BookOpen className="h-4 w-4" />
                    Adicionar ao Caderno de Erros
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/50 border border-primary/10 text-body-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Caderno de Erros — <strong className="text-primary font-semibold">PRO: ENAMED</strong></span>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between pb-8">
            <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button onClick={() => setShowNav(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors md:hidden">
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))} disabled={currentIndex === questions.length - 1} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-medium hover:bg-wine-hover transition-colors disabled:opacity-40">
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Side navigator */}
        <aside className="hidden md:flex w-60 flex-col gap-3 shrink-0">
          <p className="text-body font-semibold text-foreground">Questões</p>
          <p className="text-caption text-muted-foreground mb-2">{score.totalCorrect}/{score.totalQuestions} corretas</p>
          <div className="grid grid-cols-5 gap-1.5">
            {score.questionResults.map((r, i) => (
              <button key={r.questionId} onClick={() => handleNavigate(i)} className={cn(
                'h-9 w-full rounded-lg text-caption font-bold transition-all',
                i === currentIndex ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                  : r.isCorrect ? 'bg-success/15 text-success hover:bg-success/25'
                  : r.wasAnswered ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                  : 'bg-warning/15 text-warning hover:bg-warning/25',
              )}>{i + 1}</button>
            ))}
          </div>
          <div className="mt-4 space-y-2.5 text-caption text-muted-foreground border-t border-border pt-4">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-success/20 border border-success/30" /> Acertou</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-destructive/20 border border-destructive/30" /> Errou</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-warning/20 border border-warning/30" /> Em branco</div>
          </div>
        </aside>
      </div>

      {/* Mobile navigator */}
      <AnimatePresence>
        {showNav && (
          <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.2 }} className="fixed inset-0 z-50 md:hidden bg-foreground/40 backdrop-blur-sm" onClick={() => setShowNav(false)}>
            <motion.div initial={prefersReducedMotion ? false : { y: '100%' }} animate={{ y: 0 }} exit={{ y: prefersReducedMotion ? 0 : '100%' }} transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl p-5 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />
              <p className="text-body font-semibold text-foreground mb-3">Navegação por questões</p>
              <div className="grid grid-cols-5 gap-2">
                {score.questionResults.map((r, i) => (
                  <button key={r.questionId} onClick={() => handleNavigate(i)} className={cn(
                    'h-10 rounded-lg text-caption font-bold transition-all',
                    i === currentIndex ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                      : r.isCorrect ? 'bg-success/15 text-success' : r.wasAnswered ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning',
                  )}>{i + 1}</button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notebook modal */}
      {canUseNotebook && question && id && user && (
        <AddToNotebookModal
          open={notebookModal}
          onClose={() => setNotebookModal(false)}
          questionId={question.id}
          simuladoId={id}
          simuladoTitle={simulado.title}
          area={question.area}
          theme={question.theme}
          questionNumber={question.number}
          questionText={question.text}
          wasCorrect={result.isCorrect}
          userId={user.id}
          onAdded={() => setNotebookRefresh(v => v + 1)}
        />
      )}
    </>
  );
}
