import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { motion } from "framer-motion";
import { GraduationCap, Building2, Sparkles, ChevronRight } from "lucide-react";

export default function OnboardingPage() {
  console.log('[OnboardingPage] Rendering');

  return (
    <AppLayout>
      <PageHeader
        title="Configure seu perfil"
        subtitle="Personalize sua experiência informando seus objetivos."
        badge="Onboarding"
      />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Step indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 mb-8"
        >
          {[
            { step: 1, label: 'Especialidade' },
            { step: 2, label: 'Instituições' },
            { step: 3, label: 'Confirmação' },
          ].map((item, i) => (
            <div key={item.step} className="flex items-center gap-3 flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-caption font-bold shrink-0 ${
                i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {item.step}
              </div>
              <span className={`text-body-sm hidden sm:inline ${
                i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}>
                {item.label}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </motion.div>

        {/* Specialty selection placeholder */}
        <PremiumCard className="p-6 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-heading-3 text-foreground">Especialidade desejada</h2>
              <p className="text-body-sm text-muted-foreground">Qual especialidade você deseja seguir?</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Cardiologia'].map((spec) => (
              <button
                key={spec}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-accent/50 transition-all text-left group"
              >
                <span className="text-body text-foreground group-hover:text-primary transition-colors">{spec}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
          <p className="text-body-sm text-muted-foreground mt-4 text-center">
            Mostrando 4 de 15 especialidades
          </p>
        </PremiumCard>

        {/* Institutions placeholder */}
        <PremiumCard className="p-6 md:p-8 opacity-60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-heading-3 text-muted-foreground">Instituições desejadas</h2>
              <p className="text-body-sm text-muted-foreground">Selecione ao menos 3 instituições para continuar.</p>
            </div>
          </div>
        </PremiumCard>
      </div>
    </AppLayout>
  );
}
