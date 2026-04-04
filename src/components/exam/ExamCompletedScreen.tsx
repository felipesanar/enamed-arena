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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
        className="max-w-lg w-full text-center"
      >
        {/* Icon with spring animation */}
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
          className="h-20 w-20 rounded-3xl bg-success/10 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        </motion.div>

        <h1 className="text-heading-1 text-foreground mb-3">
          Prova entregue!
        </h1>
        <p className="text-body-lg text-muted-foreground mb-2">
          Você completou o <strong className="text-foreground">{simuladoTitle}</strong>.
        </p>
        {!isWithinWindow && (
          <div className="inline-flex items-start gap-2 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/15 text-body-sm text-foreground text-left max-w-md mx-auto mb-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
            <span>
              <strong className="text-foreground">Esta realização não entra no ranking nacional</strong>
              {' '}— a janela oficial já havia encerrado. Seu desempenho, gabarito e comentários seguem valendo para sua preparação.
            </span>
          </div>
        )}

        {/* Exam summary badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-body-sm text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
            {answeredCount}/{totalCount} respondidas
          </span>
          {highConfidenceCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-body-sm text-success">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              {highConfidenceCount} alta certeza
            </span>
          )}
          {markedForReviewCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-info/10 text-body-sm text-info">
              <Flag className="h-3.5 w-3.5" aria-hidden />
              {markedForReviewCount} para revisar
            </span>
          )}
        </div>

        <p className="text-body-sm text-muted-foreground mb-6">
          Suas respostas foram salvas com sucesso. Nada será perdido.
        </p>

        {/* Results release date */}
        <div className="premium-card p-5 mb-6 text-left">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-body font-semibold text-foreground mb-1">Liberação do resultado</p>
              <p className="text-body-sm text-muted-foreground leading-relaxed">
                {resultsAvailable
                  ? 'O gabarito comentado, seu desempenho e o ranking já estão disponíveis!'
                  : <>O gabarito comentado, seu desempenho detalhado e o ranking serão liberados em{' '}
                    <strong className="text-foreground">{formatDate(resultsReleaseAt)}</strong>.</>
                }
              </p>
            </div>
          </div>
        </div>

        {/* Email notification — prominent */}
        {!resultsAvailable && (
          <div className="premium-card p-4 mb-6 text-left border-primary/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-primary mt-0.5" aria-hidden />
                <div>
                  <p className="text-body-sm font-semibold text-foreground">Quer saber quando o resultado sair?</p>
                  <p className="text-caption text-muted-foreground">
                    Você recebe um email assim que ficar disponível.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={notificationSaving}
                onClick={() => onToggleNotifyResultByEmail(!notifyResultByEmail)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors disabled:opacity-60 shrink-0',
                  notifyResultByEmail
                    ? 'bg-primary text-primary-foreground hover:bg-wine-hover'
                    : 'border border-border bg-card hover:bg-muted'
                )}
              >
                {notifyResultByEmail ? 'Ativado ✓' : 'Ativar aviso'}
              </button>
            </div>
          </div>
        )}

        {/* CTAs — conditional on results availability */}
        {resultsAvailable ? (
          <Link
            to={`/simulados/${simuladoId}/resultado`}
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-colors mb-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
          >
            Ver resultado
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <Link
            to={`/simulados/${simuladoId}/correcao`}
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl bg-accent text-foreground text-body-lg font-semibold hover:bg-muted transition-colors mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
          >
            Ver gabarito
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        )}

        <Link
          to="/simulados"
          className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl border border-border bg-transparent text-muted-foreground text-body font-medium hover:bg-muted/50 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
        >
          Voltar ao calendário
        </Link>
      </motion.div>
    </div>
  );
}
