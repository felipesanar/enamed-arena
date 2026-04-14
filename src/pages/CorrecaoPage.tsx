import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, Navigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PremiumCard } from '@/components/PremiumCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { AddToNotebookModal } from '@/components/AddToNotebookModal';
import { SimuladoResultNav } from '@/components/simulado/SimuladoResultNav';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { canViewResultsOrAdminPreview, areResultsReleased } from '@/lib/simulado-helpers';
import { computeSimuladoScore, computePerformanceBreakdown } from '@/lib/resultHelpers';
import { SEGMENT_ACCESS } from '@/types';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { usePdfDownload, getStageLabel } from '@/hooks/usePdfDownload';
import {
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  FileText, BookOpen, Flag, Zap, Grid3X3, Sparkles, Lock, Download, Loader2,
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
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null);
  const [highlightAnchor, setHighlightAnchor] = useState<{ x: number; y: number } | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);

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

  const currentExplanation = questionsWithCorrection[currentIndex]?.explanation
  useEffect(() => {
    const el = explanationRef.current
    if (!el) { setExplanationOverflows(false); return }
    setExplanationOverflows(el.scrollHeight > el.clientHeight)
  }, [currentIndex, currentExplanation])

  const loading = loadingSim || loadingExam;

  const score = useMemo(() => {
    if (!examState || !questionsWithCorrection.length) return null;
    return computeSimuladoScore(examState, questionsWithCorrection);
  }, [examState, questionsWithCorrection]);

  const breakdown = useMemo(() => {
    if (!examState || !questionsWithCorrection.length) return null;
    return computePerformanceBreakdown(examState, questionsWithCorrection);
  }, [examState, questionsWithCorrection]);

  const pdf = usePdfDownload({
    simuladoId: id ?? '',
    simuladoTitle: simulado?.title ?? '',
    studentName: profile?.name ?? 'Aluno',
    questions: questionsWithCorrection,
    examState,
    breakdown,
  });

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

  const handleExplanationMouseUp = () => {
    if (!canUseNotebook) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setHighlightAnchor(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (explanationRef.current?.contains(range.commonAncestorContainer)) {
      const rect = range.getBoundingClientRect();
      setHighlightAnchor({ x: rect.left + rect.width / 2, y: rect.top });
    } else {
      setHighlightAnchor(null);
    }
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border"
        aria-label="Resultado da correção"
      >
        <div className="flex items-center justify-between px-4 md:px-6 h-12 gap-3">
          <span className="text-body font-semibold text-foreground truncate min-w-0">
            Gabarito — {simulado.title}
            {adminPreview && (
              <span className="ml-2 text-caption text-primary font-bold uppercase tracking-wider">
                · Admin
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-bold bg-success/10 text-success">
              ✓ {attempt?.total_correct ?? score.totalCorrect}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-bold bg-destructive/10 text-destructive">
              ✗ {score.totalIncorrect}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-bold bg-warning/10 text-warning">
              — {score.totalUnanswered}
            </span>
            <div className="w-px h-4 bg-border mx-1" />
            <span className="text-heading-3 font-bold text-primary tabular-nums">
              {attempt?.score_percentage != null
                ? Math.round(Number(attempt.score_percentage))
                : score.percentageScore}%
            </span>
            <span className="text-caption text-muted-foreground tabular-nums">
              {currentIndex + 1}/{score.totalQuestions}
            </span>
          </div>
        </div>
        <div
          className="h-[3px] bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuenow={currentIndex + 1}
          aria-valuemax={score.totalQuestions}
          aria-label={`Questão ${currentIndex + 1} de ${score.totalQuestions}`}
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / score.totalQuestions) * 100}%` }}
          />
        </div>
      </header>

      <div className="px-4 md:px-6 py-4 md:py-6">
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
                <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
                  {/* Esquerda: número + meta tags */}
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-body font-bold text-foreground">Questão {question.number}</span>
                      <span className="text-caption text-muted-foreground">de {questions.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">{question.area}</span>
                      <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">{question.theme}</span>
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
                    </div>
                  </div>

                  {/* Direita: caderno + badge resultado */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {canUseNotebook ? (
                      <button
                        onClick={() => { setSelectedHighlight(null); setNotebookModal(true); }}
                        aria-label="Adicionar ao caderno de erros"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium transition-all bg-secondary text-secondary-foreground hover:bg-muted border border-border/50"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Adicionar ao caderno de erros
                      </button>
                    ) : (
                      <button
                        onClick={() => setUpsellOpen(true)}
                        aria-label="Adicionar ao caderno de erros"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium transition-all bg-accent/50 border border-primary/10 text-muted-foreground hover:bg-accent"
                      >
                        <Lock className="h-3.5 w-3.5 text-primary" />
                        Adicionar ao caderno de erros
                      </button>
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
                    <div className="relative">
                      <p
                        ref={explanationRef}
                        onMouseUp={handleExplanationMouseUp}
                        className={cn(
                          'text-body text-muted-foreground leading-relaxed whitespace-pre-wrap overflow-hidden transition-all duration-300',
                        )}
                        style={
                          !expandedExplanations.has(currentIndex) && explanationOverflows
                            ? { maxHeight: `${EXPLANATION_MAX_H}px` }
                            : undefined
                        }
                      >
                        {question.explanation}
                      </p>
                      {!expandedExplanations.has(currentIndex) && explanationOverflows && (
                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                      )}
                      {explanationOverflows && (
                        <button
                          onClick={() =>
                            setExpandedExplanations(prev => {
                              const next = new Set(prev)
                              if (next.has(currentIndex)) next.delete(currentIndex)
                              else next.add(currentIndex)
                              return next
                            })
                          }
                          aria-expanded={expandedExplanations.has(currentIndex)}
                          className="mt-2 text-caption font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {expandedExplanations.has(currentIndex) ? 'Ver menos ▴' : 'Ver mais ▾'}
                        </button>
                      )}
                    </div>
                  )}
                  {question.explanationImageUrl && (
                    <div className="mt-4">
                      <QuestionImage src={question.explanationImageUrl} alt={`Imagem do comentário da questão ${question.number}`} />
                    </div>
                  )}
                </PremiumCard>
              )}

            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between pb-8">
            <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              onClick={() => setShowNav(v => !v)}
              aria-label="Grade de questões"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors md:hidden"
            >
              <Grid3X3 className="h-4 w-4" aria-hidden />
              <span>Grade</span>
            </button>
            <button onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))} disabled={currentIndex === questions.length - 1} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-medium hover:bg-wine-hover transition-colors disabled:opacity-40">
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Side navigator — sticky desktop */}
        <aside className="hidden md:flex w-56 flex-col gap-3 shrink-0">
          <div className="sticky top-12 pt-4">
            <p className="text-overline uppercase text-muted-foreground tracking-wider mb-3">Questões</p>
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {score.questionResults.map((r, i) => {
                const hasFlag = r.markedForReview
                return (
                  <button
                    key={r.questionId}
                    onClick={() => handleNavigate(i)}
                    aria-current={i === currentIndex ? 'true' : undefined}
                    aria-label={`Questão ${i + 1}${r.isCorrect ? ', acertou' : r.wasAnswered ? ', errou' : ', em branco'}${hasFlag ? ', marcada para revisão' : ''}`}
                    className={cn(
                      'relative h-9 w-full rounded-lg text-caption font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      i === currentIndex
                        ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                        : r.isCorrect
                          ? 'bg-success/15 text-success hover:bg-success/25'
                          : r.wasAnswered
                            ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                            : 'bg-warning/15 text-warning hover:bg-warning/25',
                    )}
                  >
                    {i + 1}
                    {hasFlag && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-warning border border-background" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="space-y-2 text-caption text-muted-foreground border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-success/20 border border-success/30 shrink-0" />
                Acertou
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-destructive/20 border border-destructive/30 shrink-0" />
                Errou
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-warning/20 border border-warning/30 shrink-0" />
                Em branco
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-warning shrink-0" />
                Flag revisão
              </div>
            </div>
          </div>
        </aside>
      </div>
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
          onClose={() => { setNotebookModal(false); setSelectedHighlight(null); setHighlightAnchor(null); }}
          questionId={question.id}
          simuladoId={simulado.id}
          simuladoTitle={simulado.title}
          area={question.area}
          theme={question.theme}
          questionNumber={question.number}
          questionText={question.text}
          wasCorrect={result.isCorrect}
          userId={user.id}
          onAdded={() => setNotebookRefresh(v => v + 1)}
          selectedHighlight={selectedHighlight ?? undefined}
        />
      )}

      {/* Floating text-selection tooltip (PRO only) */}
      <AnimatePresence>
        {highlightAnchor && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: highlightAnchor.x,
              top: highlightAnchor.y - 48,
              transform: 'translateX(-50%)',
              zIndex: 50,
            }}
          >
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                const text = window.getSelection()?.toString().trim() || null;
                setSelectedHighlight(text);
                setHighlightAnchor(null);
                setNotebookModal(true);
                window.getSelection()?.removeAllRanges();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-caption font-semibold shadow-lg hover:bg-wine-hover transition-colors whitespace-nowrap"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Adicionar ao caderno
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-primary" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upsell modal (non-PRO) */}
      <AnimatePresence>
        {upsellOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
            onClick={() => setUpsellOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-6 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative mb-5 inline-flex">
                <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center">
                  <BookOpen className="h-7 w-7 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <Lock className="h-3 w-3 text-primary-foreground" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-overline uppercase text-primary font-bold tracking-wider">Exclusivo PRO: ENAMED</span>
              </div>
              <h3 className="text-heading-2 text-foreground mb-2">Caderno de Erros</h3>
              <p className="text-body-sm text-muted-foreground mb-6 leading-relaxed">
                Salve questões com anotações, marque o motivo do erro e organize sua revisão de forma estratégica.
              </p>
              <a
                href="https://sanarflix.com.br/sanarflix-pro-enamed"
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  trackEvent('upsell_clicked', { source: 'caderno_erros_button', feature: 'cadernoErros', current_segment: segment });
                  setUpsellOpen(false);
                }}
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground !text-white text-body font-semibold hover:bg-wine-hover transition-colors shadow-sm mb-3"
              >
                <Sparkles className="h-4 w-4" />
                Conhecer o PRO: ENAMED
              </a>
              <button
                onClick={() => setUpsellOpen(false)}
                className="text-caption text-muted-foreground hover:text-foreground transition-colors"
              >
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
