import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { PageTransition } from "@/components/premium/PageTransition";
import { PremiumCard } from "@/components/PremiumCard";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SimuladoResultNav } from "@/components/simulado/SimuladoResultNav";
import { useUser } from "@/contexts/UserContext";
import { useSimuladoDetail } from "@/hooks/useSimuladoDetail";
import { useSimulados } from "@/hooks/useSimulados";
import {
  formatDate,
  canAccessSimulado,
  canViewResults,
  buildGoogleCalendarUrl,
} from "@/lib/simulado-helpers";
import {
  Clock, Play, Zap, FileText, Trophy, Check,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles,
  CalendarPlus, CalendarDays, Maximize2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SimuladoWithStatus } from "@/types";
import { cn } from "@/lib/utils";
import { trackEvent } from '@/lib/analytics';
import { useIsMobile } from "@/hooks/use-mobile";

/** Padding que o DashboardLayout aplicava ao `main`; necessário na rota arena (`main` com `p-0`). */
function SimuladoDetailPaddedShell({ children, className }: { children: ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  const { profile } = useUser();
  const isGuestMobile = isMobile && (profile?.segment ?? "guest") === "guest";
  return (
    <div
      className={cn(
        "px-4 md:px-8 py-6 md:py-8",
        isMobile &&
          cn(
            isGuestMobile
              ? "pt-[calc(3.5rem+3.25rem+env(safe-area-inset-top,0px)+0.75rem)]"
              : "pt-[calc(3.5rem+env(safe-area-inset-top,0px)+0.75rem)]",
            "pb-[calc(5.75rem+max(0.75rem,env(safe-area-inset-bottom,0px)))]"
          ),
        className
      )}
    >
      {children}
    </div>
  );
}

const ARENA_PREMIUM_BG = [
  "radial-gradient(ellipse 28% 42% at 0% 0%, rgba(66,20,36,0.92) 0%, transparent 60%)",
  "radial-gradient(ellipse 22% 35% at 0% 100%, rgba(22,7,14,0.85) 0%, transparent 55%)",
  "radial-gradient(ellipse 55% 48% at 100% 0%, rgba(160,38,72,0.38) 0%, transparent 62%)",
  "linear-gradient(90deg, #361019 0%, #2c1016 4%, #1a0a10 15%, #0e0810 33%, #100810 68%, #1c0a14 100%)",
].join(", ");

function PreExamArenaGradient({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { profile } = useUser();
  const isGuestMobile = isMobile && (profile?.segment ?? "guest") === "guest";
  return (
    <div
      data-testid="arena-card"
      className={cn(
        "relative w-full flex flex-col min-h-[100dvh] md:min-h-screen",
        isMobile &&
          cn(
            isGuestMobile
              ? "pt-[calc(3.5rem+3.25rem+env(safe-area-inset-top,0px)+0.75rem)]"
              : "pt-[calc(3.5rem+env(safe-area-inset-top,0px)+0.75rem)]",
            "pb-[calc(5.75rem+max(0.75rem,env(safe-area-inset-bottom,0px)))]"
          )
      )}
      style={{
        background: ARENA_PREMIUM_BG,
        borderLeft: "none",
      }}
    >
      {children}
    </div>
  );
}

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

  const detailTracked = useRef(false);
  useEffect(() => {
    if (!simulado || detailTracked.current) return;
    detailTracked.current = true;
    trackEvent('simulado_detail_viewed', {
      simulado_id: simulado.id,
      simulado_sequence: simulado.sequenceNumber ?? 0,
      simulado_status: simulado.status,
      user_started: simulado.userState?.started ?? false,
      checklist_required: simulado.status === 'available' || simulado.status === 'available_late',
    });
  }, [simulado]);

  if (loading) {
    return (
      <SimuladoDetailPaddedShell>
        <div className="space-y-4">
          <SkeletonCard />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <SkeletonCard />
        </div>
      </SimuladoDetailPaddedShell>
    );
  }

  if (!simulado || error) {
    return (
      <SimuladoDetailPaddedShell>
        <EmptyState
          variant="error"
          title="Simulado não encontrado"
          description={error || "O simulado que você procura não existe ou foi removido."}
          onRetry={() => refetch()}
          backHref="/simulados"
          backLabel="Voltar ao calendário"
        />
      </SimuladoDetailPaddedShell>
    );
  }

  const isAccessible = canAccessSimulado(simulado.status);
  const hasResults = canViewResults(simulado.status);

  return (
    <PageTransition>

      {/* Upcoming */}
      {simulado.status === "upcoming" && (
        <SimuladoDetailPaddedShell>
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
        </SimuladoDetailPaddedShell>
      )}

      {/* Accessible + not started: checklist + CTA */}
      {isAccessible && !simulado.userState?.started && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          className="mb-0"
        >
          {!isOnboardingComplete ? (
            <SimuladoDetailPaddedShell>
              <PremiumCard variant="hero" className="text-center mb-8">
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
            </SimuladoDetailPaddedShell>
          ) : (
            <PreExamArenaGradient>
              <div className="relative z-10 px-6 py-8 pb-10 md:px-16 md:py-12 md:pb-10 flex flex-col justify-start max-w-4xl mx-auto w-full">

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

                {/* Meta info card */}
                <div
                  className="w-full max-w-md mx-auto rounded-2xl px-5 py-4 flex flex-col items-center gap-3"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 4px 24px -8px rgba(0,0,0,0.3)",
                  }}
                >
                  {/* Chips row */}
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {[
                      { icon: Clock, label: simulado.estimatedDuration },
                      { icon: FileText, label: `${simulado.questionsCount} questões` },
                      ...(simulado.status !== "available_late"
                        ? [{ icon: Trophy, label: "Conta no ranking nacional" }]
                        : []),
                    ].map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] md:text-[13px] font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.72)",
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ opacity: 0.7 }} />
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Divider inside card */}
                  <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

                  {/* Execution window */}
                  <div className="flex items-center gap-2 text-[12px] md:text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <CalendarDays className="h-3.5 w-3.5" style={{ opacity: 0.5 }} />
                    <span>
                      Janela de execução: <span style={{ color: "rgba(255,255,255,0.6)" }}>{formatDate(simulado.executionWindowStart)} — {formatDate(simulado.executionWindowEnd)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div
                className="w-full h-px mb-5"
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
                  <div className="mb-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
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
                            padding: "14px 16px",
                            background: checked ? "rgba(196,90,114,0.09)" : "rgba(255,255,255,0.04)",
                            border: `1.5px solid ${checked ? "rgba(196,90,114,0.3)" : "rgba(255,255,255,0.07)"}`,
                          }}
                        >
                          {/* Icon wrap */}
                          <div
                            className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0 transition-all duration-200"
                            style={{
                              background: checked ? "rgba(196,90,114,0.16)" : "rgba(255,255,255,0.06)",
                              border: `1px solid ${checked ? "rgba(196,90,114,0.36)" : "rgba(255,255,255,0.08)"}`,
                              color: checked ? "hsl(345,65%,72%)" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            <item.icon className="w-4 h-4" strokeWidth={1.6} />
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[12.5px] font-bold leading-[1.2] mb-0.5 transition-colors"
                              style={{ color: checked ? "#fff" : "rgba(255,255,255,0.72)" }}
                            >
                              {item.title}
                            </p>
                            <p
                              className="text-[11px] leading-[1.4] transition-colors"
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
                        padding: "14px 48px",
                        fontSize: "15px",
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
            </PreExamArenaGradient>
          )}
        </motion.div>
      )}

      {/* In progress */}
      {simulado.status === "in_progress" && simulado.userState?.started && (
        <SimuladoDetailPaddedShell>
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
        </SimuladoDetailPaddedShell>
      )}

      {/* Closed waiting */}
      {simulado.status === "closed_waiting" && (
        <SimuladoDetailPaddedShell>
          <PremiumCard variant="hero" className="text-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-heading-2 text-foreground mb-2">Janela encerrada</h2>
            <p className="text-body text-muted-foreground max-w-md mx-auto">
              O resultado e gabarito serão liberados em <strong>{formatDate(simulado.resultsReleaseAt)}</strong>.
            </p>
          </PremiumCard>
        </SimuladoDetailPaddedShell>
      )}

      {/* Results available */}
      {hasResults && (
        <SimuladoDetailPaddedShell>
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
        </SimuladoDetailPaddedShell>
      )}

      {/* Fallback */}
      {isAccessible && simulado.userState?.started && simulado.status !== "in_progress" && (
        <SimuladoDetailPaddedShell>
          <PremiumCard variant="hero" className="text-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-heading-2 text-foreground mb-2">Simulado já realizado</h2>
            <p className="text-body text-muted-foreground max-w-md mx-auto">
              Você já realizou este simulado. O resultado será liberado em <strong>{formatDate(simulado.resultsReleaseAt)}</strong>.
            </p>
          </PremiumCard>
        </SimuladoDetailPaddedShell>
      )}

    </PageTransition>
  );
}
