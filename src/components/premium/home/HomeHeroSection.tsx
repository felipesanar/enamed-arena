import { PremiumLink } from "@/components/premium/PremiumLink";
import type { HomeHeroState } from "@/lib/home-hero-state";

interface HomeHeroSectionProps {
  heroState: HomeHeroState;
}

const toneStyles: Record<HomeHeroState["tone"], string> = {
  default:
    "bg-[linear-gradient(142deg,hsl(345,64%,28%)_0%,hsl(345,60%,20%)_48%,hsl(340,54%,14%)_100%)] shadow-[0_24px_48px_-20px_hsl(345_65%_16%/0.8),0_8px_20px_-12px_hsl(345_65%_16%/0.45)]",
  focus:
    "bg-[linear-gradient(142deg,hsl(344,66%,30%)_0%,hsl(342,63%,22%)_48%,hsl(334,56%,16%)_100%)] shadow-[0_24px_48px_-20px_hsl(343_68%_17%/0.8),0_8px_20px_-12px_hsl(343_68%_17%/0.45)]",
  calm:
    "bg-[linear-gradient(142deg,hsl(344,48%,24%)_0%,hsl(336,40%,18%)_50%,hsl(228,26%,16%)_100%)] shadow-[0_24px_48px_-20px_hsl(238_28%_14%/0.65),0_8px_20px_-12px_hsl(238_28%_14%/0.4)]",
  progress:
    "bg-[linear-gradient(142deg,hsl(345,62%,27%)_0%,hsl(330,58%,20%)_50%,hsl(220,34%,18%)_100%)] shadow-[0_24px_48px_-20px_hsl(330_54%_16%/0.75),0_8px_20px_-12px_hsl(330_54%_16%/0.42)]",
};

export function HomeHeroSection({ heroState }: HomeHeroSectionProps) {
  const titleParts = heroState.headline.split(",");
  const hasCommaBreak = titleParts.length > 1;
  const firstPart = titleParts[0];
  const secondPart = hasCommaBreak ? titleParts.slice(1).join(",").trim() : null;

  return (
    <section aria-label="Boas-vindas e status">
      <div
        className={`relative overflow-hidden rounded-[28px] border border-white/[0.08] p-5 md:p-6 lg:p-7 min-h-[208px] flex flex-col justify-between ${toneStyles[heroState.tone]}`}
      >
        {/* Atmospheric glows */}
        <div className="pointer-events-none absolute -top-28 -right-16 h-72 w-72 rounded-full bg-[hsl(345,72%,48%)] blur-[80px] animate-glow-pulse" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[hsl(335,60%,52%)] opacity-[0.08] blur-[70px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_15%,rgba(255,255,255,0.12)_0%,transparent_60%)]" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="max-w-xl space-y-4">
            <p className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/78">
              {heroState.eyebrow}
            </p>
            <h1 className="text-[28px] font-bold leading-[1.08] tracking-[-0.035em] text-white md:text-[34px] lg:text-[38px]">
              <span>{firstPart}</span>
              {secondPart ? (
                <>
                  <span className="text-white/60">,</span>{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white/95 to-white/70">
                    {secondPart}
                  </span>
                </>
              ) : null}
            </h1>

            <p className="text-[15px] leading-[1.55] text-[rgba(245,241,238,0.9)] md:text-[16px]">
              {heroState.description}
            </p>
          </div>

          <div className="pt-4">
            <PremiumLink
              to={heroState.ctaTo}
              variant="secondary"
              showArrow
              className="bg-white/90 border-white/15 text-[#2A1320] hover:bg-white text-[14px] px-5 py-2.5"
            >
              {heroState.ctaLabel}
            </PremiumLink>
          </div>
        </div>
      </div>
    </section>
  );
}
