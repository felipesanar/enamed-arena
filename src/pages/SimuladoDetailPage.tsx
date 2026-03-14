import { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { SectionHeader } from "@/components/SectionHeader";
import { useUser } from "@/contexts/UserContext";
import { getSimuladoById } from "@/data/mock";
import {
  formatDate,
  formatDateTime,
  canAccessSimulado,
  canViewResults,
  STATUS_CONFIG,
} from "@/lib/simulado-helpers";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Play,
  AlertTriangle,
  Shield,
  Wifi,
  Monitor,
  Bell,
  CheckCircle2,
  Lock,
  BarChart3,
  Sparkles,
} from "lucide-react";

export default function SimuladoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnboardingComplete } = useUser();

  const simulado = useMemo(() => (id ? getSimuladoById(id) : null), [id]);

  

  if (!simulado) {
    return (
      <AppLayout>
        <EmptyState
          title="Simulado não encontrado"
          description="O simulado que você procura não existe ou foi removido."
        />
      </AppLayout>
    );
  }

  const statusInfo = STATUS_CONFIG[simulado.status];
  const isAccessible = canAccessSimulado(simulado.status);
  const hasResults = canViewResults(simulado.status);

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to="/simulados" className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao calendário
        </Link>
      </div>

      <PageHeader
        title={simulado.title}
        subtitle={simulado.description}
        badge={`Simulado #${simulado.sequenceNumber}`}
        action={<StatusBadge status={simulado.status} />}
      />

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {[
          { label: 'Questões', value: String(simulado.questionsCount), icon: FileText },
          { label: 'Duração', value: simulado.estimatedDuration, icon: Clock },
          { label: 'Janela abre', value: formatDate(simulado.executionWindowStart).split(',')[0], icon: Calendar },
          { label: 'Resultado em', value: formatDate(simulado.resultsReleaseAt).split(',')[0], icon: BarChart3 },
        ].map((item, i) => (
          <PremiumCard key={item.label} delay={i * 0.06} className="p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <item.icon className="h-[18px] w-[18px] text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-body font-semibold text-foreground truncate">{item.value}</p>
                <p className="text-caption text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </PremiumCard>
        ))}
      </div>

      {/* Execution window details */}
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

      {/* Status-specific content */}

      {/* ── UPCOMING ── */}
      {simulado.status === 'upcoming' && (
        <PremiumCard className="p-6 md:p-8 text-center">
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
          <button className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors">
            <Bell className="h-4 w-4" />
            Ativar lembrete por e-mail
          </button>
        </PremiumCard>
      )}

      {/* ── AVAILABLE (pre-start) ── */}
      {isAccessible && !simulado.userState?.started && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Onboarding gate */}
          {!isOnboardingComplete ? (
            <PremiumCard className="p-6 md:p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-warning" />
              </div>
              <h2 className="text-heading-2 text-foreground mb-2">Complete seu perfil primeiro</h2>
              <p className="text-body text-muted-foreground mb-6 max-w-md mx-auto">
                Para iniciar o simulado, você precisa informar sua especialidade e instituições desejadas. Isso personaliza seu ranking e desempenho.
              </p>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Completar perfil
              </Link>
            </PremiumCard>
          ) : (
            <PremiumCard className="p-6 md:p-8">
              {/* Pre-start instructions */}
              <div className="text-center mb-8">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Play className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-heading-2 text-foreground mb-2">Pronto para começar?</h2>
                <p className="text-body text-muted-foreground max-w-lg mx-auto">
                  Revise as orientações abaixo antes de iniciar. A prova não pode ser pausada após o início.
                </p>
              </div>

              {/* Instructions grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
                {[
                  { icon: Clock, title: 'Duração', desc: `Você terá ${simulado.estimatedDuration} para completar ${simulado.questionsCount} questões.` },
                  { icon: AlertTriangle, title: 'Sem pausa', desc: 'Uma vez iniciado, o cronômetro não pode ser pausado manualmente.' },
                  { icon: Wifi, title: 'Conexão estável', desc: 'Garanta uma conexão estável. Em caso de falha técnica, suas respostas são salvas automaticamente.' },
                  { icon: Monitor, title: 'Ambiente adequado', desc: 'Escolha um local tranquilo e sem interrupções, como em uma prova real.' },
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

              {/* CTA */}
              <div className="text-center">
                <button
                  onClick={() => navigate(`/simulados/${id}/prova`)}
                  className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Play className="h-5 w-5" />
                  Iniciar Simulado
                </button>
                <p className="text-caption text-muted-foreground mt-4">
                  O resultado será liberado em {formatDate(simulado.resultsReleaseAt)}.
                </p>
              </div>
            </PremiumCard>
          )}
        </motion.div>
      )}

      {/* ── IN PROGRESS (user started) ── */}
      {simulado.status === 'in_progress' && simulado.userState?.started && (
        <PremiumCard className="p-6 md:p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <Play className="h-7 w-7 text-warning" />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Simulado em andamento</h2>
          <p className="text-body text-muted-foreground mb-6 max-w-md mx-auto">
            Você já iniciou este simulado. Continue de onde parou.
          </p>
          <button
            onClick={() => navigate(`/simulados/${id}/prova`)}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
          >
            <Play className="h-4 w-4" />
            Continuar Simulado
          </button>
        </PremiumCard>
      )}

      {/* ── CLOSED WAITING ── */}
      {simulado.status === 'closed_waiting' && (
        <PremiumCard className="p-6 md:p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Janela encerrada</h2>
          <p className="text-body text-muted-foreground mb-2 max-w-md mx-auto">
            A janela de execução deste simulado foi encerrada.
          </p>
          <p className="text-body text-muted-foreground max-w-md mx-auto">
            O resultado e gabarito serão liberados em <strong>{formatDate(simulado.resultsReleaseAt)}</strong>.
          </p>
          <button className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors">
            <Bell className="h-4 w-4" />
            Receber aviso por e-mail
          </button>
        </PremiumCard>
      )}

      {/* ── RESULTS AVAILABLE / COMPLETED ── */}
      {hasResults && (
        <PremiumCard className="p-6 md:p-8 text-center">
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

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={`/simulados/${id}/resultado`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
            >
              Ver Resultado
            </Link>
            <Link
              to={`/simulados/${id}/correcao`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors"
            >
              Ver Correção
            </Link>
            <Link
              to="/desempenho"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors"
            >
              Ver Desempenho
            </Link>
            <Link
              to="/ranking"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors"
            >
              Ver Ranking
            </Link>
          </div>
        </PremiumCard>
      )}

      {/* Theme tags */}
      {simulado.themeTags.length > 0 && (
        <div className="mt-6">
          <SectionHeader title="Áreas abordadas" />
          <div className="flex flex-wrap gap-2">
            {simulado.themeTags.map(tag => (
              <span key={tag} className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-body-sm font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
