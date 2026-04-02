import { useId } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Play,
  Lock,
  CheckCircle2,
  Clock,
  Coffee,
  ChevronDown,
  ArrowRight,
  CalendarPlus,
} from "lucide-react";
import { buildGoogleCalendarUrl } from "@/lib/simulado-helpers";
import { cn } from "@/lib/utils";
import type { SimuladoWithStatus } from "@/types";

export type SimuladosTimelineSectionProps = {
  items: SimuladoWithStatus[];
  reduced?: boolean;
  className?: string;
  /** Dentro de outra `<section>` (ex.: landing): usa `<div>` + `h3` + rótulos acessíveis. */
  embedded?: boolean;
  /** Espaçamento mais compacto em painéis laterais. */
  compact?: boolean;
};

/** Link para iniciar ou retomar (janela aberta, após janela em modo treino, ou prova em andamento). */
function simuladoTakeExamHref(sim: SimuladoWithStatus): string {
  const resume = sim.userState?.started === true && sim.userState?.finished !== true;
  if (resume) return `/simulados/${sim.slug}/prova`;
  return `/simulados/${sim.slug}/start`;
}

function simuladoTakeExamLinkLabel(sim: SimuladoWithStatus): string {
  const resume = sim.userState?.started === true && sim.userState?.finished !== true;
  return resume ? "Continuar" : "Fazer simulado";
}

/** Variante só para nó + ênfase do rótulo; superfície do card é única (clara). */
const TIMELINE_VARIANT = {
  available: {
    Icon: Play,
    label: "Janela aberta",
    dotClass: "border-primary/35 bg-primary/20 sim-dot-pulse",
    labelEmphasis: true,
  },
  in_progress: {
    Icon: Play,
    label: "Em andamento",
    dotClass: "border-primary/35 bg-primary/20 sim-dot-pulse",
    labelEmphasis: true,
  },
  closed_waiting: {
    Icon: Lock,
    label: "Aguardando resultado",
    dotClass: "border-border bg-muted/90",
    labelEmphasis: false,
  },
  completed: {
    Icon: CheckCircle2,
    label: "Concluído",
    dotClass: "border-border bg-muted/90",
    labelEmphasis: false,
  },
  results_available: {
    Icon: CheckCircle2,
    label: "Resultado liberado",
    dotClass: "border-border bg-muted/90",
    labelEmphasis: false,
  },
  available_late: {
    Icon: Coffee,
    label: "Fora da janela",
    dotClass: "border-border bg-muted/90",
    labelEmphasis: false,
  },
  upcoming: {
    Icon: Clock,
    label: "Em breve",
    dotClass: "border-border bg-background ring-1 ring-border/80",
    labelEmphasis: false,
  },
} as const;

