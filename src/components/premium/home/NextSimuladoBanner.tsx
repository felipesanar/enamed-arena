import { CalendarDays, ArrowRight, Lock, PlayCircle, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import type { SimuladoWithStatus } from "@/types";

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

type BannerScenario =
  | { type: "before_window"; start: string; end: string }
  | { type: "open_not_done"; simuladoId: string; title: string }
  | { type: "open_done_waiting"; resultsAt: string }
  | { type: "after_done"; simuladoId: string; title: string }
  | { type: "no_upcoming" };

function deriveScenario(simulados: SimuladoWithStatus[]): BannerScenario {
  const now = Date.now();

  // Find simulados in open window
  const openWindow = simulados.find((s) => {
    const start = Date.parse(s.executionWindowStart);
    const end = Date.parse(s.executionWindowEnd);
    return start <= now && now <= end;
  });

  if (openWindow) {
    const finished = openWindow.userState?.finished === true;
    if (!finished) {
      return { type: "open_not_done", simuladoId: openWindow.id, title: openWindow.title };
    }
    // Finished — check if results are released
    const resultsAt = Date.parse(openWindow.resultsReleaseAt);
    if (Number.isFinite(resultsAt) && now < resultsAt) {
      return { type: "open_done_waiting", resultsAt: openWindow.resultsReleaseAt };
    }
    return { type: "after_done", simuladoId: openWindow.id, title: openWindow.title };
  }

  // Check for recently finished (after window, done)
  const recentlyFinished = simulados.find((s) => {
    const end = Date.parse(s.executionWindowEnd);
    return end < now && s.userState?.finished === true;
  });

  if (recentlyFinished) {
    const resultsAt = Date.parse(recentlyFinished.resultsReleaseAt);
    if (Number.isFinite(resultsAt) && now < resultsAt) {
      return { type: "open_done_waiting", resultsAt: recentlyFinished.resultsReleaseAt };
    }
    // Results available — but also check for upcoming
  }

  // Find next upcoming
  const upcoming = simulados
    .filter((s) => {
      const start = Date.parse(s.executionWindowStart);
      return Number.isFinite(start) && start > now;
    })
    .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));

  if (upcoming.length > 0) {
    return {
      type: "before_window",
      start: upcoming[0].executionWindowStart,
      end: upcoming[0].executionWindowEnd,
    };
  }

  return { type: "no_upcoming" };
}

export function NextSimuladoBanner({ simulados }: NextSimuladoBannerProps) {
  const scenario = deriveScenario(simulados);

  // Empty / no upcoming
  if (scenario.type === "no_upcoming") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-r from-muted/60 via-card to-muted/40 p-4 md:p-5 shadow-[0_2px_12px_-4px_hsl(220_20%_10%/0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted-foreground/10 border border-muted-foreground/10">
              <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground mb-0.5">
                Nenhum simulado disponível no momento
              </p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Fique atento ao calendário para a próxima janela.
              </p>
            </div>
          </div>
          <Link
            to="/simulados"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Ver calendário
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  // Before window — show dates
  if (scenario.type === "before_window") {
    const start = formatDateShort(scenario.start);
    const end = formatDateShort(scenario.end);
    return (
      <BannerShell>
        <BannerIcon>
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
        </BannerIcon>
        <BannerText
          title={<>Próximo simulado: <span className="text-primary font-bold">{start} a {end}</span></>}
          subtitle="Realize na janela de execução para entrar no ranking nacional."
        />
        <Link
          to="/simulados"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-[13px] font-semibold shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)] hover:brightness-110 transition-all duration-200 active:scale-[0.98] shrink-0 no-underline"
        >
          Ver simulados
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </BannerShell>
    );
  }

  // Open window, not done — CTA to start
  if (scenario.type === "open_not_done") {
    return (
      <BannerShell>
        <BannerIcon>
          <PlayCircle className="h-5 w-5 text-primary" aria-hidden />
        </BannerIcon>
        <BannerText
          title={<>Janela aberta — <span className="text-primary font-bold">{scenario.title}</span></>}
          subtitle="Realize agora para garantir sua posição no ranking."
        />
        <Link
          to={`/simulados/${scenario.simuladoSlug}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-[13px] font-semibold shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)] hover:brightness-110 transition-all duration-200 active:scale-[0.98] shrink-0 no-underline"
        >
          Realizar simulado
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </BannerShell>
    );
  }

  // Done but waiting for results
  if (scenario.type === "open_done_waiting") {
    const releaseDate = formatDateShort(scenario.resultsAt);
    return (
      <BannerShell>
        <BannerIcon>
          <Lock className="h-5 w-5 text-primary" aria-hidden />
        </BannerIcon>
        <BannerText
          title="Simulado realizado!"
          subtitle={<>Resultado será divulgado em <span className="font-semibold text-foreground">{releaseDate}</span>.</>}
        />
        <span className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-2 text-[13px] font-semibold text-primary/70 shrink-0 cursor-default">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Aguardando resultado
        </span>
      </BannerShell>
    );
  }

  // After window, done — CTA to see result
  if (scenario.type === "after_done") {
    return (
      <BannerShell>
        <BannerIcon>
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
        </BannerIcon>
        <BannerText
          title={<><span className="text-primary font-bold">{scenario.title}</span> — Resultado disponível</>}
          subtitle="Veja sua nota e posição no ranking."
        />
        <Link
          to={`/resultado/${scenario.simuladoId}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-[13px] font-semibold shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)] hover:brightness-110 transition-all duration-200 active:scale-[0.98] shrink-0 no-underline"
        >
          Ver resultado
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </BannerShell>
    );
  }

  return null;
}

/* ── Reusable sub-components ── */

function BannerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/[0.07] via-accent/60 to-primary/[0.04] border border-primary/15 p-4 md:p-5 shadow-[0_2px_12px_-4px_hsl(345_65%_30%/0.08)]">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.03] to-transparent pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
        {children}
      </div>
    </div>
  );
}

function BannerIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.15)]">
      {children}
    </div>
  );
}

function BannerText({ title, subtitle }: { title: React.ReactNode; subtitle: React.ReactNode }) {
  return (
    <div className="flex-1">
      <p className="text-[14px] font-semibold text-foreground mb-0.5">{title}</p>
      <p className="text-[13px] text-muted-foreground leading-relaxed">{subtitle}</p>
    </div>
  );
}
