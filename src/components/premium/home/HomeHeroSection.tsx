import { PremiumLink } from "@/components/premium/PremiumLink";
import {
  BarChart3,
  AlertTriangle,
  CalendarDays,
  BookOpen,
  ArrowUpRight,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";

const PRO_ENAMED_URL = "https://sanarflix.com.br/sanarflix-pro-enamed";

interface HomeHeroSectionProps {
  userName: string;
  simuladosRealizados: number;
  mediaAtual: number;
  lastScore: number | null;
  lastRankPosition: number | null;
  lastRankTotal: number | null;
  bestArea: string | null;
  recentScores: number[];
  nextWindowDate: string | null;
  pendingErrors?: number | null;
  worstArea?: string | null;
  segment?: string;
}

export function HomeHeroSection({
  userName,
  simuladosRealizados,
  mediaAtual,
  lastScore,
  lastRankPosition: _lastRankPosition,
  lastRankTotal: _lastRankTotal,
  bestArea: _bestArea,
  recentScores,
  nextWindowDate,
  pendingErrors = null,
  worstArea = null,
  segment = "guest",
}: HomeHeroSectionProps) {
  const hasHistory = recentScores.length > 0 && lastScore !== null;
  const historyMode =
    recentScores.length === 0
      ? "none"
      : recentScores.length === 1
        ? "single"
        : "multi";
  const safeLastScore = lastScore ?? 0;
  const previousScore =
    recentScores.length > 1 ? recentScores[recentScores.length - 2] : null;
  const delta = previousScore !== null ? safeLastScore - previousScore : null;

  const contextHeadline = (() => {
    if (historyMode === "none") return "Comece sua jornada de preparação";
    if (delta !== null && delta > 0) return "Sua performance está em ascensão";
    if (simuladosRealizados >= 5) return "Construindo consistência";
    return "Continue evoluindo";
  })();

  const lastSimuladoAria = [
    "Desempenho",
    lastScore !== null ? `nota ${lastScore}%` : "sem nota ainda",
    delta !== null
      ? `variação de ${delta >= 0 ? "+" : ""}${delta} pontos`
      : historyMode === "single"
        ? "primeiro resultado registrado"
        : "sem segundo resultado para comparar",
  ].join(", ");

  const windowAria = nextWindowDate
    ? `Próximo simulado, janela em ${nextWindowDate}`
    : "Simulados, nenhuma data futura listada";

  const cadernoAria =
    pendingErrors !== null && pendingErrors > 0
      ? `Caderno de erros, ${pendingErrors} questões pendentes`
      : "Caderno de erros, revisar questões marcadas";

  const isPro = segment === "pro";

  const kpis = [
    {
      key: "last",
      title: "Último resultado",
      value: lastScore !== null ? `${lastScore}%` : "—",
      ariaLabel: lastSimuladoAria,
      to: "/desempenho",
      icon: BarChart3,
      locked: false,
    },
    {
      key: "ranking",
      title: "Grande área de atenção",
      value: worstArea ?? "—",
      ariaLabel: `Grande área de atenção: ${worstArea ?? "sem dados ainda"}`,
      to: "/desempenho",
      icon: AlertTriangle,
      locked: false,
    },
    {
      key: "window",
      title: "Próximo simulado",
      value: nextWindowDate ?? "—",
      ariaLabel: windowAria,
      to: "/simulados",
      icon: CalendarDays,
      locked: false,
    },
    {
      key: "caderno",
      title: "Caderno de erros",
      value: pendingErrors !== null ? String(pendingErrors) : "Revisar",
      ariaLabel: cadernoAria,
      to: "/caderno-erros",
      icon: BookOpen,
      locked: !isPro,
    },
  ];

  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5"
      aria-label="Boas-vindas e status"
    >
      {/* --- Zone 1: Context & Motivation --- */}
      <div className={hasHistory ? "lg:col-span-7" : "lg:col-span-12"}>
        <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(142deg,hsl(345,64%,28%)_0%,hsl(345,60%,20%)_48%,hsl(340,54%,14%)_100%)] p-5 md:p-6 lg:p-7 shadow-[0_24px_48px_-20px_hsl(345_65%_16%/0.8),0_8px_20px_-12px_hsl(345_65%_16%/0.45)] min-h-[208px] flex flex-col justify-between">
          {/* Atmospheric glows */}
          <div className="pointer-events-none absolute -top-28 -right-16 h-72 w-72 rounded-full bg-[hsl(345,72%,48%)] blur-[80px] animate-glow-pulse" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[hsl(335,60%,52%)] opacity-[0.08] blur-[70px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_15%,rgba(255,255,255,0.12)_0%,transparent_60%)]" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="max-w-xl space-y-4">
              <h1 className="text-[28px] font-bold leading-[1.08] tracking-[-0.035em] text-white md:text-[34px] lg:text-[38px]">
                {contextHeadline}
                <span className="text-white/60">,</span>{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white/95 to-white/70">
                  {userName || "estudante"}
                </span>
              </h1>

              <p className="text-[15px] leading-[1.55] text-[rgba(245,241,238,0.9)] md:text-[16px]">
                {simuladosRealizados > 0
                  ? `${simuladosRealizados} simulado${simuladosRealizados !== 1 ? "s" : ""} realizado${simuladosRealizados !== 1 ? "s" : ""}. Média de ${mediaAtual}% no seu ciclo atual.`
                  : "Realize seu primeiro simulado e comece a construir seu histórico de evolução."}
              </p>
            </div>

            <div className="pt-4">
              <PremiumLink to="/simulados" variant="secondary" showArrow className="bg-white/90 border-white/15 text-[#2A1320] hover:bg-white text-[14px] px-5 py-2.5">
                Continuar preparação
              </PremiumLink>
            </div>
          </div>
        </div>
      </div>

      {/* --- Zone 2: Actionable KPI square (2x2) --- */}
      <div
        className={
          hasHistory ? "lg:col-span-5" : "block md:hidden"
        }
      >
        <div className="grid grid-cols-2 gap-2 h-full min-h-[160px] max-md:min-h-[176px] md:min-h-[188px]">
          {kpis.map((kpi) => {
            const cardInner = (
              <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border border-primary/20 bg-[linear-gradient(165deg,rgba(142,31,61,0.06)_0%,#FFFFFF_40%,#FBF7F9_100%)] p-3 shadow-[0_8px_18px_-14px_hsl(345_60%_30%/0.35),0_2px_6px_hsl(220_20%_10%/0.04)] transition-all duration-[240ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-primary/28 hover:shadow-[0_12px_22px_-14px_hsl(345_60%_30%/0.45),0_4px_10px_-8px_hsl(345_60%_30%/0.12)]">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Lock overlay for non-PRO caderno */}
                {kpi.locked && (
                  <div className="absolute inset-0 z-20 rounded-[18px] bg-black/[0.06] backdrop-blur-[1px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1">
                      <Lock className="h-4 w-4 text-primary/70" />
                      <span className="text-[9px] font-bold text-primary/60 uppercase tracking-wide">PRO</span>
                    </div>
                  </div>
                )}

                <div className="relative z-10 flex flex-col flex-1">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/16 bg-gradient-to-br from-primary/[0.1] to-primary/[0.18]">
                      <kpi.icon className="h-3.5 w-3.5 text-primary/85" aria-hidden />
                    </div>
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground/55 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <div className="flex flex-col gap-1 xl:flex-row xl:items-start xl:justify-between xl:gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold leading-tight tracking-[-0.025em] text-foreground/[0.88] transition-colors duration-200 group-hover:text-primary">
                        {kpi.title}
                      </p>
                    </div>
                    <p className={`leading-none font-extrabold tracking-[-0.03em] text-foreground tabular-nums xl:shrink-0 xl:text-right ${
                      kpi.key === "ranking" && worstArea
                        ? "text-[14px] xl:text-[13px] break-words"
                        : "text-[24px]"
                    }`}>
                      {kpi.value}
                    </p>
                  </div>
                </div>
              </div>
            );

            if (kpi.locked) {
              return (
                <a
                  key={kpi.key}
                  href={PRO_ENAMED_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group no-underline"
                  aria-label={`${kpi.title} — exclusivo Aluno PRO`}
                >
                  {cardInner}
                </a>
              );
            }

            return (
              <Link
                key={kpi.key}
                to={kpi.to}
                className="group no-underline"
                aria-label={`${kpi.title}. ${kpi.ariaLabel}. Valor: ${kpi.value}.`}
              >
                {cardInner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
