import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Calendar, ArrowRight, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/simulado-helpers';

interface ExamCompletedScreenProps {
  simuladoId: string;
  simuladoTitle: string;
  resultsReleaseAt: string;
  answeredCount: number;
  totalCount: number;
  notifyResultByEmail: boolean;
  notificationSaving: boolean;
  isWithinWindow?: boolean;
  onToggleNotifyResultByEmail: (enabled: boolean) => Promise<void>;
}

export function ExamCompletedScreen({
  simuladoId,
  simuladoTitle,
  resultsReleaseAt,
  answeredCount,
  totalCount,
  notifyResultByEmail,
  notificationSaving,
  isWithinWindow = true,
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
        {/* Micro-celebration: ícone com leve bounce (respeita reduced-motion) */}
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
          className="h-20 w-20 rounded-3xl bg-success/10 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        </motion.div>

        <h1 className="text-heading-1 text-foreground mb-3">
          {isWithinWindow ? 'Simulado concluído!' : 'Treino concluído!'}
        </h1>
        <p className="text-body-lg text-muted-foreground mb-2">
          Você completou o <strong className="text-foreground">{simuladoTitle}</strong>.
        </p>
        {!isWithinWindow && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 border border-warning/20 text-warning text-body-sm font-medium mb-3">
            <AlertTriangle className="h-4 w-4" />
            Realizado fora da janela — não entra no ranking.
          </div>
        )}
        {/* Copy de confiança */}
        <p className="text-body text-muted-foreground mb-1">
          Suas respostas foram salvas com sucesso. Nada será perdido.
        </p>
        <p className="text-body-sm text-muted-foreground mb-6">
          {answeredCount} de {totalCount} questões respondidas.
        </p>

        <div className="premium-card p-5 mb-8 text-left">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-body font-semibold text-foreground mb-1">Liberação do resultado</p>
              <p className="text-body-sm text-muted-foreground leading-relaxed">
                O gabarito comentado, seu desempenho detalhado e o ranking serão liberados em{' '}
                <strong className="text-foreground">{formatDate(resultsReleaseAt)}</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="premium-card p-4 mb-6 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Mail className="h-4 w-4 text-primary mt-0.5" aria-hidden />
              <div>
                <p className="text-body-sm font-semibold text-foreground">Avisar por email quando liberar</p>
                <p className="text-caption text-muted-foreground">
                  Receba um lembrete assim que o resultado ficar disponivel.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={notificationSaving}
              onClick={() => onToggleNotifyResultByEmail(!notifyResultByEmail)}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-body-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {notifyResultByEmail ? 'Ativado' : 'Ativar'}
            </button>
          </div>
        </div>

        {/* Um CTA principal (Fase C) */}
        <Link
          to={`/simulados/${simuladoId}/resultado`}
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-colors mb-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
        >
          Ver resultado
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>

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