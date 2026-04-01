import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { EASE } from "@/lib/landingMotion";

/** Animation delays for staggered entrance */
const DELAY = {
  eyebrow: 0.05,
  headline: 0.15,
  subhead: 0.26,
  ctas: 0.36,
  social: 0.44,
  visual: 0.18,
  chipLeft: 0.5,
  chipRight: 0.6,
  stats: 0.65,
} as const;

export function LandingHero() {
  const prefersReducedMotion = useReducedMotion();

  /** Enable 3D hover only on real pointer devices ≥ lg */
  /** Used in Task 3/4: enables 3D hover tilt on the AI insight card */
  const [finePointerHoverDesktop, setFinePointerHoverDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover)");
    const sync = () => setFinePointerHoverDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const { scrollY } = useScroll();
  const visualY = useTransform(scrollY, [0, 400], [0, 60]);
  const visualOpacity = useTransform(scrollY, [0, 200], [1, 0.7]);

  /** Helper: entrance animation props, no-op when reduced motion is preferred */
  const entrance = (delay: number, yAmount = 20) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: yAmount },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  return (
    <section
      id="hero"
      className="relative min-h-[100svh] flex flex-col justify-center overflow-x-hidden overflow-y-visible pb-16 pt-[max(env(safe-area-inset-top,0px),clamp(4rem,2.25vw+3rem,5.25rem))]"
    >
      {/* ── Background ── */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden>
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#07060d_0%,#0e0b1a_50%,#080511_100%)]" />

        {/* Grid texture — masked radially so it fades at edges */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "36px 36px",
            maskImage:
              "radial-gradient(ellipse 85% 85% at 50% 50%, black 15%, transparent 75%)",
          }}
        />

        {/* Glow 1 — wine, top-left */}
        <motion.div
          className="absolute -top-20 -left-16 w-[420px] h-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(176,48,80,0.22) 0%, transparent 60%)",
          }}
          animate={prefersReducedMotion ? {} : { x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Glow 2 — purple, bottom-right */}
        <motion.div
          className="absolute -bottom-28 right-[15%] w-[320px] h-[320px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(90,60,180,0.14) 0%, transparent 62%)",
          }}
          animate={prefersReducedMotion ? {} : { x: [0, -20, 0], y: [0, 25, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Glow 3 — wine subtle, top-right */}
        <div
          className="absolute top-[35%] right-[8%] w-[200px] h-[200px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(176,48,80,0.11) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* ── Content grid (filled in next tasks) ── */}
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-14 xl:gap-16 items-center">
          {/* Left column — Task 2 */}
          <div className="space-y-6 lg:space-y-7" />

          {/* Right column — Task 3 */}
          <div className="hidden lg:block" />
        </div>
      </div>
    </section>
  );
}
