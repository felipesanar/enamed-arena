import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { PremiumCard } from "@/components/PremiumCard";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { SectionHeader } from "@/components/SectionHeader";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SimuladoResultNav } from "@/components/simulado/SimuladoResultNav";
import { useUser } from "@/contexts/UserContext";
import { useSimuladoDetail } from "@/hooks/useSimuladoDetail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  formatDate,
  formatDateTime,
  canAccessSimulado,
  canViewResults,
} from "@/lib/simulado-helpers";
import {
  Clock, Play, AlertTriangle,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles, FileText, Upload,
} from "lucide-react";

export default function SimuladoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { isOnboardingComplete } = useUser();
  const [showExamChoiceModal, setShowExamChoiceModal] = useState(false);

  const { simulado, loading, error, refetch } = useSimuladoDetail(id);

  if (loading) {
    return (
      <>
        <div className="space-y-4">
          <SkeletonCard />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (!simulado || error) {
    return (
      <>
        <EmptyState
          variant="error"
          title="Simulado não encontrado"
          description={error || "O simulado que você procura não existe ou foi removido."}
          onRetry={() => refetch()}
          backHref="/simulados"
          backLabel="Voltar ao calendário"
        />
      </>
    );
  }

  const isAccessible = canAccessSimulado(simulado.status);
  const hasResults = canViewResults(simulado.status);

  return (
    <>
      <PageBreadcrumb
        items={[
          { label: "Simulados", href: "/simulados" },
          { label: simulado.title },
        ]}
        className="mb-4"
      />

      <PageHeader
        title={simulado.title}
        subtitle={simulado.description}
        badge={`Simulado #${simulado.sequenceNumber}`}
        action={<StatusBadge status={simulado.status} />}
      />

      {/* Hero: CTA protagonista quando disponível (Fase C) */}
      {simulado.status === 'upcoming' && (
        <PremiumCard variant="hero" className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-info/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-7 w-7 text-info" />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Simulado em breve</h2>
          <p className="text-body text-muted-foreground mb-2 max-w-md mx-auto">
            A janela de execução abrirá em <strong>{formatDate(simulado.executionWindowStart)}</strong>.
          </p>
          <p className="text-body-sm text-muted-foreground max-w-md mx-auto">
            Prepare-se para {simulado.questionsCount} questões em {simulado.estimatedDuration} de prova.
          </p>
        </PremiumCard>
      )}

      {(isAccessible && !simulado.userState?.started) && (
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.5 }} className="mb-8">
          {!isOnboardingComplete ? (
            <PremiumCard variant="hero" className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-warning" />
              </div>
              <h2 className="text-heading-2 text-foreground mb-2">Complete seu perfil primeiro</h2>
              <p className="text-body text-muted-foreground mb-6 max-w-md mx-auto">
                Para iniciar o simulado, você precisa informar sua especialidade e instituições desejadas.
              </p>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
              >
                <Sparkles className="h-4 w-4" />
                Completar perfil
              </Link>
            </PremiumCard>
          ) : (
            <PremiumCard variant="hero">
              <div className="text-center mb-8">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Play className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-heading-2 text-foreground mb-2">
                  {simulado.status === 'available_late' ? 'Modo Treino' : 'Pronto para começar?'}
                </h2>
                {simulado.status === 'available_late' && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 border border-warning/20 text-warning text-body-sm font-medium mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    Fora da janela de execução — resultado não entra no ranking.
                  </div>
                )}
                <p className="text-body text-muted-foreground max-w-lg mx-auto mb-6">
                  Revise as orientações abaixo. A prova não pode ser pausada após o início.
                </p>
                <button
                  onClick={() => setShowExamChoiceModal(true)}
                  className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-all duration-200 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
                >
                  <Play className="h-5 w-5" />
                  {simulado.status === 'available_late' ? 'Iniciar Treino' : 'Iniciar Simulado'}
                </button>

                {/* Exam choice modal */}
                <Dialog open={showExamChoiceModal} onOpenChange={setShowExamChoiceModal}>
                  <DialogContent className="max-w-lg w-full rounded-2xl border border-border p-6 md:p-8 gap-0">
                    <DialogHeader className="mb-6">
                      <DialogTitle className="text-heading-2 text-foreground text-center">Como deseja realizar o simulado?</DialogTitle>
                      <DialogDescription className="text-body text-muted-foreground text-center mt-2">
                        Escolha a experiência que melhor se adapta ao seu momento.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        onClick={() => {
                          setShowExamChoiceModal(false);
                          navigate(`/simulados/${id}/prova`);
                        }}
                        className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group"
                      >
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Monitor className="h-7 w-7 text-primary" />
                        </div>
                        <p className="text-body font-semibold text-foreground">Experiência online</p>
                        <p className="text-body-sm text-muted-foreground">Realize o simulado na plataforma</p>
                      </button>

                      <button
                        disabled
                        className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border bg-muted/30 text-center opacity-60 cursor-not-allowed"
                      >
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                          <FileText className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="text-body font-semibold text-muted-foreground">Experiência offline</p>
                        <p className="text-body-sm text-muted-foreground">Gere o PDF do Simulado e suba aqui as respostas após a finalização</p>
                        <span className="text-caption text-muted-foreground bg-muted px-2 py-0.5 rounded">Em breve</span>
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {[
                  { icon: Clock, title: 'Duração', desc: `${simulado.estimatedDuration} · ${simulado.questionsCount} questões` },
                  { icon: AlertTriangle, title: 'Sem pausa', desc: 'Cronômetro contínuo após iniciar.' },
                  { icon: Wifi, title: 'Conexão estável', desc: 'Respostas salvas automaticamente.' },
                  { icon: Monitor, title: 'Ambiente adequado', desc: 'Local tranquilo, sem interrupções.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                    <item.icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-body font-medium text-foreground">{item.title}</p>
                      <p className="text-body-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              {simulado.status !== 'available_late' && (
                <p className="text-caption text-muted-foreground text-center mt-6">
                  Resultado em {formatDate(simulado.resultsReleaseAt)}.
                </p>
              )}
            </PremiumCard>
          )}
        </motion.div>
      )}

      {simulado.status === 'in_progress' && simulado.userState?.started && (
        <PremiumCard variant="hero" className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <Play className="h-7 w-7 text-warning" />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Simulado em andamento</h2>
          <p className="text-body text-muted-foreground mb-6 max-w-md mx-auto">
            Você já iniciou este simulado. Continue de onde parou.
          </p>
          <button
            onClick={() => navigate(`/simulados/${id}/prova`)}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
          >
            <Play className="h-4 w-4" />
            Continuar Simulado
          </button>
        </PremiumCard>
      )}

      {simulado.status === 'closed_waiting' && (
        <PremiumCard variant="hero" className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Janela encerrada</h2>
          <p className="text-body text-muted-foreground max-w-md mx-auto">
            O resultado e gabarito serão liberados em <strong>{formatDate(simulado.resultsReleaseAt)}</strong>.
          </p>
        </PremiumCard>
      )}

      {hasResults && (
        <PremiumCard variant="hero" className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          {simulado.userState?.score !== undefined ? (
            <>
              <div className="text-display text-primary mb-2">{simulado.userState.score}%</div>
              <p className="text-body text-muted-foreground mb-6">Sua nota neste simulado</p>
            </>
          ) : (
            <>
              <h2 className="text-heading-2 text-foreground mb-2">Resultado disponível</h2>
              <p className="text-body text-muted-foreground mb-6 max-w-md mx-auto">
                O gabarito comentado e ranking deste simulado já estão liberados.
              </p>
            </>
          )}
          {id && <SimuladoResultNav simuladoId={id} className="justify-center" />}
        </PremiumCard>
      )}

      {/* Fallback: user started/finished but status doesn't match specific blocks above */}
      {isAccessible && simulado.userState?.started && simulado.status !== 'in_progress' && (
        <PremiumCard variant="hero" className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Simulado já realizado</h2>
          <p className="text-body text-muted-foreground max-w-md mx-auto">
            Você já realizou este simulado. O resultado será liberado em <strong>{formatDate(simulado.resultsReleaseAt)}</strong>.
          </p>
        </PremiumCard>
      )}

      <PremiumCard className="p-5 md:p-6 mb-6">
        <SectionHeader title="Janela de Execução" className="mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-overline uppercase text-muted-foreground mb-1">Abertura</p>
            <p className="text-body font-medium text-foreground">{formatDateTime(simulado.executionWindowStart)}</p>
          </div>
          <div>
            <p className="text-overline uppercase text-muted-foreground mb-1">Encerramento</p>
            <p className="text-body font-medium text-foreground">{formatDateTime(simulado.executionWindowEnd)}</p>
          </div>
          <div>
            <p className="text-overline uppercase text-muted-foreground mb-1">Liberação de resultado</p>
            <p className="text-body font-medium text-foreground">{formatDateTime(simulado.resultsReleaseAt)}</p>
          </div>
        </div>
      </PremiumCard>
    </>
  );
}
