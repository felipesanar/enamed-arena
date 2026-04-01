import { ArrowRight, Lock, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import type { SimuladoWithStatus } from "@/types";
import { deriveScenario } from "@/lib/simuladoBannerScenario";

interface NextSimuladoBannerProps {
  simulados: SimuladoWithStatus[];
}

function formatDateShort(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

export function NextSimuladoBanner({ simulados }: NextSimuladoBannerProps) {
  const scenario = deriveScenario(simulados);

  if (scenario.type === "no_upcoming") {
    return (
      <BannerShell tone="calm">
        <BannerText
          title="Nenhum simulado disponível no momento"
          subtitle="Fique atento ao calendário para a próxima janela."
        />
        <Link
          to="/simulados"
          className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground max-md:w-full max-md:justify-center max-md:rounded-full max-md:border max-md:border-primary/15 max-md:bg-white/60 max-md:py-2 max-md:text-[11px] no-underline"
        >
          Ver calendário
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </BannerShell>
    );
  }

  if (scenario.type === "before_window") {
    const start = formatDateShort(scenario.start);
    const end = formatDateShort(scenario.end);
    return (
      <BannerShell tone="neutral">
        <BannerText
          title={
            <>
              Próximo simulado:{" "}
              <span className="text-primary font-bold">
                {start} a {end}
              </span>
            </>
          }
          subtitle="Realize na janela de execução para entrar no ranking nacional."
        />
        <BannerCTA to="/simulados" label="Ver simulados" />
      </BannerShell>
    );
  }

  if (scenario.type === "open_not_done") {
    return (
      <BannerShell tone="urgent">
        <BannerText
          title={
            <>
              Janela aberta —{" "}
              <span className="text-primary font-bold">{scenario.title}</span>
            </>
          }
          subtitle="Realize agora para garantir sua posição no ranking."
        />
        <BannerCTA
          to={`/simulados/${scenario.simuladoId}`}
          label="Realizar simulado"
          urgent
        />
      </BannerShell>
    );
  }

  if (scenario.type === "open_done_waiting") {
    const releaseDate = formatDateShort(scenario.resultsAt);
    return (
      <BannerShell tone="calm">
        <BannerText
          title="Simulado realizado!"
          subtitle={
            <>
              Resultado será divulgado em{" "}
              <span className="font-semibold text-foreground">
                {releaseDate}
              </span>
              .
            </>
          }
        />
        <span className="inline-flex shrink-0 cursor-default items-center gap-1.5 self-start rounded-lg border border-primary/15 bg-primary/[0.05] px-3 py-1.5 text-[11px] font-semibold text-primary/55 max-md:px-2 max-md:py-1 max-md:text-[10px] sm:self-auto">
          <Lock className="h-3 w-3" aria-hidden />
          Aguardando
        </span>
      </BannerShell>
    );
  }

  if (scenario.type === "after_done") {
    return (
      <BannerShell tone="celebration">
        <BannerText
          title={
            <>
              <span className="text-primary font-bold">{scenario.title}</span>{" "}
              — Resultado disponível
            </>
          }
          subtitle="Veja sua nota e posição no ranking."
        />
        <BannerCTA
          to={`/simulados/${scenario.simuladoId}/resultado`}
          label="Ver resultado"
        />
      </BannerShell>
    );
  }

  return null;
}

/* ── Sub-components ── */

type BannerTone = "urgent" | "celebration" | "neutral" | "calm";

function BannerShell({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: BannerTone;
}) {
  const toneStyles: Record<BannerTone, string> = {
    urgent:
      "border-primary/25 bg-[linear-gradient(100deg,rgba(142,31,61,0.14)_0%,rgba(142,31,61,0.07)_50%,rgba(255,255,255,0.8)_100%)] shadow-[0_14px_32px_-20px_hsl(345_65%_30%/0.5),0_2px_10px_-4px_hsl(345_65%_30%/0.18)]",
    celebration:
      "border-primary/20 bg-[linear-gradient(100deg,rgba(142,31,61,0.1)_0%,rgba(142,31,61,0.05)_48%,rgba(255,255,255,0.82)_100%)] shadow-[0_12px_28px_-18px_hsl(345_65%_30%/0.45),0_2px_8px_-4px_hsl(345_65%_30%/0.16)]",
    neutral:
      "border-primary/14 bg-[linear-gradient(100deg,rgba(142,31,61,0.08)_0%,rgba(142,31,61,0.03)_52%,rgba(255,255,255,0.85)_100%)] shadow-[0_10px_24px_-18px_hsl(345_65%_30%/0.3),0_2px_8px_-4px_hsl(345_65%_30%/0.12)]",
    calm: "border-[#E8E1E5]/60 bg-[linear-gradient(100deg,rgba(142,31,61,0.04)_0%,rgba(142,31,61,0.02)_56%,rgba(255,255,255,0.9)_100%)] shadow-[0_6px_18px_-14px_hsl(345_65%_30%/0.2)]",
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border px-4 py-2.5 backdrop-blur-sm md:px-5 md:py-3 max-md:-mx-4 max-md:w-[calc(100%+2rem)] max-md:rounded-xl max-md:px-2.5 max-md:py-2 ${toneStyles[tone]}`}
    >
      {tone === "urgent" && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_50%,rgba(142,31,61,0.08)_0%,transparent_60%)]" />
      )}
      {tone === "celebration" && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_100%_50%,rgba(142,31,61,0.06)_0%,transparent_50%)]" />
      )}
      <div className="relative flex flex-row items-start gap-2 sm:items-center sm:gap-3">
        <div className="relative mt-0.5 shrink-0 sm:mt-0">
          <Bell className="h-4 w-4 text-primary/70 max-md:h-3.5 max-md:w-3.5" aria-hidden />
          {(tone === "urgent" || tone === "celebration") && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#E83862] ring-2 ring-white/80 max-md:h-1.5 max-md:w-1.5 max-md:ring-1" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 max-md:gap-1.5">
          {children}
        </div>
      </div>
    </div>
  );
}

function BannerText({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 max-md:pr-0">
      <p className="text-[13px] font-bold leading-snug tracking-[-0.01em] text-foreground max-md:text-[12px] max-md:leading-tight">
        {title}
      </p>
      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground max-md:mt-0.5 max-md:text-[11px] max-md:leading-snug">
        {subtitle}
      </p>
    </div>
  );
}

function BannerCTA({
  to,
  label,
  urgent,
}: {
  to: string;
  label: string;
  urgent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all duration-200 active:scale-[0.98] no-underline max-md:w-full max-md:rounded-full max-md:py-2 max-md:text-[11px] sm:justify-start ${
        urgent
          ? "bg-primary text-primary-foreground shadow-[0_4px_16px_-4px_hsl(345_65%_30%/0.45),0_2px_6px_-2px_hsl(345_65%_30%/0.2)] hover:shadow-[0_6px_20px_-4px_hsl(345_65%_30%/0.55),0_4px_10px_-4px_hsl(345_65%_30%/0.25)] hover:brightness-110"
          : "bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.25)] hover:brightness-110"
      }`}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5 max-md:h-3 max-md:w-3" aria-hidden />
    </Link>
  );
}
