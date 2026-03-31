import { Calendar, Trophy } from "lucide-react";
import { PremiumCard } from "./PremiumCard";
import { StatusBadge } from "./StatusBadge";
import type { SimuladoWithStatus } from "@/types";
import { Link } from "react-router-dom";
import { getSimuladoCTA, formatDateShort } from "@/lib/simulado-helpers";

const PRO_ENAMED_URL = "https://sanarflix.com.br/sanarflix-pro-enamed";

interface SimuladoCardProps {
  simulado: SimuladoWithStatus;
  delay?: number;
  isLocked: boolean;
  worstArea?: string | null;
}

export function SimuladoCard({ simulado, delay = 0, isLocked, worstArea }: SimuladoCardProps) {
  const cta = getSimuladoCTA(simulado.status);
  const hasScore = simulado.userState?.score !== undefined;

  const cardContent = (
    <div style={isLocked ? { opacity: 0.65 } : undefined}>
      <PremiumCard interactive delay={delay} className="flex flex-col p-5 md:p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-body font-bold text-primary">#{simulado.sequenceNumber}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={simulado.status} />
            {isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#7c3aed40] bg-[#7c3aed25] px-2 py-0.5 text-[11px] font-bold text-[#c4b5fd]">
                🔒 PRO
              </span>
            )}
          </div>
        </div>

        <h3 className="text-heading-3 text-foreground mb-3">{simulado.title}</h3>

        <div className="flex flex-wrap items-center gap-3 text-body-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateShort(simulado.executionWindowStart)} - {formatDateShort(simulado.executionWindowEnd)}
          </span>
        </div>

        {worstArea && !isLocked && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#ef444430] bg-[#ef444415] px-2 py-1">
            <span className="text-[10px]">📌</span>
            <span className="text-[11px] font-semibold text-[#fca5a5]">Foco: {worstArea}</span>
          </div>
        )}

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
          <p className="text-caption text-info mt-2">
            Abre em {formatDateShort(simulado.executionWindowStart)}
          </p>
        )}
        {simulado.status === 'available_late' && (
          <p className="text-caption text-warning mt-2">
            Fora da janela · Não entra no ranking
          </p>
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
          {isLocked ? (
            <div className="w-full py-2.5 rounded-xl bg-[#1e293b] text-[#94a3b8] text-body text-center font-medium">
              🔒 Disponível apenas para Aluno PRO
            </div>
          ) : cta.variant === 'primary' ? (
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
    </div>
  );

  if (isLocked) {
    return (
      <div
        className="cursor-pointer"
        onClick={() => window.open(PRO_ENAMED_URL, '_blank', 'noopener,noreferrer')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && window.open(PRO_ENAMED_URL, '_blank', 'noopener,noreferrer')}
        aria-label={`${simulado.title} — exclusivo Aluno PRO`}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
}
