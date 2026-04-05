import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { PageTransition } from "@/components/premium/PageTransition";
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
  Clock, Play, Zap, FileText, Trophy, Check,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles,
  CalendarPlus, Maximize2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SimuladoWithStatus } from "@/types";
import { cn } from "@/lib/utils";

const CHECKLIST_BASE = [
  { key: "duration", icon: Clock, title: "Duração da prova", getDesc: (s: { estimatedDuration: string; questionsCount: number }) => `${s.estimatedDuration} · ${s.questionsCount} questões` },
  { key: "noPause", icon: Zap, title: "Sem pausa", getDesc: () => "O cronômetro não pode ser pausado após iniciar." },
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
      icon: Trophy,
      title: "Entendi sobre o ranking",
      getDesc: () =>
        "Esta realização não conta para o ranking nacional — a janela oficial encerrou.",
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
  const ctaActive = isVeteran || allChecked;

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
    <PageTransition>

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
            <div
              data-testid="arena-card"
              className="relative overflow-hidden -mx-4 md:-mx-8 -mt-6 md:-mt-8 -mb-6 md:-mb-8 min-h-[calc(100vh-64px)] flex flex-col"
              style={{
                background: [
                  "radial-gradient(ellipse 500px 380px at 98% 8%, rgba(160,38,72,0.32) 0%, transparent 65%)",
                  "radial-gradient(ellipse 380px 380px at 2% 92%, rgba(120,22,52,0.22) 0%, transparent 60%)",
                  "radial-gradient(ellipse 600px 300px at 50% 110%, rgba(90,12,36,0.18) 0%, transparent 55%)",
                  "linear-gradient(155deg, #0e0810 0%, #1c0a14 50%, #2e1222 100%)",
                ].join(", "),
              }}
            >
              <div className="relative z-10 px-6 pt-8 pb-8 md:px-16 md:pt-12 md:pb-10 flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">

              {/* ── Top section ── */}
              <div className="text-center mb-5 md:mb-7">
                {/* Eyebrow */}
                <div
                  className="inline-flex items-center gap-1.5 mb-3.5"
                  style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-blink" style={{ background: "hsl(345,65%,62%)" }} />
                  Simulado #{simulado.sequenceNumber} · ENAMED 2026
                </div>

                {/* Headline */}
                <h2
                  className="font-extrabold text-white text-center mb-2.5"
                  style={{ fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: "-0.045em", lineHeight: "0.95" }}
                >
                  {isVeteran ? "Tudo" : "Pronto para"}
                  <br />
                  <em className="not-italic" style={{ color: "hsl(345,62%,65%)" }}>
                    {isVeteran ? "pronto?" : "começar?"}
                  </em>
                </h2>

                {/* Description — only for non-veterans */}
                {!isVeteran && (
                  <p
                    className="text-[13px] md:text-[15px] leading-relaxed max-w-[440px] mx-auto mb-4"
                    style={{ color: "rgba(255,255,255,0.38)" }}
                  >
                    Confirme os itens abaixo antes de entrar. A prova não pode ser pausada.
                  </p>
                )}

                {/* available_late info banner */}
                {simulado.status === "available_late" && (
                  <div
                    className="inline-flex items-start gap-3 px-4 py-3 rounded-xl mb-5 max-w-lg text-left"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <Sparkles
                      className="h-4 w-4 shrink-0 mt-0.5"
                      style={{ color: "hsl(345,65%,65%)" }}
                      aria-hidden
                    />
                    <span className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                      Você faz agora o mesmo simulado completo da preparação nacional.{" "}
                      <strong style={{ color: "rgba(255,255,255,0.8)" }}>
                        Sua nota não entra no ranking nacional
                      </strong>{" "}
                      porque a janela oficial encerrou — resultado e gabarito seguem valendo para o seu estudo.
                    </span>
                  </div>
                )}

                {/* Meta chips */}
                <div className="flex items-center justify-center gap-1.5 md:gap-2 flex-wrap">
                  {[
                    { icon: Clock, label: simulado.estimatedDuration },
                    { icon: FileText, label: `${simulado.questionsCount} questões` },
                    ...(simulado.status !== "available_late"
                      ? [{ icon: Trophy, label: "Conta no ranking nacional" }]
                      : []),
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-semibold"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.62)",
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Execution window */}
                <p
                  className="text-[12px] mt-4"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Janela de execução: {formatDate(simulado.executionWindowStart)} — {formatDate(simulado.executionWindowEnd)}
                </p>
              </div>

              {/* Divider */}
              <div
                className="w-full h-px mb-7"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)",
                }}
              />

              {/* ── Veteran compact row ── */}
              {isVeteran && (
                <div className="text-center mb-7">
                  {/* Compact info pills */}
                  <div
                    className="inline-flex flex-wrap items-center justify-center gap-3 px-5 py-3 rounded-xl mb-5"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <span
                      className="flex items-center gap-1.5 text-[12px] font-semibold"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {simulado.questionsCount} questões · {simulado.estimatedDuration}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                    <span
                      className="flex items-center gap-1.5 text-[12px] font-semibold"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Sem pausa
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                    <span
                      className="flex items-center gap-1.5 text-[12px] font-semibold"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      Tela cheia
                    </span>
                  </div>

                  {/* Veteran CTA — immediately active */}
                  <button
                    type="button"
                    onClick={() => navigate(`/simulados/${id}/prova`)}
                    className="inline-flex items-center gap-2.5 rounded-[14px] font-bold transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(345,65%,62%)] focus-visible:ring-offset-2"
                    style={{
                      padding: "17px 56px",
                      fontSize: "16px",
                      letterSpacing: "0.02em",
                      background: "linear-gradient(135deg, hsl(345,65%,38%) 0%, hsl(345,65%,26%) 100%)",
                      color: "#fff",
                      border: "1.5px solid transparent",
                      boxShadow:
                        "0 10px 40px hsl(345 65% 32% / 0.6), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
                    }}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Iniciar Simulado
                  </button>

                  {/* Toggle to show/hide full checklist */}
                  <button
                    type="button"
                    onClick={() => setShowFullChecklist((v) => !v)}
                    className="text-[11px] mt-3 underline underline-offset-2 transition-colors hover:opacity-70"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {showFullChecklist ? "ocultar detalhes ↑" : "ver detalhes ↓"}
                  </button>
                </div>
              )}

              {/* Checklist completo — sempre para novatos, colapsável para veteranos */}
              {(!isVeteran || showFullChecklist) && (
                <>
                  {/* ── Progress bar ── */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: "rgba(255,255,255,0.3)" }}
                      >
                        Checklist de confirmação
                      </span>
                      <span
                        className="text-[12px] font-bold tabular-nums"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        <span style={{ color: "hsl(345,65%,65%)" }}>{checkedItems.size}</span>
                        {" "}de {checklistItems.length} itens confirmados
                      </span>
                    </div>
                    <div
                      className="w-full h-[3px] rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{
                          width: `${checklistItems.length > 0 ? (checkedItems.size / checklistItems.length) * 100 : 0}%`,
                          background: "linear-gradient(90deg, hsl(345,60%,38%), hsl(345,65%,58%))",
                          boxShadow: "0 0 10px hsl(345 65% 52% / 0.55)",
                        }}
                      />
                    </div>
                  </div>

                  {/* ── Checklist grid ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-9">
                    {checklistItems.map((item, index) => {
                      const checked = checkedItems.has(item.key);
                      const isLastOdd =
                        checklistItems.length % 2 === 1 && index === checklistItems.length - 1;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleCheck(item.key)}
                          className={cn(
                            "flex items-start gap-3.5 text-left transition-all duration-200 rounded-[14px]",
                            "hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(345,65%,62%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0810]",
                            isLastOdd && "sm:col-span-2 sm:mx-auto sm:w-1/2"
                          )}
                          style={{
                            padding: "18px 20px",
                            background: checked ? "rgba(196,90,114,0.09)" : "rgba(255,255,255,0.04)",
                            border: `1.5px solid ${checked ? "rgba(196,90,114,0.3)" : "rgba(255,255,255,0.07)"}`,
                          }}
                        >
                          {/* Icon wrap */}
                          <div
                            className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0 transition-all duration-200"
                            style={{
                              background: checked ? "rgba(196,90,114,0.16)" : "rgba(255,255,255,0.06)",
                              border: `1px solid ${checked ? "rgba(196,90,114,0.36)" : "rgba(255,255,255,0.08)"}`,
                              color: checked ? "hsl(345,65%,72%)" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            <item.icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[13.5px] font-bold leading-[1.2] mb-0.5 transition-colors"
                              style={{ color: checked ? "#fff" : "rgba(255,255,255,0.72)" }}
                            >
                              {item.title}
                            </p>
                            <p
                              className="text-[12px] leading-[1.4] transition-colors"
                              style={{ color: checked ? "rgba(255,255,255,0.48)" : "rgba(255,255,255,0.3)" }}
                            >
                              {item.getDesc(simulado)}
                            </p>
                          </div>

                          {/* Checkbox */}
                          <div
                            className="w-[18px] h-[18px] rounded-[6px] flex-shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200"
                            style={{
                              background: checked ? "hsl(345,65%,55%)" : "transparent",
                              border: `1.5px solid ${checked ? "hsl(345,65%,55%)" : "rgba(255,255,255,0.18)"}`,
                            }}
                          >
                            {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── CTA ── */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => navigate(`/simulados/${id}/prova`)}
                      // Veterans bypass the checklist requirement — CTA always active
                      disabled={!ctaActive}
                      className={cn(
                        "inline-flex items-center gap-2.5 rounded-[14px] font-bold transition-all duration-300",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(345,65%,62%)] focus-visible:ring-offset-2",
                        ctaActive ? "hover:-translate-y-0.5 group" : "cursor-not-allowed"
                      )}
                      onMouseEnter={(e) => {
                        if (ctaActive) {
                          (e.currentTarget as HTMLButtonElement).style.boxShadow =
                            "0 16px 52px hsl(345 65% 32% / 0.75), 0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.14)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (ctaActive) {
                          (e.currentTarget as HTMLButtonElement).style.boxShadow =
                            "0 10px 40px hsl(345 65% 32% / 0.6), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)";
                        }
                      }}
                      style={{
                        padding: "17px 56px",
                        fontSize: "16px",
                        letterSpacing: "0.02em",
                        cursor: ctaActive ? "pointer" : "not-allowed",
                        background: ctaActive
                          ? "linear-gradient(135deg, hsl(345,65%,38%) 0%, hsl(345,65%,26%) 100%)"
                          : "rgba(255,255,255,0.06)",
                        color: ctaActive ? "#fff" : "rgba(255,255,255,0.25)",
                        border: `1.5px solid ${ctaActive ? "transparent" : "rgba(255,255,255,0.1)"}`,
                        boxShadow: ctaActive
                          ? "0 10px 40px hsl(345 65% 32% / 0.6), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)"
                          : "none",
                      }}
                    >
                      <Play className="h-4 w-4 fill-current transition-transform duration-200 group-hover:translate-x-0.5" />
                      Iniciar Simulado
                    </button>
                    <p
                      className="text-[11.5px] mt-3 transition-colors"
                      style={{ color: ctaActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)" }}
                    >
                      {ctaActive
                        ? "Tudo certo — boa prova! 🎯"
                        : "Confirme todos os itens acima para continuar"}
                    </p>
                  </div>
                </>
              )}

              {/* ── Footer ── */}
              <p
                className="text-center mt-6 uppercase tracking-[0.05em]"
                style={{ fontSize: "11px", color: "rgba(255,255,255,0.18)" }}
              >
                Resultado liberado em {formatDate(simulado.resultsReleaseAt)}
              </p>

              </div>
            </div>
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

    </PageTransition>
  );
}
