import { motion, useReducedMotion } from "framer-motion";
import { Shield, GraduationCap, Building2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserSegment } from "@/types";
import { SEGMENT_LABELS } from "@/types";

interface SettingsHeroProps {
  name: string;
  email: string;
  segment: UserSegment;
  specialty?: string | null;
  institutionsCount?: number;
  avatarUrl?: string | null;
}

const SEGMENT_ACCENT: Record<UserSegment, {
  label: string;
  chipClass: string;
  ringClass: string;
  crownClass: string;
  glowClass: string;
}> = {
  guest: {
    label: SEGMENT_LABELS.guest,
    chipClass: "bg-muted text-muted-foreground border-border",
    ringClass: "ring-border",
    crownClass: "bg-muted text-muted-foreground",
    glowClass: "from-muted/40 to-transparent",
  },
  standard: {
    label: SEGMENT_LABELS.standard,
    chipClass: "bg-accent text-accent-foreground border-primary/20",
    ringClass: "ring-primary/30",
    crownClass: "bg-primary/10 text-primary",
    glowClass: "from-primary/15 via-primary/5 to-transparent",
  },
  pro: {
    label: SEGMENT_LABELS.pro,
    chipClass:
      "bg-gradient-to-r from-primary to-wine-hover text-primary-foreground border-transparent shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.55)]",
    ringClass: "ring-primary/50",
    crownClass: "bg-primary text-primary-foreground",
    glowClass: "from-primary/25 via-primary/8 to-transparent",
  },
};

function initialsOf(name: string, fallback: string) {
  const source = (name || fallback || "").trim();
  if (!source) return "··";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SettingsHero({
  name,
  email,
  segment,
  specialty,
  institutionsCount,
  avatarUrl,
}: SettingsHeroProps) {
  const reduced = useReducedMotion();
  const accent = SEGMENT_ACCENT[segment];
  const displayName = name?.trim() || email?.split("@")[0] || "Você";
  const initials = initialsOf(name, email);

  return (
    <motion.section
      aria-label="Resumo da conta"
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative overflow-hidden rounded-[28px] border border-border/80 bg-card mb-8 md:mb-10"
    >
      {/* Ambient gradient layer */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          accent.glowClass,
        )}
      />
      {/* Subtle mesh highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full blur-3xl opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--wine-glow) / 0.18), transparent 70%)",
        }}
      />

      <div className="relative px-6 md:px-8 py-8 md:py-10 flex flex-col md:flex-row gap-6 md:items-center">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "relative h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden ring-2 ring-offset-4 ring-offset-card",
              accent.ringClass,
            )}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="h-full w-full flex items-center justify-center text-white font-bold text-[2rem] tracking-tight"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--wine-hover)) 100%)",
                }}
              >
                {initials}
              </div>
            )}
            {/* Plan crown */}
            {segment === "pro" && (
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card shadow-md"
                title="Aluno PRO"
              >
                <Shield className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-micro-label uppercase tracking-wider",
                accent.chipClass,
              )}
            >
              {segment === "pro" && <Sparkles className="h-3 w-3" aria-hidden="true" />}
              {accent.label}
            </span>
          </div>
          <h1 className="text-heading-1 md:text-[2rem] leading-tight tracking-tight text-foreground truncate">
            {displayName}
          </h1>
          <p className="mt-1 text-body-sm md:text-body text-muted-foreground truncate">
            {email}
          </p>

          {/* Meta chips */}
          {(specialty || institutionsCount) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm">
              {specialty && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <GraduationCap
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-foreground font-medium">
                    {specialty}
                  </span>
                </span>
              )}
              {institutionsCount !== undefined && institutionsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Building2
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="text-foreground font-medium">
                      {institutionsCount}
                    </span>{" "}
                    {institutionsCount === 1 ? "instituição" : "instituições"} alvo
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
