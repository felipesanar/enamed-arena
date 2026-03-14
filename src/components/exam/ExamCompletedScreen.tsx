import { motion } from 'framer-motion';
import { CheckCircle2, Bell, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/simulado-helpers';

interface ExamCompletedScreenProps {
  simuladoTitle: string;
  resultsReleaseAt: string;
  answeredCount: number;
  totalCount: number;
}

export function ExamCompletedScreen({
  simuladoTitle, resultsReleaseAt, answeredCount, totalCount,
}: ExamCompletedScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full text-center"
      >
        <div className="h-20 w-20 rounded-3xl bg-success/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>

        <h1 className="text-heading-1 text-foreground mb-3">Simulado concluído!</h1>
        <p className="text-body-lg text-muted-foreground mb-2">
          Você completou o <strong className="text-foreground">{simuladoTitle}</strong>.
        </p>
        <p className="text-body text-muted-foreground mb-8">
          {answeredCount} de {totalCount} questões respondidas.
        </p>

        <div className="premium-card p-5 mb-8 text-left">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-body font-semibold text-foreground mb-1">Liberação do resultado</p>
              <p className="text-body-sm text-muted-foreground">
                O gabarito comentado, seu desempenho detalhado e o ranking serão liberados em{' '}
                <strong className="text-foreground">{formatDate(resultsReleaseAt)}</strong>.
              </p>
            </div>
          </div>
        </div>

        <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors mb-4 w-full justify-center">
          <Bell className="h-4 w-4" />
          Receber aviso por e-mail quando o resultado sair
        </button>

        <Link
          to="/simulados"
          className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
        >
          Voltar ao calendário
        </Link>
      </motion.div>
    </div>
  );
}
