import { Calendar, Clock, FileText } from "lucide-react";
import { PremiumCard } from "./PremiumCard";
import { StatusBadge } from "./StatusBadge";
import type { Simulado } from "@/types";
import { Link } from "react-router-dom";

interface SimuladoCardProps {
  simulado: Simulado;
  delay?: number;
}

export function SimuladoCard({ simulado, delay = 0 }: SimuladoCardProps) {
  console.log('[SimuladoCard] Rendering:', simulado.title);

  return (
    <PremiumCard interactive delay={delay} className="flex flex-col p-5 md:p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <StatusBadge status={simulado.status} />
      </div>
      <h3 className="text-heading-3 text-foreground mb-1">{simulado.title}</h3>
      <div className="flex items-center gap-4 text-body-sm text-muted-foreground mt-1">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {simulado.date}
        </span>
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {simulado.questions}q
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {simulado.duration}
        </span>
      </div>
      <div className="mt-auto pt-4">
        {simulado.status === "available" && (
          <Link
            to={`/simulados/${simulado.id}`}
            className="block w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors text-center"
          >
            Iniciar Simulado
          </Link>
        )}
        {simulado.status === "completed" && (
          <Link
            to={`/simulados/${simulado.id}`}
            className="block w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors text-center"
          >
            Ver Resultado
          </Link>
        )}
        {(simulado.status === "upcoming" || simulado.status === "locked") && (
          <div className="w-full py-2.5 rounded-xl bg-muted text-muted-foreground text-body text-center font-medium">
            Indisponível
          </div>
        )}
      </div>
    </PremiumCard>
  );
}
