import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Shield, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserSegment } from "@/types";
import { SANARFLIX_PRO_ENAMED_URL } from "@/lib/sanarflix";

interface PlanBillboardProps {
  segment: UserSegment;
}

const PRO_BENEFITS: { label: string; hint?: string }[] = [
  { label: "Simulados cronometrados oficiais ENAMED" },
  { label: "Ranking nacional e por instituição" },
  { label: "Comparativo entre simulados" },
  { label: "Caderno de Erros personalizado", hint: "Exclusivo PRO" },
  { label: "Prioridade em atualizações e trilhas" },
];

const STANDARD_INCLUDED: string[] = [
  "Simulados cronometrados",
  "Ranking nacional",
  "Comparativo entre simulados",
];

const STANDARD_MISSING: string[] = [
  "Caderno de Erros",
  "Trilhas e aulas completas",
];

export function PlanBillboard({ segment }: PlanBillboardProps) {
  const reduced = useReducedMotion();

  if (segment === "pro") {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative overflow-hidden rounded-2xl text-white"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--wine-hover)) 55%, hsl(345 80% 20%) 100%)",
        }}
      >
        {/* Decorative layers */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.25), transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full blur-3xl opacity-40"
          style={{
            background:
              "radial-gradient(closest-side, hsl(350 90% 70% / 0.3), transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />

        <div className="relative px-6 md:px-8 py-7 md:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-micro-label uppercase tracking-wider font-bold ring-1 ring-white/25">
                <Crown className="h-3 w-3" aria-hidden="true" />
                Plano ativo
              </span>
              <h3 className="mt-3 text-heading-2 md:text-heading-1 leading-tight tracking-tight">
                SanarFlix PRO
              </h3>
              <p className="mt-1.5 text-body-sm text-white/80 max-w-md">
                Você tem acesso completo à plataforma ENAMED: simulados,
                comparativos, ranking e Caderno de Erros.
              </p>
            </div>
            <span
              aria-hidden="true"
              className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur"
            >
              <Shield className="h-5 w-5" />
            </span>
          </div>

          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6">
            {PRO_BENEFITS.map((b) => (
              <li
                key={b.label}
                className="flex items-start gap-2.5 text-body-sm text-white/95"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className="flex-1">
                  {b.label}
                  {b.hint && (
                    <span className="ml-2 text-white/70 text-caption">
                      {b.hint}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between gap-3 pt-5 border-t border-white/15">
            <p className="text-caption text-white/75">
              Gerencie sua assinatura no portal SanarFlix.
            </p>
            <a
              href={SANARFLIX_PRO_ENAMED_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur px-3.5 py-2 text-body-sm font-semibold ring-1 ring-white/25 transition-colors"
            >
              Abrir portal
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </motion.div>
    );
  }

  // Standard & guest — upsell card
  const title =
    segment === "guest"
      ? "Desbloqueie seu acesso completo"
      : "Eleve para o Aluno PRO";
  const subtitle =
    segment === "guest"
      ? "Como Visitante você acessa simulados e ranking. Assine o SanarFlix PRO ENAMED e acompanhe seu desempenho com comparativos e Caderno de Erros."
      : "Você já tem ranking e comparativos. O PRO adiciona Caderno de Erros e trilhas completas para levar sua preparação ao próximo nível.";
  const ctaLabel = segment === "guest" ? "Conhecer o PRO" : "Fazer upgrade";

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/20 bg-card",
        "shadow-[0_8px_28px_-12px_hsl(var(--primary)/0.25)]",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)",
        }}
      />

      <div className="relative px-6 md:px-8 py-7 md:py-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent text-primary px-2.5 py-1 text-micro-label uppercase tracking-wider font-bold ring-1 ring-primary/15">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Upgrade disponível
            </span>
            <h3 className="mt-3 text-heading-2 leading-tight tracking-tight text-foreground">
              {title}
            </h3>
            <p className="mt-1.5 text-body-sm text-muted-foreground max-w-lg">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
          <ul className="space-y-2">
            {STANDARD_INCLUDED.map((b) => (
              <li
                key={b}
                className="flex items-center gap-2.5 text-body-sm text-foreground"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                >
                  <Check className="h-3 w-3" />
                </span>
                {b}
              </li>
            ))}
          </ul>
          <ul className="space-y-2">
            {STANDARD_MISSING.map((b) => (
              <li
                key={b}
                className="flex items-center gap-2.5 text-body-sm text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                </span>
                {b}
                <span className="ml-auto text-micro-label uppercase tracking-wider text-primary font-bold">
                  PRO
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-caption text-muted-foreground">
            Sem fidelidade. Cancele quando quiser no portal SanarFlix.
          </p>
          <a
            href={SANARFLIX_PRO_ENAMED_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-wine-hover text-primary-foreground px-4 py-2.5 text-body-sm font-semibold transition-colors shadow-[0_6px_16px_-8px_hsl(var(--primary)/0.6)]"
          >
            {ctaLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
