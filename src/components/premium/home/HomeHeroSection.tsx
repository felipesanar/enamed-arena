import { PremiumLink } from "@/components/premium/PremiumLink";

interface HomeHeroSectionProps {
  userName: string;
  simuladosRealizados: number;
  mediaAtual: number;
  lastScore: number | null;
  recentScores: number[];
}

export function HomeHeroSection({
  userName,
  simuladosRealizados,
  mediaAtual,
  lastScore,
  recentScores,
}: HomeHeroSectionProps) {
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

  return (
    <section aria-label="Boas-vindas e status">
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
            <PremiumLink
              to="/simulados"
              variant="secondary"
              showArrow
              className="bg-white/90 border-white/15 text-[#2A1320] hover:bg-white text-[14px] px-5 py-2.5"
            >
              Continuar preparação
            </PremiumLink>
          </div>
        </div>
      </div>
    </section>
  );
}
