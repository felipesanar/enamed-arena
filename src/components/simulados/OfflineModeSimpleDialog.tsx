/**
 * Modal escolha online/offline — offline: etapa de explicação antes de criar tentativa e baixar PDF (sem cronômetro no app).
 * Ranking depende do envio do gabarito dentro da janela de execução (validado no servidor).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Monitor,
  FileText,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Download,
  PenLine,
  Send,
  CalendarRange,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SimuladoWithStatus } from "@/types";
import { offlineApi } from "@/services/offlineApi";
import { persistOfflineAttempt } from "@/hooks/useOfflineAttempt";
import { toast } from "@/hooks/use-toast";

export interface OfflineModeSimpleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sim: SimuladoWithStatus;
}

type FlowStep = "choose" | "offline_intro";

export function OfflineModeSimpleDialog({ open, onOpenChange, sim }: OfflineModeSimpleDialogProps) {
  const navigate = useNavigate();
  const [flowStep, setFlowStep] = useState<FlowStep>("choose");
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineStep, setOfflineStep] = useState("");

  useEffect(() => {
    if (open) setFlowStep("choose");
  }, [open]);

  const handleOfflineMode = useCallback(async () => {
    setOfflineLoading(true);
    setOfflineStep("Criando tentativa offline...");
    try {
      const attempt = await offlineApi.createOfflineAttempt(sim.id);
      setOfflineStep("Gerando e baixando PDF...");
      const pdfUrl = await offlineApi.getSignedPdfUrl(sim.id, true);
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

      onOpenChange(false);
      toast({
        title: "Download iniciado!",
        description:
          "Quando terminar no papel, envie o gabarito aqui. Para valer no ranking, o envio precisa ser até o fim da janela de execução do simulado.",
      });
    } catch (err) {
      toast({
        title: "Erro ao iniciar modo offline",
        description: (err as Error)?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setOfflineLoading(false);
      setOfflineStep("");
    }
  }, [sim, onOpenChange]);

  const windowStartLabel = format(parseISO(sim.executionWindowStart), "dd/MM 'às' HH:mm", {
    locale: ptBR,
  });
  const windowEndLabel = format(parseISO(sim.executionWindowEnd), "dd/MM 'às' HH:mm", {
    locale: ptBR,
  });

  const offlineSteps = [
    {
      icon: Download,
      title: "Baixa o PDF",
      text: "A prova sai em PDF pra você imprimir ou ver no tablet.",
    },
    {
      icon: PenLine,
      title: "Resolve no papel",
      text: "Faz no seu ritmo — não tem cronômetro da prova no app.",
    },
    {
      icon: Send,
      title: "Manda o gabarito aqui",
      text: "Preenche o gabarito digital quando quiser. Pro ranking, o envio tem que ser até o fim da janela de execução — não é tempo de prova no app.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-full rounded-2xl border border-border gap-0 p-6 md:p-8",
          flowStep === "offline_intro" ? "max-w-xl" : "max-w-lg"
        )}
      >
        {flowStep === "choose" ? (
          <>
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
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group"
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Monitor className="h-7 w-7 text-primary" />
                </div>
                <p className="text-body font-semibold text-foreground">Experiência online</p>
                <p className="text-body-sm text-muted-foreground">
                  Na plataforma, em tela cheia, com cronômetro da prova.
                </p>
              </button>

              <button
                type="button"
                disabled={offlineLoading}
                onClick={() => setFlowStep("offline_intro")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <p className="text-body font-semibold text-foreground">Experiência offline</p>
                <p className="text-body-sm text-muted-foreground leading-snug">
                  PDF pra imprimir; depois você envia o gabarito aqui. Prazo pro ranking: até o{" "}
                  <span className="font-medium text-foreground/90">fim da janela de execução</span> — sem
                  relógio da prova no app.
                </p>
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => !offlineLoading && setFlowStep("choose")}
              disabled={offlineLoading}
              className="mb-4 inline-flex items-center gap-2 text-body-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar
            </button>

            <DialogHeader className="mb-4 text-left space-y-1">
              <DialogTitle className="text-heading-2 text-foreground">
                Modo offline
              </DialogTitle>
              <DialogDescription className="text-body text-muted-foreground text-left">
                Assim você usa a prova no papel e devolve o resultado por aqui.
              </DialogDescription>
            </DialogHeader>

            <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-background to-background p-5 md:p-6 mb-4">
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/[0.12] blur-2xl"
                aria-hidden
              />
              <ul className="relative space-y-4">
                {offlineSteps.map(({ icon: Icon, title, text }, i) => (
                  <li key={title} className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-micro-label font-semibold">
                      {i + 1}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="flex items-center gap-2 text-body font-semibold text-foreground">
                        <Icon className="h-4 w-4 text-primary shrink-0" aria-hidden />
                        {title}
                      </p>
                      <p className="text-body-sm text-muted-foreground mt-1 leading-relaxed">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="mb-5 flex gap-3 rounded-xl border border-border/80 bg-muted/40 px-4 py-3.5"
              role="status"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CalendarRange className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-micro-label font-semibold uppercase tracking-wide text-muted-foreground">
                  Janela de execução
                </p>
                <p className="text-body-sm text-foreground mt-0.5">
                  {windowStartLabel} — {windowEndLabel}
                </p>
                <p className="text-caption text-muted-foreground mt-1">
                  É neste período que o envio do gabarito conta para o ranking (se você estiver dentro das
                  regras do simulado).
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full rounded-xl h-12 text-body font-semibold"
              disabled={offlineLoading}
              onClick={() => void handleOfflineMode()}
            >
              {offlineLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {offlineStep || "Preparando..."}
                </>
              ) : (
                "Continuar e baixar PDF"
              )}
            </Button>

            {offlineLoading && (
              <div className="mt-3">
                <Progress value={undefined} className="h-1.5 [&>div]:animate-pulse" />
              </div>
            )}
          </>
        )}

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
      </DialogContent>
    </Dialog>
  );
}