function TimelineItem({
  sim,
  index,
  reduced,
  compact,
}: {
  sim: SimuladoWithStatus;
  index: number;
  reduced: boolean;
  compact?: boolean;
}) {
  const variant = TIMELINE_VARIANT[sim.status as keyof typeof TIMELINE_VARIANT];
  if (!variant) return null;

  const isUpcoming = sim.status === "upcoming";
  const isCompleted = sim.status === "completed" || sim.status === "results_available";
  const isInProgress = sim.status === "in_progress";
  const isClosedWaiting = sim.status === "closed_waiting";
  const isAvailableLate = sim.status === "available_late";
  const isAvailable = sim.status === "available";

  const Icon = variant.Icon;

  const hoverMotion = reduced
    ? undefined
    : { y: -1, transition: { type: "spring" as const, stiffness: 520, damping: 28 } };

  const linkClass =
    "inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  const topRail = compact ? "top-[21px] sm:top-[22px]" : "top-[23px] sm:top-[24px]";
  const dotTop = compact ? "top-[17px]" : "top-[19px]";

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.35,
        delay: reduced ? 0 : index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative"
    >
      <div
        className={cn(
          "pointer-events-none absolute left-[calc(27px-2.75rem)] z-0 h-px w-[calc(2.75rem-27px)] bg-border sm:left-[calc(27px-3rem)] sm:w-[calc(3rem-27px)]",
          topRail,
        )}
        aria-hidden
      />

      <div
        className={cn(
          "absolute left-[calc(17px-2.75rem)] z-[1] -translate-x-1/2 sm:left-[calc(17px-3rem)]",
          dotTop,
        )}
        aria-hidden
      >
        <div
          className={cn(
            "h-2.5 w-2.5 rounded-full border-2 border-background shadow-sm sm:h-3 sm:w-3",
            variant.dotClass,
          )}
        />
      </div>

      <motion.div whileHover={hoverMotion} className="relative">
        <div
         className={cn(
            "flex items-center justify-between gap-3 rounded-xl border bg-card/95 shadow-sm transition-shadow sm:gap-4",
            compact ? "px-3 py-2.5 sm:px-4 sm:py-3" : "px-4 py-3.5 sm:px-5 sm:py-4",
            !reduced && "hover:border-border hover:shadow-md",
            (isAvailable || isInProgress) && "border-primary/30 bg-primary/[0.03] ring-1 ring-primary/10 shadow-md",
            !(isAvailable || isInProgress) && "border-border/90",
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4",
                  variant.labelEmphasis && "text-primary",
                )}
                strokeWidth={2}
                aria-hidden
              />
              <span
                className={cn(
                  "text-xs font-medium text-muted-foreground",
                  variant.labelEmphasis && "text-primary",
                )}
              >
                {variant.label}
              </span>
            </div>
            <p className="truncate text-sm font-semibold leading-snug text-foreground">{sim.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(parseISO(sim.executionWindowStart), "dd/MM/yyyy", { locale: ptBR })} · #
              {sim.sequenceNumber}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
            {isCompleted && (
              <>
                <span
                  className={cn(
                    "font-semibold tabular-nums tracking-tight text-foreground",
                    compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
                  )}
                >
                  {sim.userState?.score ?? "–"}%
                </span>
                <Link to={`/simulados/${sim.slug}/resultado`} className={linkClass}>
                  Ver resultado <ArrowRight className="h-3.5 w-3.5 opacity-80" />
                </Link>
              </>
            )}
            {isInProgress && (
              <Link to={simuladoTakeExamHref(sim)} className={linkClass}>
                {simuladoTakeExamLinkLabel(sim)}{" "}
                <ArrowRight className="h-3.5 w-3.5 opacity-80" />
              </Link>
            )}
            {isClosedWaiting && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Resultado em breve
              </span>
            )}
            {(isAvailable || isAvailableLate) && (
              <div className="flex flex-col items-end gap-0.5">
                <Link to={simuladoTakeExamHref(sim)} className={linkClass}>
                  {simuladoTakeExamLinkLabel(sim)}{" "}
                  <ArrowRight className="h-3.5 w-3.5 opacity-80" />
                </Link>
                {isAvailableLate && (
                  <span className="max-w-[11rem] text-[11px] leading-snug text-muted-foreground">
                    Não entra no ranking
                  </span>
                )}
              </div>
            )}
            {isUpcoming && (
              <a
                href={buildGoogleCalendarUrl(sim)}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                <CalendarPlus className="h-3.5 w-3.5 opacity-80" />
                Adicionar ao Google Agenda
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SimuladosTimelineSection({
  items,
  reduced = false,
  className,
  embedded = false,
  compact = false,
}: SimuladosTimelineSectionProps) {
  const headingId = useId();
  const headingId = useId();

  const headingClass =
    "whitespace-nowrap text-sm font-semibold tracking-tight text-foreground";

  const inner = (
    <>
      <div className="mb-1 flex items-center gap-3">
        {embedded ? (
          <h3 id={headingId} className={headingClass}>
            Histórico e próximos
          </h3>
        ) : (
          <h2 className={headingClass}>Histórico e próximos</h2>
        )}
        <div className="h-px flex-1 rounded-full bg-border" />
      </div>
      <p
        className={cn(
          "text-xs text-muted-foreground",
          compact ? "mb-3" : "mb-5",
        )}
      >
        Ordenado do mais recente para o mais antigo.
      </p>

      <div className="relative pl-1">
        <div
          className={cn(
            "pointer-events-none absolute left-[17px] w-px -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/35 via-primary/15 to-border",
            compact ? "top-4 bottom-4" : "top-5 bottom-5",
          )}
          aria-hidden
        />

        <div className={cn("pl-[2.75rem] sm:pl-12", compact ? "space-y-2" : "space-y-3")}>
          {items.map((sim, index) => (
            <TimelineItem
              key={sim.id}
              sim={sim}
              index={index}
              reduced={reduced}
              compact={compact}
            />
          ))}
        </div>
      </div>

      {items.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "group ml-[2.75rem] flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/25 hover:bg-muted/30 sm:ml-12",
            compact ? "mt-3" : "mt-4",
          )}
        >
          <ChevronDown
            className="h-4 w-4 transition-transform duration-300"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
          {expanded ? "Ver menos" : `Ver todos os anteriores (${items.length - 5} a mais)`}
        </button>
      )}
    </>
  );

  if (embedded) {
    return (
      <div
        role="region"
        aria-labelledby={headingId}
        className={cn("mb-0", className)}
      >
        {inner}
      </div>
    );
  }

  return <section className={cn("mb-10", className)}>{inner}</section>;
}
