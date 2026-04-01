import { useMemo, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Info, Play, Lock, CheckCircle2, Clock, Coffee, Calendar,
  ChevronDown, ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, intervalToDuration, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useSimulados } from "@/hooks/useSimulados";
import type { SimuladoWithStatus } from "@/types";

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-[220px] rounded-[24px] bg-muted/40" />
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[80px] rounded-xl bg-muted/30 ml-8" />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SimuladosPage() {
  const prefersReducedMotion = useReducedMotion();
  const { simulados, loading, error, refetch } = useSimulados();

  const heroSimulado = useMemo(() => {
    const active = simulados.find(s => s.status === "available" || s.status === "in_progress");
    if (active) return active;
    const upcomingSorted = simulados
      .filter(s => s.status === "upcoming")
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));
    return upcomingSorted[0] ?? null;
  }, [simulados]);

  const timelineItems = useMemo(() => {
    const heroId = heroSimulado?.id;
    const finished = simulados
      .filter(s =>
        (s.status === "closed_waiting" || s.status === "completed" || s.status === "available_late") &&
        s.id !== heroId
      )
      .sort((a, b) => Date.parse(b.executionWindowStart) - Date.parse(a.executionWindowStart));
    const upcomingRest = simulados
      .filter(s => s.status === "upcoming" && s.id !== heroId)
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));
    return [...finished, ...upcomingRest];
  }, [simulados, heroSimulado]);

  if (loading) {
    return (
      <>
        <PageHeader title="Simulados" badge="ENAMED 2026" />
        <LoadingSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Simulados" badge="ENAMED 2026" />
        <EmptyState
          variant="error"
          title="Não foi possível carregar os simulados"
          description={error}
          onRetry={() => refetch()}
          backHref="/"
          backLabel="Voltar ao início"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Simulados"
        subtitle="100 questões inéditas no modelo ENAMED, elaboradas pelos professores do SanarFlix PRO."
        subtitlePlacement="inline-end"
        badge="ENAMED 2026"
      />

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : 0.05 }}
        className="mb-6"
      >
        <HowItWorksCard />
      </motion.div>

      {heroSimulado ? (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          className="mb-8"
        >
          <HeroCard sim={heroSimulado} />
        </motion.div>
      ) : (
        simulados.length === 0 && (
          <EmptyState
            title="Nenhum simulado disponível no momento"
            description="Fique de olho, em breve novos simulados serão publicados!"
            backHref="/"
            backLabel="Voltar ao início"
          />
        )
      )}

      {timelineItems.length > 0 && (
        <TimelineSection items={timelineItems} reduced={!!prefersReducedMotion} />
      )}
    </>
  );
}

// ─── Sub-component stubs (replaced in subsequent tasks) ──────────────────────

