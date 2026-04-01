import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { SEGMENT_LABELS } from "@/types";
import { usePersistedState, clearPersistedStateByPrefix } from "@/hooks/usePersistedState";
import { trackEvent } from "@/lib/analytics";
import { BrandIcon } from "@/components/brand/BrandMark";
import { SpecialtyStep } from "@/components/onboarding/SpecialtyStep";
import { InstitutionStep } from "@/components/onboarding/InstitutionStep";
import { ConfirmationStep } from "@/components/onboarding/ConfirmationStep";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

const STEPS = ["Especialidade", "Instituições", "Confirmação"] as const;

export default function OnboardingPage() {
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
  const [selectedSpecialty, setSelectedSpecialty] = usePersistedState(
    "onboarding:specialty",
    ""
  );
  const [selectedInstitutions, setSelectedInstitutions] = usePersistedState<
    string[]
  >("onboarding:institutions", []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditingBlocked = isOnboardingComplete && onboardingEditLocked;

  const nextEditableText = onboardingNextEditableAt
    ? new Date(onboardingNextEditableAt).toLocaleString("pt-BR")
    : null;

  const canProceed = () => {
    switch (step) {
      case 0:
        return selectedSpecialty !== "";
      case 1:
        return selectedInstitutions.length >= 1;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (isEditingBlocked) return;
    setError("");
    if (!canProceed()) {
      if (step === 0)
        setError("Selecione uma especialidade para continuar.");
      if (step === 1)
        setError(
          'Selecione ao menos 1 instituição ou marque "Ainda não sei".'
        );
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (isEditingBlocked) return;
    setError("");
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (isEditingBlocked) {
      setError(
        "Seu perfil só pode ser editado entre janelas de execução."
      );
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/30 flex flex-col">
      {/* Brand header */}
      <div className="text-center pt-8 pb-2">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20 mx-auto mb-2">
          <BrandIcon size="sm" className="h-8 w-8" alt="" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
          sanarflix
        </span>
        <p className="text-heading-3 text-foreground">PRO: ENAMED</p>
      </div>

      <div className="max-w-3xl mx-auto py-4 px-4 flex-1 w-full">
        {isEditingBlocked && onboarding && (
          <div className="mb-6 p-4 rounded-xl border border-warning/30 bg-warning/10 text-warning">
            <p className="text-body-sm font-semibold">
              Edição temporariamente bloqueada
            </p>
            <p className="text-caption mt-1">
              Durante janela de execução você não pode alterar
              especialidade/instituições.
              {nextEditableText
                ? ` Próxima janela de edição: ${nextEditableText}.`
                : ""}
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-caption font-bold shrink-0 transition-all duration-300 ${
                  i < step
                    ? "bg-success text-primary-foreground"
                    : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-body-sm hidden md:inline transition-colors ${
                  i === step
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${
                    i < step ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
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

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-xl bg-destructive/10 text-destructive text-body-sm text-center font-medium"
          >
            {error}
          </motion.div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-body font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Voltar
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || isEditingBlocked}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
            >
              Continuar
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSaving || isEditingBlocked}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
            >
              {isSaving ? (
                <>
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
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
