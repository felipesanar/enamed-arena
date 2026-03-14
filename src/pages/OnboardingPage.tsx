import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { useUser } from "@/contexts/UserContext";
import { SPECIALTIES, INSTITUTIONS } from "@/data/mock";
import { MIN_INSTITUTIONS_GUEST, SEGMENT_LABELS, type UserSegment } from "@/types";
import {
  GraduationCap,
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Sparkles,
  User,
  Shield,
  Crown,
} from "lucide-react";

const STEPS = ['Segmento', 'Especialidade', 'Instituições', 'Confirmação'] as const;

// ─── Step 1: Segment Selection ───
function SegmentStep({ segment, onSelect }: { segment: UserSegment; onSelect: (s: UserSegment) => void }) {
  

  const options: { value: UserSegment; label: string; desc: string; icon: typeof User }[] = [
    { value: 'guest', label: 'Não sou aluno', desc: 'Quero experimentar os simulados e conhecer a plataforma.', icon: User },
    { value: 'standard', label: 'Aluno SanarFlix', desc: 'Tenho assinatura SanarFlix e quero acompanhar minha evolução.', icon: Shield },
    { value: 'pro', label: 'Aluno PRO: ENAMED', desc: 'Tenho o plano PRO e quero acesso completo à plataforma.', icon: Crown },
  ];

  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
          <User className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-heading-2 text-foreground mb-2">Como você se identifica?</h2>
        <p className="text-body text-muted-foreground max-w-md mx-auto">
          Isso nos ajuda a personalizar sua experiência e mostrar os recursos certos para você.
        </p>
      </div>

      <div className="space-y-3 max-w-lg mx-auto">
        {options.map((opt) => {
          const isSelected = segment === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left group ${
                isSelected
                  ? 'border-primary bg-accent shadow-sm'
                  : 'border-border bg-card hover:border-primary/30 hover:bg-accent/30'
              }`}
            >
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-primary'
              }`}>
                <opt.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-body font-semibold transition-colors ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {opt.label}
                </p>
                <p className="text-body-sm text-muted-foreground">{opt.desc}</p>
              </div>
              {isSelected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2: Specialty Selection ───
function SpecialtyStep({ specialty, onSelect }: { specialty: string; onSelect: (s: string) => void }) {
  const [search, setSearch] = useState('');
  

  const filtered = useMemo(() => {
    if (!search.trim()) return SPECIALTIES;
    return SPECIALTIES.filter(s => s.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

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
        {/* Search */}
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

        {/* Options grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
          {filtered.map((spec) => {
            const isSelected = specialty === spec;
            return (
              <button
                key={spec}
                onClick={() => onSelect(spec)}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 text-left group ${
                  isSelected
                    ? 'border-primary bg-accent'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-accent/30'
                }`}
              >
                <span className={`text-body transition-colors ${isSelected ? 'text-primary font-medium' : 'text-foreground'}`}>
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

// ─── Step 3: Institution Selection ───
function InstitutionStep({
  selected,
  onToggle,
  minRequired,
}: {
  selected: string[];
  onToggle: (inst: string) => void;
  minRequired: number;
}) {
  const [search, setSearch] = useState('');
  

  const filtered = useMemo(() => {
    if (!search.trim()) return INSTITUTIONS;
    return INSTITUTIONS.filter(i => i.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-heading-2 text-foreground mb-2">Quais instituições você deseja?</h2>
        <p className="text-body text-muted-foreground max-w-md mx-auto">
          Selecione as instituições onde pretende prestar residência. Mínimo de {minRequired} {minRequired === 1 ? 'instituição' : 'instituições'}.
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        {/* Counter + Search */}
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
            selected.length >= minRequired ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
          }`}>
            {selected.length}/{minRequired}+
          </div>
        </div>

        {/* Selected pills */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selected.map(inst => (
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

        {/* Options */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {filtered.map((inst) => {
            const isSelected = selected.includes(inst);
            return (
              <button
                key={inst}
                onClick={() => onToggle(inst)}
                className={`p-3 rounded-xl border text-center transition-all duration-150 text-body-sm font-medium ${
                  isSelected
                    ? 'border-primary bg-accent text-primary'
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
      </div>
    </div>
  );
}

// ─── Step 4: Confirmation ───
function ConfirmationStep({
  segment,
  specialty,
  institutions,
}: {
  segment: UserSegment;
  specialty: string;
  institutions: string[];
}) {
  

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
          <p className="text-overline uppercase text-muted-foreground mb-1">Segmento</p>
          <p className="text-body font-semibold text-foreground">{SEGMENT_LABELS[segment]}</p>
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
  const { profile, saveOnboarding, setSegment, isOnboardingComplete } = useUser();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState<UserSegment>(profile?.segment ?? 'guest');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  console.log('[OnboardingPage] Step:', step, 'Segment:', selectedSegment);

  const minInstitutions = selectedSegment === 'guest' ? MIN_INSTITUTIONS_GUEST : 1;

  const canProceed = () => {
    switch (step) {
      case 0: return true; // segment always has a value
      case 1: return selectedSpecialty !== '';
      case 2: return selectedInstitutions.length >= minInstitutions;
      case 3: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    setError('');
    if (!canProceed()) {
      if (step === 1) setError('Selecione uma especialidade para continuar.');
      if (step === 2) setError(`Selecione ao menos ${minInstitutions} instituição(ões).`);
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (!canProceed()) return;
    setIsSaving(true);
    setError('');
    try {
      setSegment(selectedSegment);
      await saveOnboarding({
        specialty: selectedSpecialty,
        targetInstitutions: selectedInstitutions,
      });
      console.log('[OnboardingPage] Onboarding completed successfully');
      navigate('/');
    } catch (e) {
      console.error('[OnboardingPage] Error saving onboarding:', e);
      setError('Erro ao salvar seus dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleInstitution = (inst: string) => {
    setSelectedInstitutions(prev =>
      prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]
    );
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-4">
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
            {step === 0 && <SegmentStep segment={selectedSegment} onSelect={setSelectedSegment} />}
            {step === 1 && <SpecialtyStep specialty={selectedSpecialty} onSelect={setSelectedSpecialty} />}
            {step === 2 && <InstitutionStep selected={selectedInstitutions} onToggle={toggleInstitution} minRequired={minInstitutions} />}
            {step === 3 && <ConfirmationStep segment={selectedSegment} specialty={selectedSpecialty} institutions={selectedInstitutions} />}
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-body font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50"
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
    </AppLayout>
  );
}
