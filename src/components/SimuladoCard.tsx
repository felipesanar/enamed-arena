import { Calendar, Trophy } from "lucide-react";
import { PremiumCard } from "./PremiumCard";
import { StatusBadge } from "./StatusBadge";
import type { SimuladoWithStatus } from "@/types";
import { Link } from "react-router-dom";
import { getSimuladoCTA, formatDateShort, buildGoogleCalendarUrl } from "@/lib/simulado-helpers";
import { CalendarPlus } from "lucide-react";

interface SimuladoCardProps {
  simulado: SimuladoWithStatus;
  delay?: number;
}

export function SimuladoCard({ simulado, delay = 0 }: SimuladoCardProps) {
  const cta = getSimuladoCTA(simulado.status);
  const hasScore = simulado.userState?.score !== undefined;

  const cardContent = (
    <PremiumCard interactive delay={delay} className="flex flex-col p-5 md:p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-body font-bold text-primary">#{simulado.sequenceNumber}</span>
          </div>
          {simulado.dbStatus === 'test' && (
            <span className="px-2 py-0.5 rounded-md text-micro-label font-semibold bg-warning/15 text-warning border border-warning/30 uppercase tracking-wide">
              Teste
            </span>
          )}
        </div>
        <StatusBadge status={simulado.status} />
      </div>

      <h3 className="text-heading-3 text-foreground mb-3">{simulado.title}</h3>

      <div className="flex flex-wrap items-center gap-3 text-body-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateShort(simulado.executionWindowStart)} - {formatDateShort(simulado.executionWindowEnd)}
        </span>
      </div>

      {/* Score display only when results are released */}
      {hasScore && simulado.status === 'completed' && (
        <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-accent/50 border border-border/30">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-body-sm text-muted-foreground">Sua nota:</span>
          <span className="text-body font-bold text-primary ml-auto">{simulado.userState!.score}%</span>
        </div>
      )}

      {/* Window info */}
      {simulado.status === 'upcoming' && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-caption text-info">
            Abre em {formatDateShort(simulado.executionWindowStart)}
          </p>
          <a
            href={buildGoogleCalendarUrl(simulado)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-caption text-primary hover:text-wine-hover transition-colors"
            title="Adicionar ao Google Agenda"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Agenda</span>
          </a>
        </div>
      )}
      {simulado.status === 'available_late' && (
        <div className="mt-2 space-y-1.5">
          <p className="text-caption text-foreground">
            Mesmo simulado completo — referência para sua preparação.
          </p>
          <span className="inline-flex text-caption font-medium px-2 py-0.5 rounded-md bg-info/10 text-info border border-info/20">
            Não conta no ranking nacional
          </span>
        </div>
      )}
      {simulado.status === 'closed_waiting' && !simulado.userState?.finished && (
        <p className="text-caption text-muted-foreground mt-2">
          Não realizado
        </p>
      )}
      {simulado.status === 'closed_waiting' && simulado.userState?.finished && (
        <p className="text-caption text-muted-foreground mt-2">
          Resultado em {formatDateShort(simulado.resultsReleaseAt)}
        </p>
      )}

      <div className="mt-auto pt-4">
        {cta.variant === 'primary' ? (
          <Link
            to={`/simulados/${simulado.id}`}
            className="block w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors text-center"
          >
            {cta.label}
          </Link>
        ) : cta.variant === 'secondary' ? (
          <Link
            to={`/simulados/${simulado.id}`}
            className="block w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors text-center"
          >
            {cta.label}
          </Link>
        ) : (
          <div className="w-full py-2.5 rounded-xl bg-muted text-muted-foreground text-body text-center font-medium">
            {cta.label}
          </div>
        )}
      </div>
    </PremiumCard>
  );

  return cardContent;
}
