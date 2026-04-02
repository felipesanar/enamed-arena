import { useState, useCallback, useRef, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { usePersistedState, clearPersistedStateByPrefix } from "@/hooks/usePersistedState";
import { trackEvent } from "@/lib/analytics";
import { BrandIcon } from "@/components/brand/BrandMark";
import { SpecialtyStep } from "@/components/onboarding/SpecialtyStep";
import { InstitutionStep } from "@/components/onboarding/InstitutionStep";
import { ConfirmationStep } from "@/components/onboarding/ConfirmationStep";
import { ChevronRight, ChevronLeft, Sparkles, CheckCircle2, GraduationCap, Building2 } from "lucide-react";

const STEPS = ["Especialidade", "Instituições", "Confirmação"] as const;

const STEP_GLOWS: Array<Array<React.CSSProperties>> = [
  [
    { top: -70, left: -50, width: 280, height: 280, background: "radial-gradient(circle, rgba(232,56,98,.16) 0%, transparent 65%)" },
    { bottom: -30, right: -30, width: 180, height: 180, background: "radial-gradient(circle, rgba(90,21,48,.14) 0%, transparent 65%)" },
  ],
  [
    { top: -50, right: -50, width: 260, height: 260, background: "radial-gradient(circle, rgba(180,40,80,.16) 0%, transparent 65%)" },
    { bottom: 60, left: -60, width: 200, height: 200, background: "radial-gradient(circle, rgba(120,20,55,.12) 0%, transparent 65%)" },
  ],
  [
    { top: -50, left: "50%", width: 320, height: 260, transform: "translateX(-50%)", background: "radial-gradient(circle, rgba(200,50,80,.14) 0%, transparent 65%)" },
    { bottom: -30, left: "50%", width: 240, height: 180, transform: "translateX(-50%)", background: "radial-gradient(circle, rgba(90,21,48,.1) 0%, transparent 65%)" },
  ],
];

const STEP_META = [
  {
    icon: GraduationCap,
    title: "Qual sua especialidade desejada?",
    description:
      "Usaremos essa informação para comparar seu desempenho com candidatos da mesma área.",
  },
  {
    icon: Building2,
    title: "Quais instituições você deseja?",
    description:
      "Selecione até 3 instituições do ENARE onde pretende prestar residência.",
  },
  {
    icon: Sparkles,
    title: "Tudo pronto!",
    description:
      "Confira suas informações antes de começar. Editável entre janelas de simulado.",
  },
] as const;

const DESKTOP_TIPS: Record<number, string[]> = {
  0: ["Aparece no seu ranking e comparativos", "Editável entre janelas de prova"],
  1: ["Comparativo com inscritos nessas vagas", "Máximo 3 instituições do ENARE"],
};

function DesktopTips({ step }: { step: number }) {
  const tips = DESKTOP_TIPS[step];
  if (!tips) return null;
  return (
    <div className="flex flex-col gap-2 mt-2">
      {tips.map((tip) => (
        <div
          key={tip}
          className="rounded-[9px] px-3 py-2 flex items-start gap-2"
          style={{
            background: "rgba(255,255,255,.028)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px]"
            style={{ background: "rgba(232,56,98,.5)" }}
          />
          <span
            className="text-[10.5px] leading-relaxed"
            style={{ color: "rgba(255,255,255,.38)" }}
          >
            {tip}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const prefersReducedMotion = useReducedMotion();
  const {
    profile,
    onboarding,
    isOnboardingComplete,
    saveOnboarding,
    onboardingEditLocked,
    onboardingNextEditableAt,
  } = useUser();
  const navigate = useNavigate();
  const segment = profile?.segment ?? "guest";

  const [step, setStep] = usePersistedState("onboarding:step", 0);
  const [selectedSpecialty, setSelectedSpecialty] = usePersistedState("onboarding:specialty", "");
  const [selectedInstitutions, setSelectedInstitutions] = usePersistedState<string[]>("onboarding:institutions", []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditingBlocked = isOnboardingComplete && onboardingEditLocked;

  const nextEditableText = onboardingNextEditableAt
    ? new Date(onboardingNextEditableAt).toLocaleString("pt-BR")
    : null;

  const canProceed = () => {
    switch (step) {
      case 0: return selectedSpecialty !== "";
      case 1: return selectedInstitutions.length >= 1;
      case 2: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (isEditingBlocked) return;
    setError("");
    if (!canProceed()) {
      if (step === 0) setError("Selecione uma especialidade para continuar.");
      if (step === 1) setError('Selecione ao menos 1 instituição ou marque "Ainda não sei".');
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (isEditingBlocked) return;
    setError("");
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (isEditingBlocked) {
      setError("Seu perfil só pode ser editado entre janelas de execução.");
      return;
    }
    if (!canProceed()) return;
    setIsSaving(true);
    setError("");
    try {
      await saveOnboarding({
        specialty: selectedSpecialty,
        targetInstitutions: selectedInstitutions,
      });
      trackEvent("onboarding_completed", {
        segment,
        specialty: selectedSpecialty,
        institutionsCount: selectedInstitutions.length,
      });
      clearPersistedStateByPrefix("onboarding:");
      navigate("/");
    } catch (e) {
      console.error("[OnboardingPage] Error saving onboarding:", e);
      setError("Erro ao salvar seus dados. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleInstitution = useCallback(
    (inst: string) => {
      setSelectedInstitutions((prev) =>
        prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst]
      );
    },
    [setSelectedInstitutions]
  );

  // Horizontal swipe detection (pointer events — doesn't conflict with inner scroll)
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && canProceed() && step < STEPS.length - 1) handleNext();
    if (dx > 0 && step > 0) handleBack();
  };

  const StepIcon = STEP_META[step].icon;

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={{
        background: "linear-gradient(145deg, #160610 0%, #0a0508 55%, #120208 100%)",
      }}
    >
      {/* Per-step atmospheric glow blobs */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          {STEP_GLOWS[step].map((style, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{ ...style, filter: "blur(70px)" } as React.CSSProperties}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Scanline texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
        }}
        aria-hidden
      />

      {/* Brand header */}
      <div className="relative z-10 flex flex-col items-center pt-9 pb-0 gap-1.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
          style={{
            background:
              "linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.35) 100%)",
            border: "1px solid rgba(232,56,98,.28)",
            boxShadow:
              "0 3px 12px rgba(232,56,98,.18), inset 0 1px 0 rgba(255,255,255,.08)",
          }}
        >
          <BrandIcon size="sm" className="h-8 w-8" alt="" />
        </div>
        <span
          className="text-[9px] uppercase tracking-[.18em] font-bold"
          style={{ color: "rgba(255,255,255,.28)" }}
        >
          sanarflix
        </span>
        <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,.65)" }}>
          PRO: ENAMED
        </p>
      </div>

      {/* Progress dots */}
      <div className="relative z-10 flex items-center justify-center px-14 pt-5">
        {([0, 1, 2] as const).map((i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div
                className="flex-1 max-w-16 min-w-4 h-px mx-1.5 transition-colors duration-500"
                style={{
                  background:
                    i <= step
                      ? "rgba(74,222,128,.3)"
                      : "rgba(255,255,255,.09)",
                }}
              />
            )}
            <div
              className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold transition-all duration-300${i === step ? " onboarding-dot-active" : ""}`}
              style={
                i < step
                  ? {
                      background: "rgba(74,222,128,.12)",
                      border: "2px solid rgba(74,222,128,.5)",
                      color: "#4ade80",
                    }
                  : i === step
                  ? {
                      background: "rgba(232,56,98,.2)",
                      border: "2px solid #e83862",
                      color: "#e83862",
                    }
                  : {
                      background: "rgba(255,255,255,.03)",
                      border: "2px solid rgba(255,255,255,.13)",
                      color: "rgba(255,255,255,.25)",
                    }
              }
            >
              {i < step ? (
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
              ) : (
                i + 1
              )}
            </div>
          </Fragment>
        ))}
      </div>

      {/* Step labels */}
      <div className="relative z-10 flex justify-between px-7 pt-1.5">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className="text-[9px] font-semibold uppercase tracking-[.07em] flex-1 text-center transition-colors duration-300"
            style={{
              color:
                i < step
                  ? "rgba(74,222,128,.5)"
                  : i === step
                  ? "rgba(232,56,98,.85)"
                  : "rgba(255,255,255,.18)",
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Edit-locked banner */}
      {isEditingBlocked && onboarding && (
        <div
          className="relative z-10 mx-3.5 mt-3 p-3.5 rounded-xl"
          style={{
            background: "rgba(251,191,36,.08)",
            border: "1px solid rgba(251,191,36,.2)",
            color: "rgba(251,191,36,.9)",
          }}
        >
          <p className="text-[13px] font-semibold">
            Edição temporariamente bloqueada
          </p>
          <p className="text-[11px] mt-1 opacity-80">
            Durante janela de execução você não pode alterar
            especialidade/instituições.
            {nextEditableText
              ? ` Próxima janela de edição: ${nextEditableText}.`
              : ""}
          </p>
        </div>
      )}

      {/* Glass panel */}
      <div
        className="relative z-10 mx-3.5 mt-4 mb-4 lg:mx-auto lg:mt-5 lg:mb-8 lg:max-w-[900px] lg:w-full flex flex-col flex-1"
        style={{
          borderRadius: 28,
          background: "rgba(255,255,255,.022)",
          border: "1px solid rgba(255,255,255,.06)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.055), 0 16px 48px -16px rgba(0,0,0,.4)",
          overflow: "hidden",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* Card body: 2-column on desktop */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Left column — desktop only */}
          <div
            className="hidden lg:flex lg:w-[280px] lg:flex-shrink-0 flex-col relative lg:border-r lg:border-white/[.055] lg:px-6 lg:py-7"
            style={{ background: "rgba(255,255,255,.012)" }}
          >
            {/* Subtle radial glow */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(232,56,98,.07) 0%, transparent 65%)",
              }}
              aria-hidden
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.35,
                  ease: "easeInOut",
                }}
                className="flex flex-col gap-4 relative z-10"
              >
                {/* Glyph box */}
                <div className="relative" style={{ width: 56, height: 56 }}>
                  <div
                    className="pointer-events-none absolute inset-[-8px] rounded-full onboarding-glyph-glow"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(232,56,98,.12) 0%, transparent 65%)",
                    }}
                    aria-hidden
                  />
                  <div
                    className="relative flex items-center justify-center rounded-[16px] onboarding-glyph-box"
                    style={{
                      width: 56,
                      height: 56,
                      background:
                        "linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.42) 100%)",
                      border: "1px solid rgba(232,56,98,.32)",
                      boxShadow: "0 6px 24px rgba(232,56,98,.22)",
                    }}
                  >
                    <StepIcon
                      className="w-[26px] h-[26px]"
                      style={{ color: "#e83862" }}
                      strokeWidth={1.75}
                    />
                  </div>
                </div>

                {/* Wine accent rule */}
                <div
                  className="w-7 h-0.5 rounded-full"
                  style={{ background: "rgba(232,56,98,.45)" }}
                />

                {/* Step title */}
                <p
                  className="text-[17px] font-extrabold leading-snug"
                  style={{ color: "rgba(255,255,255,.88)" }}
                >
                  {STEP_META[step].title}
                </p>

                {/* Step description */}
                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: "rgba(255,255,255,.38)" }}
                >
                  {STEP_META[step].description}
                </p>

                {/* Contextual tips */}
                <DesktopTips step={step} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right column */}
          <div className="flex-1 overflow-hidden flex flex-col lg:px-6 lg:py-5 lg:pb-0">
            {/* Step content */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: -40 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="h-full"
                >
                  {step === 0 && (
                    <SpecialtyStep
                      specialty={selectedSpecialty}
                      onSelect={setSelectedSpecialty}
                    />
                  )}
                  {step === 1 && (
                    <InstitutionStep
                      selected={selectedInstitutions}
                      onToggle={toggleInstitution}
                      selectedSpecialty={selectedSpecialty}
                    />
                  )}
                  {step === 2 && (
                    <ConfirmationStep
                      segment={segment}
                      specialty={selectedSpecialty}
                      institutions={selectedInstitutions}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 mb-1 px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-center"
              style={{
                background: "rgba(232,56,98,.1)",
                border: "1px solid rgba(232,56,98,.2)",
                color: "rgba(255,255,255,.8)",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom nav */}
        <div
          className="flex items-center gap-2.5 px-4 lg:px-6 pb-7 pt-3.5 flex-shrink-0"
          style={{
            background:
              "linear-gradient(to top, rgba(10,5,8,.96) 0%, rgba(10,5,8,.65) 100%)",
            borderTop: "1px solid rgba(255,255,255,.055)",
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[13px] text-[12.5px] font-medium transition-opacity disabled:opacity-0 disabled:pointer-events-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{
              background: "rgba(255,255,255,.055)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.45)",
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Voltar
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isEditingBlocked}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[13px] text-[13.5px] font-bold transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e83862]/40"
              style={{
                background: "#e83862",
                color: "#fff",
                boxShadow: "0 3px 16px rgba(232,56,98,.32)",
              }}
            >
              Continuar
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSaving || isEditingBlocked}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[13px] text-[13.5px] font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e83862]/40"
              style={{
                background:
                  "linear-gradient(135deg, #e83862 0%, #b52240 100%)",
                color: "#fff",
                boxShadow: "0 3px 20px rgba(232,56,98,.38)",
              }}
            >
              {isSaving ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Começar
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
