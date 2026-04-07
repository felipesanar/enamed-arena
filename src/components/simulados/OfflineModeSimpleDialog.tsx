/**
 * Modal escolha online/offline — fluxo simples: offline cria tentativa e baixa PDF (sem cronômetro no app).
 * Regras de ranking (janela do simulado, treino etc.) são validadas no servidor ao enviar o gabarito.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Monitor, FileText, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { SimuladoWithStatus } from "@/types";
import { offlineApi } from "@/services/offlineApi";
import { persistOfflineAttempt } from "@/hooks/useOfflineAttempt";
import { toast } from "@/hooks/use-toast";

export interface OfflineModeSimpleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sim: SimuladoWithStatus;
}

export function OfflineModeSimpleDialog({ open, onOpenChange, sim }: OfflineModeSimpleDialogProps) {
  const navigate = useNavigate();
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineStep, setOfflineStep] = useState("");

  const handleOfflineMode = useCallback(async () => {
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

      onOpenChange(false);
      toast({
        title: "Download iniciado!",
        description:
          "Faça a prova no seu ritmo no papel. Quando quiser, envie o gabarito digital — se o envio for dentro da janela de execução do simulado, sua nota entra no ranking.",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              Realize o simulado na plataforma com tela cheia
            </p>
          </button>

          <button
            type="button"
            disabled={offlineLoading}
            onClick={() => void handleOfflineMode()}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              {offlineLoading ? (
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
              ) : (
                <FileText className="h-7 w-7 text-primary" />
              )}
            </div>
            <p className="text-body font-semibold text-foreground">Experiência offline</p>
            {offlineLoading ? (
              <div className="w-full space-y-2">
                <p className="text-body-sm text-primary font-medium">{offlineStep}</p>
                <Progress value={undefined} className="h-1.5 [&>div]:animate-pulse" />
              </div>
            ) : (
              <p className="text-body-sm text-muted-foreground">
                Baixe o PDF agora e envie o gabarito digital depois — você pode fazer a prova no papel quando
                quiser, respeitando o tempo da tentativa
              </p>
            )}
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
      </DialogContent>
    </Dialog>
  );
}
