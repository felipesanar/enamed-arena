import { CheckCircle2 } from "lucide-react";
import { SEGMENT_LABELS } from "@/types";
import type { UserSegment } from "@/types";

interface Props {
  segment: string;
  specialty: string;
  institutions: string[];
}

export function ConfirmationStep({ segment, specialty, institutions }: Props) {
  const segmentLabel =
    SEGMENT_LABELS[segment as UserSegment] ?? segment;

  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-heading-2 text-foreground mb-2">Tudo pronto!</h2>
        <p className="text-body text-muted-foreground max-w-md mx-auto">
          Confira suas informações antes de começar. Você poderá editar esses
          dados entre as janelas de simulado.
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-overline uppercase text-muted-foreground mb-1">
            Seu plano
          </p>
          <p className="text-body font-semibold text-foreground">
            {segmentLabel}
          </p>
          <p className="text-caption text-muted-foreground mt-1">
            Definido pela sua assinatura
          </p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-overline uppercase text-muted-foreground mb-1">
            Especialidade desejada
          </p>
          <p className="text-body font-semibold text-foreground">{specialty}</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-overline uppercase text-muted-foreground mb-1">
            Instituições desejadas
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {institutions.map((inst) => (
              <span
                key={inst}
                className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-body-sm font-medium"
              >
                {inst}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
