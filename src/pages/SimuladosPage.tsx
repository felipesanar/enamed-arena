import React, { useMemo, useState, useEffect } from "react";
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

function useCountdown(targetISO: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const target = parseISO(targetISO);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, mins };
}

function CountdownBlock({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center min-w-[52px] rounded-lg px-3 py-2"
      style={{
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <span className="text-xl font-bold text-white tabular-nums leading-none">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/40 mt-1">{label}</span>
    </div>
  );
}

function HeroCardUpcoming({ sim }: { sim: SimuladoWithStatus }) {
  const { days, hours, mins } = useCountdown(sim.executionWindowStart);

  return (
    <div
      className="relative w-full rounded-[24px] overflow-hidden p-5 md:p-6"
      style={{
        background: "linear-gradient(142deg, #3d0d22 0%, #220810 55%, #120408 100%)",
        border: "1px solid rgba(142,31,61,.3)",
      }}
    >
      {/* White top thread */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.08) 40%, transparent)" }}
      />
      {/* Glow subdued */}
      <div
        className="pointer-events-none absolute -top-12 -left-12 w-64 h-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(142,31,61,.15) 0%, transparent 70%)" }}
      />

      <div className="relative z-10">
        {/* Status badge + sequence */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full border-2"
              style={{ borderColor: "rgba(220,140,170,.6)", background: "transparent" }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Em breve
            </span>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.4)",
            }}
          >
            #{sim.sequenceNumber}
          </span>
        </div>

        {/* Title */}
        <h2
          className="font-bold mb-3"
          style={{ color: "rgba(255,255,255,.65)", fontSize: "clamp(18px, 3.5vw, 22px)" }}
        >
          {sim.title}
        </h2>

        {/* Meta row */}
        <div className="flex items-center gap-3 mb-5 text-white/40 text-xs">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Abre em {format(parseISO(sim.executionWindowStart), "dd/MM", { locale: ptBR })}
          </span>
        </div>

        {/* Countdown blocks */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <CountdownBlock label="dias" value={String(days).padStart(2, "0")} />
          <CountdownBlock label="horas" value={String(hours).padStart(2, "0")} />
          <CountdownBlock label="min" value={String(mins).padStart(2, "0")} />
        </div>

        {/* Disabled CTA */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            disabled
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed opacity-50"
            style={{
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.5)",
            }}
          >
            <Lock className="w-4 h-4" />
            Ainda não disponível
          </button>
        </div>

        {/* Info row */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-white/35">
          <Clock className="w-3 h-3" />
          Liberado automaticamente em{" "}
          {format(parseISO(sim.executionWindowStart), "dd/MM 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>
    </div>
  );
}

function TimelineSection({ items, reduced }: { items: SimuladoWithStatus[]; reduced: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          Histórico e próximos
        </span>
        <div className="flex-1 h-px" style={{ background: "rgba(142,31,61,.15)" }} />
      </div>
      <p className="text-[11px] text-muted-foreground mb-5">
        Mais recente primeiro · clique para ver detalhes
      </p>

      {/* Spine + items */}
      <div className="relative">
        <div
          className="absolute left-3 top-2 bottom-0 w-[1.5px]"
          style={{
            background: "linear-gradient(to bottom, rgba(142,31,61,.35), rgba(142,31,61,.04))",
          }}
        />
        <div className="space-y-3 pl-8">
          {visible.map((sim, index) => (
            <TimelineItem key={sim.id} sim={sim} index={index} reduced={reduced} />
          ))}
        </div>
      </div>

      {/* Show more */}
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-4 ml-8 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className="w-4 h-4 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
          {expanded ? "Ver menos" : `Ver todos os anteriores (${items.length - 5} a mais)`}
        </button>
      )}
    </section>
  );
}

