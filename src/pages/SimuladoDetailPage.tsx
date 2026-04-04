import { useState, useMemo, useEffect } from "react";
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
import { useSimulados } from "@/hooks/useSimulados";
import {
  formatDate,
  formatDateTime,
  canAccessSimulado,
  canViewResults,
  buildGoogleCalendarUrl,
} from "@/lib/simulado-helpers";
import {
  Clock, Play, AlertTriangle,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles, Square, CheckSquare,
  CalendarPlus, Maximize2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SimuladoWithStatus } from "@/types";
import { cn } from "@/lib/utils";

const CHECKLIST_BASE = [
  { key: "duration", icon: Clock, title: "Duração da prova", getDesc: (s: { estimatedDuration: string; questionsCount: number }) => `${s.estimatedDuration} · ${s.questionsCount} questões` },
  { key: "noPause", icon: AlertTriangle, title: "Sem pausa", getDesc: () => "O cronômetro não pode ser pausado após iniciar." },
  { key: "connection", icon: Wifi, title: "Conexão estável", getDesc: () => "Respostas salvas automaticamente. Mantenha conexão ativa." },
  { key: "environment", icon: Monitor, title: "Ambiente adequado", getDesc: () => "Local tranquilo, sem interrupções." },
  { key: "fullscreen", icon: Maximize2, title: "Prova em tela cheia", getDesc: () => "A prova abre automaticamente em fullscreen. Sair do fullscreen é registrado." },
] as const;

type BaseChecklistKey = (typeof CHECKLIST_BASE)[number]["key"];
type ChecklistKey = BaseChecklistKey | "rankingNational";

type ChecklistItem = {
  key: ChecklistKey;
  icon: LucideIcon;
  title: string;
  getDesc: (s: SimuladoWithStatus) => string;
};

function buildChecklistItems(simulado: SimuladoWithStatus): ChecklistItem[] {
  const base: ChecklistItem[] = CHECKLIST_BASE.map((item) => ({
    key: item.key,
    icon: item.icon,
    title: item.title,
    getDesc: item.getDesc,
  }));
  if (simulado.status === "available_late") {
    base.push({
      key: "rankingNational",
      icon: CheckCircle2,
      title: "Entendi sobre o ranking nacional",
      getDesc: () =>
        "Confirmo que esta realização não conta para o ranking nacional, pois a janela oficial encerrou.",
    });
  }
  return base;
}