function HowItWorksCard() {
  return (
    <div
      className="relative rounded-xl bg-white overflow-hidden"
      style={{
        boxShadow: "0 2px 12px rgba(142,31,61,.08), 0 1px 3px rgba(142,31,61,.06)",
      }}
    >
      {/* Wine top border */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, #8e1f3d 0%, transparent 100%)" }}
      />
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          {/* Icon box */}
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
            style={{
              background: "rgba(142,31,61,.12)",
              border: "1px solid rgba(142,31,61,.18)",
            }}
          >
            <Info className="w-4 h-4" style={{ color: "#8e1f3d" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground mb-1">Como funciona</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Cada simulado tem uma janela oficial para participar do ranking nacional. Depois dela, o mesmo simulado continua disponível com a mesma experiência e correção — ideal para se preparar com referência (nessa modalidade a realização não entra no ranking). Resultado, gabarito e ranking da prova são liberados após o encerramento.
            </p>
            {/* Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "Não é possível pausar",
                "Resultado liberado após a janela",
                "Ranking disponível após encerramento",
              ].map(pill => (
                <span
                  key={pill}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(142,31,61,.08)",
                    color: "#8e1f3d",
                    border: "1px solid rgba(142,31,61,.14)",
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDeadlineTicker(windowEnd: string): string {
  const end = parseISO(windowEnd);
  const diff = end.getTime() - Date.now();
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `Janela fecha em ${days} dia${days > 1 ? "s" : ""} e ${hours}h`;
  if (hours > 0) {
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    return `Janela fecha em ${hours}h${mins ? ` e ${mins}min` : ""}`;
  }
  return `Janela fecha em breve`;
}

function HeroCard({ sim }: { sim: SimuladoWithStatus }) {
  if (sim.status === "available" || sim.status === "in_progress") {
    return <HeroCardActive sim={sim} />;
  }
  if (sim.status === "upcoming") {
    return <HeroCardUpcoming sim={sim} />;
  }
  return null;
}

function HeroCardActive({ sim }: { sim: SimuladoWithStatus }) {
  const isInProgress = sim.status === "in_progress";
  const alreadyStarted = sim.userState?.started && !sim.userState.finished;
  const ctaHref = alreadyStarted
    ? `/simulados/${sim.slug}/prova`
    : `/simulados/${sim.slug}/start`;
  const ctaLabel = alreadyStarted ? "Continuar Simulado" : "Iniciar Simulado";

  return (
    <div
      className="relative w-full rounded-[24px] overflow-hidden p-5 md:p-6"
      style={{
        background: "linear-gradient(142deg, #5a1530 0%, #2e0c1e 55%, #160610 100%)",
        border: "1px solid rgba(232,56,98,.28)",
      }}
    >
      {/* White top thread */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.12) 40%, transparent)" }}
      />
      {/* Glow 1 */}
      <div
        className="pointer-events-none absolute -top-12 -left-12 w-64 h-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(232,56,98,.2) 0%, transparent 70%)" }}
      />
      {/* Glow 2 */}
      <div
        className="pointer-events-none absolute -bottom-16 -right-8 w-72 h-72 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(142,31,61,.18) 0%, transparent 65%)" }}
      />
      {/* Lateral overlay */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{ background: "radial-gradient(ellipse at right, rgba(90,21,48,.4) 0%, transparent 70%)" }}
      />

      <div className="relative z-10">
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="sim-dot-pulse w-2 h-2 rounded-full"
              style={{ background: "#e83862" }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
              {isInProgress ? "Em andamento" : "Janela aberta"}
            </span>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.7)",
            }}
          >
            #{sim.sequenceNumber}
          </span>
        </div>

        {/* Title */}
        <h2
          className="font-bold text-white mb-3"
          style={{ fontSize: "clamp(18px, 3.5vw, 22px)" }}
        >
          {sim.title}
        </h2>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-5 text-white/60 text-xs">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {format(parseISO(sim.executionWindowStart), "dd/MM", { locale: ptBR })}
            {" – "}
            {format(parseISO(sim.executionWindowEnd), "dd/MM", { locale: ptBR })}
          </span>
          <span>{sim.questionsCount} questões</span>
        </div>

        {/* Deadline ticker */}
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-5 text-xs font-medium"
          style={{
            background: "rgba(232,56,98,.1)",
            border: "1px solid rgba(232,56,98,.18)",
            color: "rgba(255,255,255,.75)",
          }}
        >
          <Clock className="w-3.5 h-3.5 shrink-0 text-[#e83862]" />
          {formatDeadlineTicker(sim.executionWindowEnd)} — realize agora para entrar no ranking
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2">
          <Link
            to={ctaHref}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "#e83862", color: "#fff" }}
          >
            <Play className="w-4 h-4" />
            {ctaLabel}
          </Link>
          <button
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.75)",
            }}
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
          >
            Como funciona
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroCardUpcoming({ sim }: { sim: SimuladoWithStatus }) {
  // Stub — implemented in Task 5
  return (
    <div className="h-[220px] rounded-[24px] bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">
      HeroCardUpcoming stub — {sim.title}
    </div>
  );
}

function TimelineSection({ items, reduced }: { items: SimuladoWithStatus[]; reduced: boolean }) {
  return (
    <div className="text-muted-foreground text-sm">
      TimelineSection stub — {items.length} items
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TimelineItem({ sim, index, reduced }: { sim: SimuladoWithStatus; index: number; reduced: boolean }) {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CountdownBlock({ label, value }: { label: string; value: string }) {
  return null;
}
