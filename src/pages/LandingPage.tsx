import { motion } from "framer-motion";
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
      {/* Animated ambient orbs — wine/primary glow (SanarFlix Pro) */}
      <div
        className="fixed inset-0 pointer-events-none -z-[1] overflow-hidden"
        aria-hidden
      >
        {/* Orb 1 — top-left, wine-glow */}
        <motion.div
          className="absolute top-[-5%] left-[-8%] w-[600px] h-[600px] rounded-full bg-[hsl(var(--wine-glow)/0.18)] blur-[100px]"
          animate={{ x: [0, 35, 0], y: [0, -25, 0] }}
          transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
        />
        {/* Orb 2 — top-right, primary */}
        <motion.div
          className="absolute top-[5%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[hsl(var(--primary)/0.10)] blur-[90px]"
          animate={{ x: [0, -28, 0], y: [0, 20, 0] }}
          transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
        />
        {/* Orb 3 — bottom-center, wine */}
        <motion.div
          className="absolute bottom-[0%] left-[30%] w-[400px] h-[400px] rounded-full bg-[hsl(var(--wine)/0.08)] blur-[80px]"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
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
        <LandingSocialProof />
        <LandingCta />
        <LandingFooter />
      </main>
    </div>
  );
}
