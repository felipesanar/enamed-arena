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

function HeroCard({ sim }: { sim: SimuladoWithStatus }) {
  return (
    <div className="h-[220px] rounded-[24px] bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">
      HeroCard stub — {sim.title}
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
