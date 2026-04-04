import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle2, Calendar, ArrowRight, Mail, Sparkles, Zap, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/simulado-helpers';

interface ExamCompletedScreenProps {
  simuladoId: string;
  simuladoTitle: string;
  resultsReleaseAt: string;
  answeredCount: number;
  totalCount: number;
  highConfidenceCount: number;
  markedForReviewCount: number;
  notifyResultByEmail: boolean;
  notificationSaving: boolean;
  isWithinWindow?: boolean;
  resultsAvailable: boolean;
  onToggleNotifyResultByEmail: (enabled: boolean) => Promise<void>;
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export function ExamCompletedScreen({
  simuladoId,
  simuladoTitle,
  resultsReleaseAt,
  answeredCount,
  totalCount,
  highConfidenceCount,
  markedForReviewCount,
  notifyResultByEmail,
  notificationSaving,
  isWithinWindow = true,
  resultsAvailable,
  onToggleNotifyResultByEmail,
}: ExamCompletedScreenProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen exam-bg flex items-center justify-center p-4">
      <motion.div
        variants={prefersReducedMotion ? undefined : stagger}
        initial="hidden"
        animate="visible"
        className="max-w-lg w-full text-center"
      >
        <motion.div variants={prefersReducedMotion ? undefined : fadeUp}>
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1, type: 'spring', stiffness: 180, damping: 16 }}
            className="h-20 w-20 rounded-3xl bg-success/10 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
          </motion.div>
        </motion.div>

        <motion.div variants={prefersReducedMotion ? undefined : fadeUp}>
          <h1 className="text-heading-1 text-foreground mb-1">
            Prova concluída
          </h1>
          <p className="text-body-lg text-muted-foreground mb-4">
            {simuladoTitle}
          </p>
        </motion.div>

        {!isWithinWindow && (
          <motion.div variants={prefersReducedMotion ? undefined : fadeUp}>
            <div className="inline-flex items-start gap-2 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/15 text-body-sm text-foreground text-left max-w-md mx-auto mb-4">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-foreground">Esta realização não entra no ranking nacional</strong>
                {' '}— a janela oficial já havia encerrado. Seu desempenho, gabarito e comentários seguem valendo para sua preparação.
              </span>
            </div>
          </motion.div>
        )}

        <motion.div variants={prefersReducedMotion ? undefined : fadeUp}>
          <p className="text-body text-muted-foreground mb-1">
            Você respondeu <strong className="text-foreground">{answeredCount}</strong> de <strong className="text-foreground">{totalCount}</strong> questões.
          </p>
          <div className="flex items-center justify-center gap-4 text-body-sm text-muted-foreground mb-6">
            {highConfidenceCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-success" aria-hidden />
                {highConfidenceCount} alta certeza
              </span>
            )}
            {markedForReviewCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Flag className="h-3.5 w-3.5 text-info" aria-hidden />
                {markedForReviewCount} para revisão
              </span>
            )}
          </div>
        </motion.div>

        <motion.div variants={prefersReducedMotion ? undefined : fadeUp}>
          <p className="text-body-sm text-muted-foreground/70 mb-6">
            Suas respostas foram salvas com sucesso.
          </p>
        </motion.div>

        <motion.div variants={prefersReducedMotion ? undefined : fadeUp}>
          <div className="bg-[hsl(var(--exam-surface))] border border-[hsl(var(--exam-border))] rounded-xl p-5 mb-6 text-left">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-foreground mb-1">Liberação do resultado</p>
                <p className="text-body-sm text-muted-foreground leading-relaxed">
                  {resultsAvailable
                    ? 'O gabarito comentado, seu desempenho e o ranking já estão disponíveis!'
                    : <>O gabarito comentado, seu desempenho e o ranking serão liberados em{' '}
                      <strong className="text-foreground">{formatDate(resultsReleaseAt)}</strong>.</>
                  }
                </p>
              </div>
            </div>

            {!resultsAvailable && (
              <div className="mt-4 pt-3 border-t border-[hsl(var(--exam-border))] flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
                  <p className="text-body-sm text-muted-foreground">
                    Receber email quando o resultado sair
                  </p>
                </div>
                <button
                  type="button"
                  disabled={notificationSaving}
                  onClick={() => onToggleNotifyResultByEmail(!notifyResultByEmail)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors disabled:opacity-60 shrink-0',
                    notifyResultByEmail
                      ? 'bg-primary text-primary-foreground hover:bg-wine-hover'
                      : 'border border-[hsl(var(--exam-border))] hover:bg-muted/50'
                  )}
                >
                  {notifyResultByEmail ? 'Ativado ✓' : 'Ativar'}
                </button>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={prefersReducedMotion ? undefined : fadeUp} className="space-y-3">
          {resultsAvailable ? (
            <Link
              to={`/simulados/${simuladoId}/resultado`}
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
            >
              Ver resultado
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ) : (
            <Link
              to={`/simulados/${simuladoId}/correcao`}
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
            >
              Ver gabarito
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}

          <Link
            to="/simulados"
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl text-muted-foreground text-body font-medium hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
          >
            Voltar ao calendário
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
