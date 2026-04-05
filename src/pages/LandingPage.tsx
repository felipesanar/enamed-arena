import { useEffect, useRef } from 'react';
import { motion } from "framer-motion";
import { trackEvent } from '@/lib/analytics';
import { LandingProgressBar } from "@/components/landing/LandingProgressBar";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingValueProps } from "@/components/landing/LandingValueProps";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingExperience } from "@/components/landing/LandingExperience";
import { LandingComparison } from "@/components/landing/LandingComparison";
import { LandingPremium } from "@/components/landing/LandingPremium";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function LandingPage() {
  const landingTracked = useRef(false);
  useEffect(() => {
    if (landingTracked.current) return;
    landingTracked.current = true;
    const params = new URLSearchParams(window.location.search);
    trackEvent('landing_page_viewed', {
      referrer: document.referrer || 'direct',
      utm_source: params.get('utm_source') ?? undefined,
      utm_medium: params.get('utm_medium') ?? undefined,
      utm_campaign: params.get('utm_campaign') ?? undefined,
    });
  }, []);

  return (
    <div className="dark landing-dark min-h-screen font-sans antialiased text-foreground bg-landing-bg">
      {/* Animated ambient orbs — wine/primary glow (SanarFlix Pro) */}
      <div
        className="fixed inset-0 pointer-events-none -z-[1] overflow-hidden"
        aria-hidden
      >
        {/* Orb 1 — top-left, wine-glow */}
        <div
          className="absolute top-[-5%] left-[-8%] w-[600px] h-[600px] rounded-full bg-[hsl(var(--wine-glow)/0.18)] blur-[100px] landing-orb-drift-a"
          aria-hidden="true"
        />
        {/* Orb 2 — top-right: main + leve accent-mid (variedade tonal) */}
        <div
          className="absolute top-[5%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[90px] landing-orb-drift-b"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, hsl(var(--landing-accent-mid) / 0.06) 55%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        {/* Orb 3 — bottom-center, wine */}
        <div
          className="absolute bottom-[0%] left-[30%] w-[400px] h-[400px] rounded-full bg-[hsl(var(--wine)/0.08)] blur-[80px] landing-orb-pulse"
          aria-hidden="true"
        />
      </div>
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
        <LandingCta />
        <LandingFooter />
      </main>
    </div>
  );
}
