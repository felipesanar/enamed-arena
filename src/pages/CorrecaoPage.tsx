import { useState, useMemo, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { getSimuladoById } from '@/data/mock';
import { getQuestionsForSimulado } from '@/data/mock-questions';
import { useExamStorage } from '@/hooks/useExamStorage';
import { canViewResults } from '@/lib/simulado-helpers';
import { computeSimuladoScore, type QuestionResult } from '@/lib/result-helpers';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  FileText, BookOpen, Flag, Zap, Grid3X3,
} from 'lucide-react';

export default function CorrecaoPage() {
  const { id } = useParams<{ id: string }>();
  const simulado = useMemo(() => (id ? getSimuladoById(id) : null), [id]);
  const questions = useMemo(() => (id ? getQuestionsForSimulado(id) : []), [id]);
  const storage = useExamStorage(id || '');
  const examState = useMemo(() => storage.loadState(), [id]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNav, setShowNav] = useState(false);

  console.log('[CorrecaoPage] Rendering for simulado:', id);

  if (!simulado) {
    return <AppLayout><EmptyState title="Simulado não encontrado" /></AppLayout>;
  }

  if (!canViewResults(simulado.status)) {
    return <Navigate to={`/simulados/${id}`} replace />;
  }

  if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired')) {
    return (
      <AppLayout>
        <div className="mb-4">
          <Link to={`/simulados/${id}`} className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>
        <EmptyState icon={FileText} title="Sem correção disponível" description="Você não realizou este simulado." />
      </AppLayout>
    );
  }

  const score = computeSimuladoScore(examState, questions);
  const question = questions[currentIndex];
  const result = score.questionResults[currentIndex];
  const answer = examState.answers[question?.id];

  if (!question) return null;

  const handleNavigate = (idx: number) => {
    setCurrentIndex(idx);
    setShowNav(false);
  };

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to={`/simulados/${id}/resultado`} className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao resultado
        </Link>
      </div>

      <PageHeader
        title="Correção"
        subtitle={`${simulado.title} — Gabarito Comentado`}
        badge={`${score.totalCorrect}/${score.totalQuestions} acertos (${score.percentageScore}%)`}
      />

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Question header */}
              <PremiumCard className="p-5 md:p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-body font-bold text-foreground">Questão {question.number}</span>
                    <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                      {question.area}
                    </span>
                    <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                      {question.theme}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {answer?.markedForReview && (
                      <span className="inline-flex items-center gap-1 text-caption text-info bg-info/10 px-2 py-0.5 rounded-md">
                        <Flag className="h-3 w-3" /> Revisão
                      </span>
                    )}
                    {answer?.highConfidence && (
                      <span className="inline-flex items-center gap-1 text-caption text-success bg-success/10 px-2 py-0.5 rounded-md">
                        <Zap className="h-3 w-3" /> Alta certeza
                      </span>
                    )}
                    {result.isCorrect ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-semibold bg-success/10 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Acertou
                      </span>
                    ) : result.wasAnswered ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-semibold bg-destructive/10 text-destructive">
                        <XCircle className="h-3.5 w-3.5" /> Errou
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-semibold bg-warning/10 text-warning">
                        Em branco
                      </span>
                    )}
                  </div>
                </div>

                {/* Statement */}
                <p className="text-body-lg leading-relaxed text-foreground whitespace-pre-wrap mb-6">
                  {question.text}
                </p>

                {/* Alternatives */}
                <div className="space-y-3">
                  {question.options.map(opt => {
                    const isCorrect = opt.id === question.correctOptionId;
                    const isUserSelection = opt.id === result.selectedOptionId;
                    const isWrongSelection = isUserSelection && !isCorrect;

                    return (
                      <div
                        key={opt.id}
                        className={cn(
                          'flex items-start gap-3 p-4 rounded-xl border transition-colors',
                          isCorrect
                            ? 'bg-success/5 border-success/30'
                            : isWrongSelection
                              ? 'bg-destructive/5 border-destructive/30'
                              : 'bg-card border-border/40',
                        )}
                      >
                        <span className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-lg text-caption font-bold shrink-0',
                          isCorrect ? 'bg-success/15 text-success' :
                          isWrongSelection ? 'bg-destructive/15 text-destructive' :
                          'bg-muted text-muted-foreground',
                        )}>
                          {opt.label}
                        </span>
                        <span className={cn(
                          'text-body leading-relaxed flex-1 pt-0.5',
                          isCorrect && 'text-foreground font-medium',
                          isWrongSelection && 'text-foreground',
                        )}>
                          {opt.text}
                        </span>
                        {isCorrect && <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-1" />}
                        {isWrongSelection && <XCircle className="h-4 w-4 text-destructive shrink-0 mt-1" />}
                      </div>
                    );
                  })}
                </div>
              </PremiumCard>

              {/* Commentary */}
              {question.explanation && (
                <PremiumCard className="p-5 md:p-6 mb-6 border-primary/10 bg-primary/[0.02]">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h3 className="text-body font-bold text-primary">Comentário do Professor</h3>
                  </div>
                  <p className="text-body text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {question.explanation}
                  </p>
                </PremiumCard>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between pb-8">
            <button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>

            <button
              onClick={() => setShowNav(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors md:hidden"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>

            <button
              onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex === questions.length - 1}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-medium hover:bg-wine-hover transition-colors disabled:opacity-40"
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Side navigator (desktop) */}
        <aside className="hidden md:flex w-60 flex-col gap-3 shrink-0">
          <p className="text-body font-semibold text-foreground">Questões</p>
          <p className="text-caption text-muted-foreground mb-2">
            {score.totalCorrect}/{score.totalQuestions} corretas
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {score.questionResults.map((r, i) => (
              <button
                key={r.questionId}
                onClick={() => handleNavigate(i)}
                className={cn(
                  'h-9 w-full rounded-lg text-caption font-bold transition-all',
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
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2 text-caption text-muted-foreground border-t border-border pt-3">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-success/20" /> Acertou</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-destructive/20" /> Errou</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-warning/20" /> Em branco</div>
          </div>
        </aside>
      </div>

      {/* Mobile navigator */}
      <AnimatePresence>
        {showNav && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden bg-foreground/40 backdrop-blur-sm"
            onClick={() => setShowNav(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl p-5 max-h-[60vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-body font-semibold text-foreground mb-3">Navegação por questões</p>
              <div className="grid grid-cols-5 gap-2">
                {score.questionResults.map((r, i) => (
                  <button
                    key={r.questionId}
                    onClick={() => handleNavigate(i)}
                    className={cn(
                      'h-10 rounded-lg text-caption font-bold transition-all',
                      i === currentIndex
                        ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                        : r.isCorrect
                          ? 'bg-success/15 text-success'
                          : r.wasAnswered
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-warning/15 text-warning',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
