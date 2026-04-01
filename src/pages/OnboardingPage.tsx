import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { SPECIALTIES, INSTITUTIONS } from "@/data/mock";
import { MIN_INSTITUTIONS_GUEST, SEGMENT_LABELS } from "@/types";
import { usePersistedState, clearPersistedStateByPrefix } from "@/hooks/usePersistedState";
import { trackEvent } from "@/lib/analytics";
import { BrandIcon } from "@/components/brand/BrandMark";
import {
  GraduationCap,
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Sparkles,
} from "lucide-react";

const STEPS = ['Especialidade', 'Instituições', 'Confirmação'] as const;

// ─── Step 1: Specialty Selection ───
const AINDA_NAO_SEI = 'Ainda não sei';

function SpecialtyStep({ specialty, onSelect }: { specialty: string; onSelect: (s: string) => void }) {
  const [search, setSearch] = useState('');

  const allOptions = useMemo(() => [AINDA_NAO_SEI, ...SPECIALTIES], []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    return allOptions.filter(s => s.toLowerCase().includes(search.toLowerCase()));
  }, [search, allOptions]);

  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-heading-2 text-foreground mb-2">Qual sua especialidade desejada?</h2>
        <p className="text-body text-muted-foreground max-w-md mx-auto">
          Usaremos essa informação para comparar seu desempenho com candidatos da mesma área.
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar especialidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
          {filtered.map((spec) => {
            const isSelected = specialty === spec;
            const isUndecided = spec === AINDA_NAO_SEI;
            return (
              <button
                key={spec}
                onClick={() => onSelect(spec)}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 text-left group ${
                  isUndecided ? 'sm:col-span-2' : ''
                } ${
                  isSelected
                    ? 'border-primary bg-accent'
                    : isUndecided
                    ? 'border-dashed border-border bg-muted/30 hover:border-primary/30 hover:bg-accent/30'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-accent/30'
                }`}
              >
                <span className={`text-body transition-colors ${isSelected ? 'text-primary font-medium' : isUndecided ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                  {spec}
                </span>
                {isSelected ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-2 text-center text-body-sm text-muted-foreground py-8">
              Nenhuma especialidade encontrada para "{search}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Institution Selection ───
const MAX_INSTITUTIONS = 3;

function InstitutionStep({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (inst: string) => void;
}) {
  const [search, setSearch] = useState('');
  const isUndecided = selected.includes(AINDA_NAO_SEI);

  const filtered = useMemo(() => {
    if (!search.trim()) return INSTITUTIONS;
    return INSTITUTIONS.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  const handleToggleUndecided = () => {
    if (isUndecided) {
      onToggle(AINDA_NAO_SEI);
    } else {
      // Clear all and set "ainda não sei"
      selected.forEach(inst => onToggle(inst));
      onToggle(AINDA_NAO_SEI);
    }
  };

  const handleToggleInstitution = (inst: string) => {
    if (isUndecided) {
      // Remove "ainda não sei" first
      onToggle(AINDA_NAO_SEI);
    }
    const alreadySelected = selected.filter(s => s !== AINDA_NAO_SEI).includes(inst);
    if (!alreadySelected && selected.filter(s => s !== AINDA_NAO_SEI).length >= MAX_INSTITUTIONS) {
      return; // Max reached
    }
    onToggle(inst);
  };

  const realSelected = selected.filter(s => s !== AINDA_NAO_SEI);

  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-heading-2 text-foreground mb-2">Quais instituições você deseja?</h2>
        <p className="text-body text-muted-foreground max-w-md mx-auto">
          Selecione até {MAX_INSTITUTIONS} instituições onde pretende prestar residência.
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        {/* "Ainda não sei" option */}
        <button
          onClick={handleToggleUndecided}
          className={`w-full mb-4 p-3.5 rounded-xl border transition-all duration-150 text-left flex items-center justify-between ${
            isUndecided
              ? 'border-primary bg-accent'
              : 'border-dashed border-border bg-muted/30 hover:border-primary/30 hover:bg-accent/30'
          }`}
        >
          <span className={`text-body transition-colors ${isUndecided ? 'text-primary font-medium' : 'text-muted-foreground italic'}`}>
            {AINDA_NAO_SEI}
          </span>
          {isUndecided && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
        </button>

        {!isUndecided && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar instituição..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className={`text-caption font-semibold px-3 py-2 rounded-lg shrink-0 ${
                realSelected.length > 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              }`}>
                {realSelected.length}/{MAX_INSTITUTIONS}
              </div>
            </div>

            {realSelected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {realSelected.map(inst => (
                  <button
                    key={inst}
                    onClick={() => onToggle(inst)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-body-sm font-medium hover:bg-primary/20 transition-colors"
                  >
                    {inst}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {filtered.map((inst) => {
                const isSelected = realSelected.includes(inst);
                const isMaxReached = !isSelected && realSelected.length >= MAX_INSTITUTIONS;
                return (
                  <button
                    key={inst}
                    onClick={() => handleToggleInstitution(inst)}
                    disabled={isMaxReached}
                    className={`p-3 rounded-xl border text-center transition-all duration-150 text-body-sm font-medium ${
                      isSelected
                        ? 'border-primary bg-accent text-primary'
                        : isMaxReached
                        ? 'border-border bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                        : 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent/30'
                    }`}
                  >
                    {inst}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-3 text-center text-body-sm text-muted-foreground py-8">
                  Nenhuma instituição encontrada para "{search}"
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Confirmation ───
function ConfirmationStep({
  segment,
  specialty,
  institutions,
}: {
  segment: string;
  specialty: string;
  institutions: string[];
}) {
  const segmentLabel = SEGMENT_LABELS[segment as keyof typeof SEGMENT_LABELS] ?? segment;

  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-heading-2 text-foreground mb-2">Tudo pronto!</h2>
        <p className="text-body text-muted-foreground max-w-md mx-auto">
          Confira suas informações antes de começar. Você poderá editar esses dados entre as janelas de simulado.
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-overline uppercase text-muted-foreground mb-1">Seu plano</p>
          <p className="text-body font-semibold text-foreground">{segmentLabel}</p>
          <p className="text-caption text-muted-foreground mt-1">Definido pela sua assinatura</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-overline uppercase text-muted-foreground mb-1">Especialidade desejada</p>
          <p className="text-body font-semibold text-foreground">{specialty}</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-overline uppercase text-muted-foreground mb-1">Instituições desejadas</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {institutions.map(inst => (
              <span key={inst} className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-body-sm font-medium">
                {inst}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Onboarding Page ───
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

  const segment = profile?.segment ?? 'guest';

  const [step, setStep] = usePersistedState('onboarding:step', 0);
  const [selectedSpecialty, setSelectedSpecialty] = usePersistedState('onboarding:specialty', '');
  const [selectedInstitutions, setSelectedInstitutions] = usePersistedState<string[]>('onboarding:institutions', []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditingBlocked = isOnboardingComplete && onboardingEditLocked;

  const nextEditableText = onboardingNextEditableAt
    ? new Date(onboardingNextEditableAt).toLocaleString('pt-BR')
    : null;

  const canProceed = () => {
    switch (step) {
      case 0: return selectedSpecialty !== '';
      case 1: return selectedInstitutions.length >= 1;
      case 2: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (isEditingBlocked) return;
    setError('');
    if (!canProceed()) {
      if (step === 0) setError('Selecione uma especialidade para continuar.');
      if (step === 1) setError('Selecione ao menos 1 instituição ou marque "Ainda não sei".');
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (isEditingBlocked) return;
    setError('');
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (isEditingBlocked) {
      setError('Seu perfil só pode ser editado entre janelas de execução.');
      return;
    }
    if (!canProceed()) return;
    setIsSaving(true);
    setError('');
    try {
      await saveOnboarding({
        specialty: selectedSpecialty,
        targetInstitutions: selectedInstitutions,
      });
      trackEvent('onboarding_completed', {
        segment,
        specialty: selectedSpecialty,
        institutionsCount: selectedInstitutions.length,
      });
      // Clean up persisted onboarding state on success
      clearPersistedStateByPrefix('onboarding:');
      console.log('[OnboardingPage] Onboarding completed successfully');
      navigate('/');
    } catch (e) {
      console.error('[OnboardingPage] Error saving onboarding:', e);
      setError('Erro ao salvar seus dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleInstitution = useCallback((inst: string) => {
    setSelectedInstitutions(prev =>
      prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]
    );
  }, [setSelectedInstitutions]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/30 flex flex-col">
      {/* Brand header */}
      <div className="text-center pt-8 pb-2">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20 mx-auto mb-2">
          <BrandIcon size="sm" className="h-8 w-8" alt="" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">sanarflix</span>
        <p className="text-heading-3 text-foreground">PRO: ENAMED</p>
      </div>
      <div className="max-w-3xl mx-auto py-4 px-4 flex-1 w-full">
        {isEditingBlocked && onboarding && (
          <div className="mb-6 p-4 rounded-xl border border-warning/30 bg-warning/10 text-warning">
            <p className="text-body-sm font-semibold">Edição temporariamente bloqueada</p>
            <p className="text-caption mt-1">
              Durante janela de execução você não pode alterar especialidade/instituições.
              {nextEditableText ? ` Próxima janela de edição: ${nextEditableText}.` : ''}
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-caption font-bold shrink-0 transition-all duration-300 ${
                i < step
                  ? 'bg-success text-primary-foreground'
                  : i === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-body-sm hidden md:inline transition-colors ${
                i === step ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${
                  i < step ? 'bg-success' : 'bg-border'
                }`} />
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
            {step === 0 && <SpecialtyStep specialty={selectedSpecialty} onSelect={setSelectedSpecialty} />}
            {step === 1 && <InstitutionStep selected={selectedInstitutions} onToggle={toggleInstitution} />}
            {step === 2 && <ConfirmationStep segment={segment} specialty={selectedSpecialty} institutions={selectedInstitutions} />}
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
