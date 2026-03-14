import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useUser } from "@/contexts/UserContext";
import { SEGMENT_LABELS } from "@/types";
import { Settings, User, Bell, Shield, GraduationCap, Building2, Edit3 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ConfiguracoesPage() {
  const { profile, onboarding, isOnboardingComplete } = useUser();
  const segment = profile?.segment ?? 'guest';

  return (
    <AppLayout>
      <PageHeader
        title="Configurações"
        subtitle="Gerencie seu perfil e preferências da plataforma."
      />

      {/* Onboarding profile summary */}
      {isOnboardingComplete && onboarding && (
        <>
          <SectionHeader
            title="Perfil Acadêmico"
            action={
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-1.5 text-body-sm text-primary hover:text-wine-hover transition-colors font-semibold"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </Link>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <PremiumCard className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <p className="text-overline uppercase text-muted-foreground">Segmento</p>
              </div>
              <p className="text-body font-semibold text-foreground">{SEGMENT_LABELS[segment]}</p>
            </PremiumCard>
            <PremiumCard className="p-5" delay={0.06}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <p className="text-overline uppercase text-muted-foreground">Especialidade</p>
              </div>
              <p className="text-body font-semibold text-foreground">{onboarding.specialty}</p>
            </PremiumCard>
            <PremiumCard className="p-5" delay={0.12}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <p className="text-overline uppercase text-muted-foreground">Instituições</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {onboarding.targetInstitutions.map(inst => (
                  <span key={inst} className="px-2.5 py-1 rounded-lg bg-accent text-accent-foreground text-caption font-medium">
                    {inst}
                  </span>
                ))}
              </div>
            </PremiumCard>
          </div>
        </>
      )}

      <SectionHeader title="Geral" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {[
          { title: "Perfil", desc: "Dados pessoais e preferências", icon: User },
          { title: "Notificações", desc: "Alertas de simulados e resultados", icon: Bell },
          { title: "Plano", desc: `Seu plano: ${SEGMENT_LABELS[segment]}`, icon: Shield },
          { title: "Preferências", desc: "Personalizar a experiência", icon: Settings },
        ].map((item, i) => (
          <PremiumCard key={item.title} interactive delay={i * 0.08} className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-body font-medium text-foreground">{item.title}</p>
                <p className="text-body-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          </PremiumCard>
        ))}
      </div>
    </AppLayout>
  );
}