export default function SimuladoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { isOnboardingComplete } = useUser();
  const [checkedItems, setCheckedItems] = useState<Set<ChecklistKey>>(new Set());

  // Detect veteran: user who has completed at least one exam
  const { simulados: allSimulados } = useSimulados();
  const isVeteran = allSimulados.some(s => s.userState?.finished === true);
  const [showFullChecklist, setShowFullChecklist] = useState(false);

  const { simulado, loading, error, refetch } = useSimuladoDetail(id);

  const checklistItems = useMemo(
    () => (simulado ? buildChecklistItems(simulado) : []),
    [simulado]
  );

  useEffect(() => {
    setCheckedItems(new Set());
  }, [simulado?.id, simulado?.status]);

  const toggleCheck = (key: ChecklistKey) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allChecked =
    checklistItems.length > 0 && checkedItems.size === checklistItems.length;

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard />
      </div>
    );
  }

  if (!simulado || error) {
    return (
      <EmptyState
        variant="error"
        title="Simulado não encontrado"
        description={error || "O simulado que você procura não existe ou foi removido."}
        onRetry={() => refetch()}
        backHref="/simulados"
        backLabel="Voltar ao calendário"
      />
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

      {/* Upcoming */}
      {simulado.status === "upcoming" && (
        <PremiumCard variant="hero" className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-info/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-7 w-7 text-info" />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Simulado em breve</h2>
          <p className="text-body text-muted-foreground mb-2 max-w-md mx-auto">
            A janela de execução abrirá em <strong>{formatDate(simulado.executionWindowStart)}</strong>.
          </p>
          <p className="text-body-sm text-muted-foreground max-w-md mx-auto mb-6">
            Prepare-se para {simulado.questionsCount} questões em {simulado.estimatedDuration} de prova.
          </p>
          <a
            href={buildGoogleCalendarUrl(simulado)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-accent/50 text-body font-medium text-foreground hover:bg-accent transition-colors"
          >
            <CalendarPlus className="h-4 w-4 text-primary" />
            Adicionar ao Google Agenda
          </a>
        </PremiumCard>
      )}

      {/* Accessible + not started: checklist + CTA */}
      {isAccessible && !simulado.userState?.started && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          className="mb-8"
        >
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
              <div className="text-center mb-6">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Play className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-heading-2 text-foreground mb-2">
                  {isVeteran ? "Tudo pronto?" : "Pronto para começar?"}
                </h2>
                {simulado.status === "available_late" && (
                  <div className="inline-flex items-start gap-2 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/15 text-left text-body-sm text-foreground max-w-lg mx-auto mb-4">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
                    <span>
                      Você faz agora o mesmo simulado completo da preparação nacional.{" "}
                      <strong className="text-foreground">Sua nota não entra no ranking nacional</strong>{" "}
                      porque a janela oficial encerrou — resultado e gabarito seguem valendo para o seu estudo.
                    </span>
                  </div>
                )}
                {!isVeteran && (
                  <p className="text-body text-muted-foreground max-w-lg mx-auto">
                    Confirme os itens abaixo antes de iniciar. A prova não pode ser pausada.
                  </p>
                )}
              </div>

              {/* Veteran: banner resumido */}
              {isVeteran && (
                <div className="max-w-2xl mx-auto mb-6">
                  <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border text-body-sm text-foreground mb-4">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {simulado.questionsCount} questões · {simulado.estimatedDuration}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      Sem pausa
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Maximize2 className="h-4 w-4 text-muted-foreground" />
                      Tela cheia
                    </span>
                  </div>
                  <div className="text-center mb-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/simulados/${id}/prova`)}
                      className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-body-lg font-semibold transition-all duration-200 bg-primary text-primary-foreground hover:bg-wine-hover shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
                    >
                      <Play className="h-5 w-5" />
                      Iniciar Simulado
                    </button>
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowFullChecklist(v => !v)}
                      className="text-caption text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                    >
                      {showFullChecklist ? "ocultar detalhes ↑" : "ver detalhes ↓"}
                    </button>
                  </div>
                </div>
              )}

              {/* Checklist completo — sempre para novatos, colapsável para veteranos */}
              {(!isVeteran || showFullChecklist) && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-8">
                    {checklistItems.map((item) => {
                      const checked = checkedItems.has(item.key);
                      const CheckIcon = checked ? CheckSquare : Square;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleCheck(item.key)}
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200",
                            checked
                              ? "bg-primary/[0.06] border border-primary/20"
                              : "bg-muted/50 border border-transparent hover:border-border"
                          )}
                        >
                          <CheckIcon
                            className={cn(
                              "h-5 w-5 shrink-0 mt-0.5 transition-colors",
                              checked ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                          <div>
                            <p className={cn("text-body font-medium", checked ? "text-foreground" : "text-foreground/80")}>
                              {item.title}
                            </p>
                            <p className="text-body-sm text-muted-foreground">
                              {item.getDesc(simulado)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {!isVeteran && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => navigate(`/simulados/${id}/prova`)}
                        disabled={!allChecked}
                        className={cn(
                          "inline-flex items-center gap-2 px-10 py-4 rounded-xl text-body-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]",
                          allChecked
                            ? "bg-primary text-primary-foreground hover:bg-wine-hover shadow-sm hover:shadow-md"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                      >
                        <Play className="h-5 w-5" />
                        Iniciar Simulado
                      </button>
                      {!allChecked && (
                        <p className="text-caption text-muted-foreground mt-3">
                          Confirme todos os itens acima para prosseguir.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <p className="text-caption text-muted-foreground text-center mt-6">
                Resultado em {formatDate(simulado.resultsReleaseAt)}.
              </p>
            </PremiumCard>
          )}
        </motion.div>
      )}

      {/* In progress */}
      {simulado.status === "in_progress" && simulado.userState?.started && (
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

      {/* Closed waiting */}
      {simulado.status === "closed_waiting" && (
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

      {/* Results available */}
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

      {/* Fallback */}
      {isAccessible && simulado.userState?.started && simulado.status !== "in_progress" && (
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

      {/* Execution window info */}
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
