import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Lock, Clock, Calendar, CalendarPlus, Monitor, FileText, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { buildGoogleCalendarUrl } from "@/lib/simulado-helpers";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useSimulados } from "@/hooks/useSimulados";
import type { SimuladoWithStatus } from "@/types";
import {
  COMO_FUNCIONA_MODAL_OPEN_EVENT,
  ComoFuncionaSimuladosTrigger,
} from "@/components/simulados/ComoFuncionaTutorial";
import { PageTransition } from "@/components/premium/PageTransition";
import { useOfflineAttempt } from "@/hooks/useOfflineAttempt";
import { SimuladosTimelineSection } from "@/components/simulados/SimuladosTimelineSection";
import { offlineApi } from "@/services/offlineApi";
import { persistOfflineAttempt } from "@/hooks/useOfflineAttempt";
import { toast } from "@/hooks/use-toast";

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
  const navigate = useNavigate();
  const { activeAttempt } = useOfflineAttempt();

  const heroSimulado = useMemo(() => {
    const active = simulados.find(s => s.status === "available" || s.status === "in_progress");
    if (active) return active;
    const upcomingSorted = simulados
      .filter(s => s.status === "upcoming")
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));
    return upcomingSorted[0] ?? null;
  }, [simulados]);

  const timelineItems = useMemo(() => {
    const active = simulados
      .filter(s => s.status === "available" || s.status === "in_progress")
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));
    const finished = simulados
      .filter(s =>
        s.status === "closed_waiting" || s.status === "completed" || s.status === "available_late"
      )
      .sort((a, b) => Date.parse(b.executionWindowStart) - Date.parse(a.executionWindowStart));
    const upcoming = simulados
      .filter(s => s.status === "upcoming")
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));
    return [...active, ...finished, ...upcoming];
  }, [simulados]);

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
    <PageTransition>
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
        <ComoFuncionaSimuladosTrigger />
      </motion.div>

      {/* Offline attempt reminder banner */}
      {activeAttempt && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: "hsl(345, 65%, 10%)",
            borderColor: "hsl(345, 65%, 30%)",
            color: "hsl(345, 65%, 90%)",
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#e83862]" />
            <span>
              Você tem uma prova offline em andamento. Preencha o gabarito digital para registrar seu resultado.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/simulados/${activeAttempt.simulado_slug}/gabarito`)}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "hsl(345, 65%, 30%)", color: "#fff" }}
          >
            Preencher agora
          </button>
        </motion.div>
      )}

      {heroSimulado ? (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          className="mb-8"
        >
          <HeroCard sim={heroSimulado} hasActiveAttempt={!!activeAttempt || !!heroSimulado.userState?.started && !heroSimulado.userState?.finished} />
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
        <SimuladosTimelineSection items={timelineItems} reduced={!!prefersReducedMotion} />
      )}
    </PageTransition>
  );
}

// ─── Sub-component stubs (replaced in subsequent tasks) ──────────────────────

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

function HeroCard({ sim, hasActiveAttempt }: { sim: SimuladoWithStatus; hasActiveAttempt: boolean }) {
  if (sim.status === "available" || sim.status === "in_progress") {
    return <HeroCardActive sim={sim} hasActiveAttempt={hasActiveAttempt} />;
  }
  if (sim.status === "upcoming") {
    return <HeroCardUpcoming sim={sim} />;
  }
  return null;
}

function HeroCardActive({ sim, hasActiveAttempt }: { sim: SimuladoWithStatus; hasActiveAttempt: boolean }) {
  const navigate = useNavigate();
  const isInProgress = sim.status === "in_progress";
  const alreadyStarted = sim.userState?.started && !sim.userState.finished;
  const ctaLabel = alreadyStarted ? "Continuar Simulado" : "Iniciar Simulado";
  const isBlocked = hasActiveAttempt && !alreadyStarted;
  const [showModeModal, setShowModeModal] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineStep, setOfflineStep] = useState('');

  const handleOfflineMode = useCallback(async () => {
    setOfflineLoading(true);
    setOfflineStep('Criando tentativa offline...');
    try {
      // 1. Create offline attempt (server-side clock)
      const attempt = await offlineApi.createOfflineAttempt(sim.id);
      setOfflineStep('Gerando PDF da prova...');

      setOfflineStep('Gerando e baixando PDF...');
      // 2. Request PDF generation + download as blob to avoid popup blockers
      const pdfUrl = await offlineApi.getSignedPdfUrl(sim.id);
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${sim.slug ?? sim.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      // 3. Only AFTER download completes, persist to localStorage
      // This prevents the FloatingOfflineTimer from appearing (and auto-navigating)
      // before the user has actually received the PDF
      persistOfflineAttempt({
        id:                   attempt.attempt_id,
        simulado_id:          sim.id,
        simulado_slug:        attempt.simulado_slug,
        started_at:           attempt.started_at,
        exam_duration_seconds: attempt.exam_duration_seconds,
      });

      setShowModeModal(false);
      toast({ title: "Download iniciado!", description: "O timer offline está ativo na tela." });
    } catch (err) {
      toast({
        title: "Erro ao iniciar modo offline",
        description: (err as Error)?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setOfflineLoading(false);
      setOfflineStep('');
    }
  }, [sim]);

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
          {alreadyStarted ? (
            <Link
              to={`/simulados/${sim.slug}/prova`}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#e83862", color: "#fff" }}
            >
              <Play className="w-4 h-4" />
              {ctaLabel}
            </Link>
          ) : (
            <button
              type="button"
              disabled={isBlocked}
              onClick={() => setShowModeModal(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#e83862", color: "#fff" }}
            >
              {isBlocked ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isBlocked ? "Prova em andamento" : ctaLabel}
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.75)",
            }}
            onClick={() => window.dispatchEvent(new CustomEvent(COMO_FUNCIONA_MODAL_OPEN_EVENT))}
          >
            Como funciona
          </button>
        </div>
      </div>

      {/* Online/offline mode modal */}
      <Dialog open={showModeModal} onOpenChange={setShowModeModal}>
        <DialogContent className="max-w-lg w-full rounded-2xl border border-border p-6 md:p-8 gap-0">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-heading-2 text-foreground text-center">
              Como deseja realizar o simulado?
            </DialogTitle>
            <DialogDescription className="text-body text-muted-foreground text-center mt-2">
              Escolha a experiência que melhor se adapta ao seu momento.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setShowModeModal(false);
                navigate(`/simulados/${sim.slug}/start`);
              }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Monitor className="h-7 w-7 text-primary" />
              </div>
              <p className="text-body font-semibold text-foreground">Experiência online</p>
              <p className="text-body-sm text-muted-foreground">
                Realize o simulado na plataforma com tela cheia
              </p>
            </button>

            <button
              type="button"
              disabled={offlineLoading}
              onClick={handleOfflineMode}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                {offlineLoading
                  ? <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  : <FileText className="h-7 w-7 text-primary" />
                }
              </div>
              <p className="text-body font-semibold text-foreground">Experiência offline</p>
              {offlineLoading ? (
                <div className="w-full space-y-2">
                  <p className="text-body-sm text-primary font-medium">{offlineStep}</p>
                  <Progress value={undefined} className="h-1.5 [&>div]:animate-pulse" />
                </div>
              ) : (
                <p className="text-body-sm text-muted-foreground">
                  Gere o PDF e suba o gabarito após finalizar
                </p>
              )}
            </button>
          </div>

          {/* Warning: outside execution window */}
          {new Date() > new Date(sim.executionWindowEnd) && (
            <div
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-xs mt-4"
              style={{
                background: 'hsl(var(--warning) / 0.08)',
                border: '1px solid hsl(var(--warning) / 0.2)',
                color: 'hsl(var(--warning))',
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              A janela de execução já encerrou. Sua tentativa será registrada como <strong className="mx-0.5">treino</strong> e não entrará no ranking.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useCountdown(targetISO: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  const target = parseISO(targetISO);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, mins, secs };
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
  const { days, hours, mins, secs } = useCountdown(sim.executionWindowStart);

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
          <CountdownBlock label="seg" value={String(secs).padStart(2, "0")} />
        </div>

        {/* CTAs */}
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
          <a
            href={buildGoogleCalendarUrl(sim)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.75)",
            }}
          >
            <CalendarPlus className="w-4 h-4" />
            Adicionar ao Google Agenda
          </a>
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
