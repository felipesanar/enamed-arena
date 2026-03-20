import { LandingProgressBar } from "@/components/landing/LandingProgressBar";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingValueProps } from "@/components/landing/LandingValueProps";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingExperience } from "@/components/landing/LandingExperience";
import { LandingComparison } from "@/components/landing/LandingComparison";
import { LandingPremium } from "@/components/landing/LandingPremium";
import { LandingSocialProof } from "@/components/landing/LandingSocialProof";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="dark landing-dark min-h-screen font-sans antialiased text-foreground bg-landing-bg">
      {/* Overlay gradients — wine/primary glow (SanarFlix Pro) */}
      <div
        className="fixed inset-0 pointer-events-none -z-[1]"
        aria-hidden
        style={{
          background: `
            radial-gradient(circle at 20% 10%, hsl(var(--wine-glow) / 0.22), transparent 28%),
            radial-gradient(circle at 78% 20%, hsl(var(--primary) / 0.12), transparent 22%),
            radial-gradient(circle at 50% 75%, hsl(var(--wine) / 0.08), transparent 26%)
          `,
          filter: "blur(40px)",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none -z-[1] opacity-20"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(circle at 50% 50%, black 40%, transparent 85%)",
        }}
      />

      <LandingProgressBar />
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingValueProps />
        <LandingHowItWorks />
        <LandingExperience />
        <LandingComparison />
        <LandingPremium />
        <LandingSocialProof />
        <LandingCta />
        <LandingFooter />
      </main>
    </div>
  );
}
