import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/contexts/AuthContext";
import { SEGMENT_LABELS } from "@/types";
import { Settings, User, Bell, Shield, GraduationCap, Building2, Edit3, LogOut, Database } from "lucide-react";
import { Link } from "react-router-dom";

export default function ConfiguracoesPage() {
  const {
    profile,
    onboarding,
    isOnboardingComplete,
    dataSource,
    onboardingEditLocked,
    onboardingNextEditableAt,
  } = useUser();
  const { user: authUser, signOut } = useAuth();
  const segment = profile?.segment ?? 'guest';

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Seu perfil e preferências da plataforma."
      />

      {authUser && (
        <>
          <SectionHeader title="Sua conta" />
          <PremiumCard className="p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-body font-semibold text-foreground">{profile?.name || 'Sem nome'}</p>
                  <p className="text-body-sm text-muted-foreground">{authUser.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 text-success text-caption font-semibold">
                  <Database className="h-3 w-3" />
                  {dataSource === 'supabase' ? 'Dados reais (Supabase)' : 'Carregando...'}
                </span>
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-body-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </button>
              </div>
            </div>
          </PremiumCard>
        </>
      )}

      <SectionHeader title="Seu plano" />
      <PremiumCard className="p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-body font-semibold text-foreground">{SEGMENT_LABELS[segment]}</p>
            <p className="text-body-sm text-muted-foreground">
              {segment === 'guest'
                ? 'Acesso gratuito aos simulados. Para upgrade, entre em contato com a equipe SanarFlix.'
                : segment === 'standard'
                ? 'Aluno SanarFlix — acesso a simulados, ranking e comparativos.'
                : 'Aluno PRO: ENAMED — acesso completo à plataforma.'}
            </p>
          </div>
        </div>
      </PremiumCard>

      {isOnboardingComplete && onboarding && (
        <>
          <SectionHeader
            title="Seu perfil acadêmico"
            action={
              onboardingEditLocked ? (
                <span className="inline-flex items-center gap-1.5 text-body-sm text-warning font-semibold">
                  <Edit3 className="h-3.5 w-3.5" />
                  Edição bloqueada em janela ativa
                </span>
              ) : (
                <Link
                  to="/onboarding"
                  className="inline-flex items-center gap-1.5 text-body-sm text-primary hover:text-wine-hover transition-colors font-semibold"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </Link>
              )
            }
          />
          {onboardingEditLocked && (
            <p className="text-caption text-warning mb-3">
              Você poderá editar novamente entre janelas de simulado.
              {onboardingNextEditableAt ? ` Liberação prevista: ${new Date(onboardingNextEditableAt).toLocaleString('pt-BR')}.` : ''}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <PremiumCard className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <p className="text-overline uppercase text-muted-foreground">Especialidade</p>
              </div>
              <p className="text-body font-semibold text-foreground">{onboarding.specialty}</p>
            </PremiumCard>
            <PremiumCard className="p-5" delay={0.06}>
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

      <SectionHeader title="Outras preferências" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {[
          { title: "Dados pessoais", desc: "Nome e informações da conta", icon: User },
          { title: "Notificações", desc: "Alertas de simulados e resultados", icon: Bell },
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
    </>
  );
}