const STATUS_CONFIG = {
  in_progress: {
    dotClass: "sim-dot-pulse",
    dotStyle: { background: "#e83862", width: 10, height: 10 } as React.CSSProperties,
    cardBg: "rgba(255,248,250,.9)",
    cardBorder: "rgba(232,56,98,.2)",
    labelColor: "#e83862",
    Icon: Play,
    label: "Em andamento",
  },
  closed_waiting: {
    dotClass: "",
    dotStyle: { background: "#d4a017", width: 10, height: 10 } as React.CSSProperties,
    cardBg: "rgba(252,248,238,.8)",
    cardBorder: "rgba(212,160,23,.22)",
    labelColor: "#a07018",
    Icon: Lock,
    label: "Aguardando",
  },
  completed: {
    dotClass: "",
    dotStyle: { background: "rgba(255,255,255,.7)", width: 10, height: 10, border: "1.5px solid rgba(0,0,0,.15)" } as React.CSSProperties,
    cardBg: "#fff",
    cardBorder: "rgba(0,0,0,.08)",
    labelColor: "#2d8f5a",
    Icon: CheckCircle2,
    label: "Concluído",
  },
  available_late: {
    dotClass: "",
    dotStyle: { background: "transparent", width: 7, height: 7, border: "1.5px solid rgba(158,122,142,.4)" } as React.CSSProperties,
    cardBg: "rgba(244,241,245,.55)",
    cardBorder: "rgba(158,122,142,.18)",
    labelColor: "#9e7a8e",
    Icon: Coffee,
    label: "Fora da janela",
  },
  upcoming: {
    dotClass: "",
    dotStyle: { background: "rgba(220,140,170,.4)", width: 10, height: 10 } as React.CSSProperties,
    cardBg: "rgba(60,15,32,.45)",
    cardBorder: "rgba(142,31,61,.2)",
    labelColor: "rgba(220,140,170,.75)",
    Icon: Clock,
    label: "Em breve",
  },
} as const;

function TimelineItem({ sim, index, reduced }: { sim: SimuladoWithStatus; index: number; reduced: boolean }) {
  const cfg = STATUS_CONFIG[sim.status as keyof typeof STATUS_CONFIG];
  if (!cfg) return null;

  const isUpcoming = sim.status === "upcoming";
  const isCompleted = sim.status === "completed";
  const isInProgress = sim.status === "in_progress";
  const isClosedWaiting = sim.status === "closed_waiting";
  const isAvailableLate = sim.status === "available_late";

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : index * 0.04 }}
      className="relative"
      style={{ opacity: isAvailableLate ? 0.6 : 1 }}
    >
      {/* Timeline dot */}
      <div
        className={`absolute -left-[21px] top-4 rounded-full ${cfg.dotClass}`}
        style={cfg.dotStyle}
      />

      {/* Card */}
      <div
        className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{
          background: cfg.cardBg,
          border: `1px solid ${cfg.cardBorder}`,
        }}
      >
        {/* Left side */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <cfg.Icon className="w-3 h-3 shrink-0" style={{ color: cfg.labelColor }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: cfg.labelColor }}
            >
              {cfg.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{sim.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {format(parseISO(sim.executionWindowStart), "dd/MM/yyyy", { locale: ptBR })} · #{sim.sequenceNumber}
          </p>
        </div>

        {/* Right side */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isCompleted && (
            <>
              <span
                className="font-black leading-none"
                style={{ fontSize: 20, color: "#8e1f3d" }}
              >
                {sim.userState?.score ?? "–"}%
              </span>
              <Link
                to={`/simulados/${sim.slug}/resultado`}
                className="text-xs font-medium flex items-center gap-1 hover:opacity-80"
                style={{ color: "#8e1f3d" }}
              >
                Ver resultado <ArrowRight className="w-3 h-3" />
              </Link>
            </>
          )}
          {isInProgress && (
            <Link
              to={`/simulados/${sim.slug}/prova`}
              className="text-xs font-medium flex items-center gap-1 hover:opacity-80"
              style={{ color: "#e83862" }}
            >
              Continuar <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          {isClosedWaiting && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#a07018" }}>
              <Lock className="w-3 h-3" />
              Aguardando
            </span>
          )}
          {isAvailableLate && (
            <div className="flex flex-col items-end gap-1">
              <Link
                to={`/simulados/${sim.slug}/start`}
                className="text-xs font-medium flex items-center gap-1 hover:opacity-80"
                style={{ color: "#9e7a8e" }}
              >
                Treinar <ArrowRight className="w-3 h-3" />
              </Link>
              <span className="text-[10px] text-muted-foreground text-right leading-tight max-w-[120px]">
                Disponível como treino · não entra no ranking
              </span>
            </div>
          )}
          {isUpcoming && (
            <button
              className="text-xs font-medium flex items-center gap-1 hover:opacity-80"
              style={{ color: "rgba(220,140,170,.8)" }}
            >
              Agenda <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

