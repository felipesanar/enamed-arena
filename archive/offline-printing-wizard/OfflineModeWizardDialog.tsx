/**
 * Snapshot de referência do wizard offline (modo → consentimento → impressão).
 * Copie para `src/components/simulados/` e `offline-printing.ts` para `src/lib/` para reativar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Monitor,
  FileText,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Printer,
  Clock,
  FileDown,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SimuladoWithStatus } from "@/types";
import { offlineApi } from "@/services/offlineApi";
import { persistOfflineAttempt } from "@/hooks/useOfflineAttempt";
import { toast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { OFFLINE_PRINTING_WINDOW_SECONDS } from "@/lib/offline-printing";
import { cn } from "@/lib/utils";

function formatPrintingMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type OfflineFlowStep = "mode" | "consent" | "printing";
type PrintingSetupStatus = "idle" | "loading" | "success" | "error";

const STEP_INDEX: Record<OfflineFlowStep, number> = {
  mode: 1,
  consent: 2,
  printing: 3,
};

export interface OfflineModeWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sim: SimuladoWithStatus;
  prefersReducedMotion?: boolean | null;
}

function StepBadge({ step }: { step: OfflineFlowStep }) {
  return (
    <p className="text-overline text-muted-foreground text-center mb-2 sm:mb-3 tracking-wide px-1">
      Passo {STEP_INDEX[step]} de 3
      {step === "mode" && " · Escolher modo"}
      {step === "consent" && " · Antes de começar"}
      {step === "printing" && " · Imprimir prova"}
    </p>
  );
}

const PRINT_WINDOW_MIN = Math.round(OFFLINE_PRINTING_WINDOW_SECONDS / 60);

export function OfflineModeWizardDialog({
  open,
  onOpenChange,
  sim,
  prefersReducedMotion,
}: OfflineModeWizardDialogProps) {
  const navigate = useNavigate();
  const reduceMotion = !!prefersReducedMotion;

  const [offlineFlowStep, setOfflineFlowStep] = useState<OfflineFlowStep>("mode");
  const [printingRemaining, setPrintingRemaining] = useState(OFFLINE_PRINTING_WINDOW_SECONDS);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineStep, setOfflineStep] = useState("");
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false);
  const [printingSetupStatus, setPrintingSetupStatus] = useState<PrintingSetupStatus>("idle");

  const examStartInFlightRef = useRef(false);
  const printingAutoStartRef = useRef(false);

  const resetOfflineModalState = useCallback(() => {
    setOfflineFlowStep("mode");
    setPrintingRemaining(OFFLINE_PRINTING_WINDOW_SECONDS);
    setOfflineLoading(false);
    setOfflineStep("");
    setPrintingSetupStatus("idle");
    printingAutoStartRef.current = false;
    examStartInFlightRef.current = false;
    setConfirmAbandonOpen(false);
  }, []);

  useEffect(() => {
    if (!open) resetOfflineModalState();
  }, [open, resetOfflineModalState]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return;
      const needConfirm =
        offlineFlowStep === "printing" &&
        printingRemaining > 0 &&
        printingRemaining < OFFLINE_PRINTING_WINDOW_SECONDS &&
        !offlineLoading;
      if (needConfirm) {
        setConfirmAbandonOpen(true);
        return;
      }
      onOpenChange(false);
    },
    [offlineFlowStep, printingRemaining, offlineLoading, onOpenChange],
  );

  const abandonPrintingAndClose = useCallback(() => {
    setConfirmAbandonOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const runPrintingBootstrap = useCallback(async () => {
    if (examStartInFlightRef.current) return;
    examStartInFlightRef.current = true;
    setPrintingSetupStatus("loading");
    setOfflineLoading(true);
    setOfflineStep("Criando tentativa offline...");
    try {
      const attempt = await offlineApi.createOfflineAttempt(sim.id);
      setOfflineStep("Gerando e baixando PDF...");
      const pdfUrl = await offlineApi.getSignedPdfUrl(sim.id);
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${sim.slug ?? sim.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      persistOfflineAttempt({
        id: attempt.attempt_id,
        simulado_id: sim.id,
        simulado_slug: attempt.simulado_slug,
        started_at: attempt.started_at,
        exam_duration_seconds: attempt.exam_duration_seconds,
      });

      setPrintingSetupStatus("success");
      toast({
        title: "PDF da prova",
        description:
          "Se o download não abrir, verifique o bloqueador de pop-ups. O cronômetro da prova está no canto da tela.",
      });
    } catch (err) {
      setPrintingSetupStatus("error");
      toast({
        title: "Não foi possível baixar a prova",
        description: (err as Error)?.message ?? "Toque em tentar novamente.",
        variant: "destructive",
      });
    } finally {
      setOfflineLoading(false);
      setOfflineStep("");
      examStartInFlightRef.current = false;
    }
  }, [sim]);

  useEffect(() => {
    if (offlineFlowStep !== "printing" || offlineLoading) return;
    const id = window.setInterval(() => {
      setPrintingRemaining((r) => (r <= 0 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [offlineFlowStep, offlineLoading]);

  useEffect(() => {
    if (offlineFlowStep !== "printing" || offlineLoading || printingRemaining > 0) return;
    if (printingAutoStartRef.current) return;
    printingAutoStartRef.current = true;
    trackEvent("offline_printing_expired", { simulado_id: sim.id });
    onOpenChange(false);
  }, [offlineFlowStep, offlineLoading, printingRemaining, sim.id, onOpenChange]);

  const goToOfflineConsent = () => {
    trackEvent("offline_printing_consent_viewed", { simulado_id: sim.id });
    setOfflineFlowStep("consent");
  };

  const goToPrintingCountdown = () => {
    printingAutoStartRef.current = false;
    setPrintingRemaining(OFFLINE_PRINTING_WINDOW_SECONDS);
    setPrintingSetupStatus("loading");
    setOfflineLoading(true);
    setOfflineFlowStep("printing");
    trackEvent("offline_printing_started", { simulado_id: sim.id });
    void runPrintingBootstrap();
  };

  const handlePrintingPrimaryAction = () => {
    if (printingSetupStatus === "error") {
      void runPrintingBootstrap();
      return;
    }
    trackEvent("offline_printing_completed_early", { simulado_id: sim.id });
    onOpenChange(false);
  };

  const printingMinutes = Math.floor(printingRemaining / 60);
  const elapsedRatio = 1 - printingRemaining / Math.max(1, OFFLINE_PRINTING_WINDOW_SECONDS);
  const progressPercent = Math.min(100, Math.max(0, elapsedRatio * 100));

  const motionProps = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg w-[calc(100%-1.25rem)] sm:w-full max-h-[90dvh] min-w-0 rounded-2xl border border-border p-4 sm:p-6 md:p-8 gap-0 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {offlineFlowStep === "mode" && (
              <motion.div key="mode" {...motionProps}>
                <StepBadge step="mode" />
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
                      onOpenChange(false);
                      navigate(`/simulados/${sim.slug}/start`);
                    }}
                    className="flex min-h-[44px] flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group"
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
                    onClick={goToOfflineConsent}
                    className="flex min-h-[44px] flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <FileText className="h-7 w-7 text-primary" />
                    </div>
                    <p className="text-body font-semibold text-foreground">Experiência offline</p>
                    <p className="text-body-sm text-muted-foreground">
                      PDF para imprimir e gabarito digital depois da prova
                    </p>
                  </button>
                </div>

                {new Date() > new Date(sim.executionWindowEnd) && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-4 py-3 text-xs mt-4"
                    style={{
                      background: "hsl(var(--warning) / 0.08)",
                      border: "1px solid hsl(var(--warning) / 0.2)",
                      color: "hsl(var(--warning))",
                    }}
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    A janela de execução já encerrou. Sua tentativa será registrada como{" "}
                    <strong className="mx-0.5">treino</strong> e não entrará no ranking.
                  </div>
                )}
              </motion.div>
            )}

            {offlineFlowStep === "consent" && (
              <motion.div key="consent" {...motionProps} className="min-w-0 space-y-3 sm:space-y-4">
                <StepBadge step="consent" />
                <button
                  type="button"
                  onClick={() => setOfflineFlowStep("mode")}
                  className="mb-0 flex items-center gap-1.5 text-body-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-10 py-0.5 -mt-1"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  Voltar
                </button>

                <DialogHeader className="mb-0 space-y-0 text-left pr-7 sm:pr-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20 sm:h-12 sm:w-12">
                      <Printer className="h-5 w-5 text-primary sm:h-6 sm:w-6" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-left text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-heading-2">
                        Antes de gerar a prova
                      </DialogTitle>
                      <DialogDescription className="text-left text-body-sm leading-relaxed text-muted-foreground mt-1.5 sm:mt-2">
                        Primeiro você prepara no papel; só depois a prova oficial começa (PDF, gabarito e cronômetro).
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div
                  className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3 shadow-sm ring-1 ring-inset ring-primary/10 sm:p-4"
                  role="region"
                  aria-label="Primeira fase: impressão"
                >
                  <p className="text-[0.625rem] font-bold uppercase tracking-wider text-primary sm:text-micro-label">
                    Fase 1 · próxima tela
                  </p>
                  <p className="mt-1.5 text-lg font-semibold leading-snug text-foreground tabular-nums sm:text-heading-3">
                    <span className="text-primary">{PRINT_WINDOW_MIN} min</span>
                    <span className="text-foreground"> para imprimir </span>
                    <span className="text-body-sm font-normal text-muted-foreground sm:text-body">ou salvar o PDF</span>
                  </p>
                  <p className="text-caption mt-1.5 leading-relaxed text-muted-foreground">
                    Sem prova valendo — só preparação no papel.
                  </p>
                </div>

                <div
                  className="rounded-xl border border-border bg-muted/35 px-3 py-3 sm:px-4 sm:py-3.5"
                  role="region"
                  aria-label="Segunda fase: início oficial"
                >
                  <p className="text-[0.625rem] font-bold uppercase leading-tight tracking-wider text-muted-foreground sm:text-micro-label">
                    <span className="sm:hidden">Fase 2 · após a impressão</span>
                    <span className="hidden sm:inline">Fase 2 · quando acabar o tempo (ou se antecipar)</span>
                  </p>
                  <ul className="mt-2.5 grid grid-cols-1 gap-2 md:mt-3 md:grid-cols-3 md:gap-2.5">
                    <li className="flex min-h-[3rem] items-center gap-2.5 rounded-lg bg-background/90 px-3 py-2.5 ring-1 ring-border/70 md:flex-col md:items-start md:justify-center md:py-3">
                      <FileDown className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-body-sm leading-snug text-foreground">
                        <span className="font-semibold">PDF</span> ao abrir a etapa de impressão
                      </span>
                    </li>
                    <li className="flex min-h-[3rem] items-center gap-2.5 rounded-lg bg-background/90 px-3 py-2.5 ring-1 ring-border/70 md:flex-col md:items-start md:justify-center md:py-3">
                      <ClipboardList className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-body-sm leading-snug text-foreground">
                        <span className="font-semibold">Gabarito</span> digital
                      </span>
                    </li>
                    <li className="flex min-h-[3rem] items-center gap-2.5 rounded-lg bg-background/90 px-3 py-2.5 ring-1 ring-border/70 md:flex-col md:items-start md:justify-center md:py-3">
                      <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-body-sm leading-snug text-foreground">
                        <span className="font-semibold">Cronômetro</span> da prova
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="flex gap-2.5 rounded-lg border-l-4 border-l-primary bg-muted/25 py-2.5 pl-3 pr-2 sm:py-3 sm:pl-3.5">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold leading-snug text-foreground">
                      Nada salvo ainda no servidor
                    </p>
                    <p className="text-caption mt-0.5 leading-relaxed text-muted-foreground">
                      Fechar = <strong className="text-foreground">sem tentativa</strong>.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-border/60 pt-3 sm:space-y-3 sm:pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11 w-full min-w-0 px-3 text-body-sm font-semibold leading-snug sm:h-12 sm:px-4"
                    onClick={() => onOpenChange(false)}
                  >
                    Vou me preparar e volto depois
                  </Button>
                  <Button
                    type="button"
                    className="h-11 min-h-11 w-full min-w-0 px-3 text-body-sm font-semibold leading-snug shadow-sm sm:h-12 sm:px-4"
                    onClick={goToPrintingCountdown}
                  >
                    Estou pronto — iniciar os {PRINT_WINDOW_MIN} minutos
                  </Button>
                </div>
              </motion.div>
            )}

            {offlineFlowStep === "printing" && (
              <motion.div key="printing" {...motionProps}>
                <StepBadge step="printing" />
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-heading-2 text-foreground text-center">
                    Tempo para imprimir
                  </DialogTitle>
                  <DialogDescription className="text-body text-muted-foreground text-center mt-2 max-w-md mx-auto">
                    O <strong className="text-foreground">PDF baixa ao entrar nesta tela</strong>. Use os {PRINT_WINDOW_MIN}{" "}
                    minutos para imprimir ou salvar o arquivo. O <strong className="text-foreground">cronômetro da prova</strong>{" "}
                    já fica ativo no canto da tela.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center py-4">
                  <motion.div
                    initial={reduceMotion ? false : { scale: 0.98, opacity: 0.9 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "relative w-full max-w-xs rounded-2xl px-6 py-8 mb-4 text-center overflow-hidden",
                      "border border-primary/15 shadow-glow-wine",
                    )}
                    style={{
                      background:
                        "linear-gradient(145deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--muted) / 0.5) 100%)",
                    }}
                  >
                    <div className="mb-3 flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/12" aria-hidden>
                      <Printer className="h-7 w-7 text-primary" />
                    </div>
                    <p
                      role="timer"
                      aria-label={`Tempo restante para imprimir a prova: ${printingMinutes} minutos`}
                      className="font-mono text-kpi font-bold tabular-nums text-foreground tracking-tight"
                    >
                      {formatPrintingMmSs(printingRemaining)}
                    </p>
                    <span className="sr-only" aria-live="polite" aria-atomic="true" key={printingMinutes}>
                      {printingMinutes} minutos restantes para imprimir
                    </span>
                    <p className="text-caption text-muted-foreground mt-3 px-1">
                      Use uma impressora confiável ou salve o PDF. Você pode fechar este aviso quando terminar.
                    </p>
                    {printingSetupStatus === "success" && !offlineLoading && (
                      <p className="text-caption mt-2 font-medium text-primary" role="status">
                        Download enviado · cronômetro da prova ativo
                      </p>
                    )}
                  </motion.div>

                  <div className="w-full max-w-xs mb-1">
                    <div className="flex justify-between text-micro-label text-muted-foreground uppercase mb-1.5">
                      <span>Preparação</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>
                </div>

                {offlineLoading && (
                  <div className="mb-4 space-y-2">
                    <p className="text-body-sm text-primary font-medium text-center">{offlineStep}</p>
                    <Progress value={undefined} className="h-1.5 [&>div]:animate-pulse" />
                  </div>
                )}

                {printingRemaining === 0 && !offlineLoading && (
                  <p className="text-body-sm text-muted-foreground text-center mb-3">
                    Tempo de preparo encerrado — fechando…
                  </p>
                )}

                {printingRemaining > 0 && (
                  <Button
                    type="button"
                    className="w-full min-h-11"
                    disabled={offlineLoading && printingSetupStatus !== "error"}
                    onClick={handlePrintingPrimaryAction}
                  >
                    {offlineLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Baixando PDF da prova…
                      </span>
                    ) : printingSetupStatus === "error" ? (
                      "Tentar baixar o PDF novamente"
                    ) : (
                      "Já imprimi — continuar"
                    )}
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAbandonOpen} onOpenChange={setConfirmAbandonOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da preparação?</AlertDialogTitle>
            <AlertDialogDescription>
              {printingSetupStatus === "success" ? (
                <>
                  Sua prova offline <strong>já está ativa</strong> (cronômetro no canto). Fechar só esconde esta janela —
                  o tempo de impressão aqui não continua, mas a prova segue valendo.
                </>
              ) : (
                <>
                  O cronômetro desta tela não será salvo.
                  {printingSetupStatus === "error"
                    ? " Ajuste a conexão ou tente baixar o PDF de novo antes de sair."
                    : " Nenhuma tentativa foi criada — você pode reabrir quando estiver pronto."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar preparando</AlertDialogCancel>
            <AlertDialogAction onClick={abandonPrintingAndClose}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
