import { useState } from "react";
import { PageTransition } from "@/components/premium/PageTransition";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { SectionHeader } from "@/components/SectionHeader";
import { AcademicProfileEditor } from "@/components/profile/AcademicProfileEditor";
import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/contexts/AuthContext";
import { SEGMENT_LABELS } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SANARFLIX_PRO_ENAMED_URL } from "@/lib/sanarflix";
import {
  Shield, User, GraduationCap, Building2, Edit3, LogOut,
  Save, X, Camera,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

export default function ConfiguracoesPage() {
  const {
    profile,
    onboarding,
    isOnboardingComplete,
    onboardingEditLocked,
    onboardingNextEditableAt,
    saveOnboarding,
    refreshProfile,
  } = useUser();
  const { user: authUser, signOut } = useAuth();
  const segment = profile?.segment ?? 'guest';

  // Edit mode for personal data
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');
  const [saving, setSaving] = useState(false);

  // Edit mode for academic profile
  const [editingAcademic, setEditingAcademic] = useState(false);
  const [savingAcademic, setSavingAcademic] = useState(false);

  const handleSave = async () => {
    if (!authUser || !editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName.trim() })
        .eq('id', authUser.id);
      if (error) throw error;
      toast({ title: 'Nome atualizado com sucesso.' });
      setEditing(false);
      refreshProfile?.();
    } catch (err) {
      logger.error('[ConfiguracoesPage] Error saving name:', err);
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
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
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <label htmlFor="profile-name-input" className="sr-only">
                        Seu nome completo
                      </label>
                      <input
                        id="profile-name-input"
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        aria-label="Seu nome completo"
                        className="text-body font-semibold text-foreground bg-muted px-3 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !editName.trim()}
                        aria-label="Salvar nome"
                        title="Salvar nome"
                        className="h-8 w-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-40"
                      >
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditing(false); setEditName(profile?.name || ''); }}
                        aria-label="Cancelar edição do nome"
                        title="Cancelar edição"
                        className="h-8 w-8 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 flex items-center justify-center transition-colors"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-body font-semibold text-foreground">{profile?.name || 'Sem nome'}</p>
                      <button
                        type="button"
                        onClick={() => { setEditName(profile?.name || ''); setEditing(true); }}
                        aria-label="Editar nome"
                        title="Editar nome"
                        className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <Edit3 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <p className="text-body-sm text-muted-foreground">{authUser.email}</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-body-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
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
                : 'Aluno PRO — acesso completo à plataforma.'}
            </p>
          </div>
          {segment === 'guest' && (
            <a
              href={SANARFLIX_PRO_ENAMED_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-body-sm font-semibold hover:bg-wine-hover transition-colors shrink-0"
            >
              Conhecer o PRO
            </a>
          )}
        </div>
      </PremiumCard>

       {isOnboardingComplete && onboarding && (
        <>
          <SectionHeader
            title="Seu perfil acadêmico"
            action={
              editingAcademic ? null :
              onboardingEditLocked ? (
                <span className="inline-flex items-center gap-1.5 text-body-sm text-warning font-semibold">
                  <Edit3 className="h-3.5 w-3.5" />
                  Edição bloqueada em janela ativa
                </span>
              ) : (
                <button
                  onClick={() => setEditingAcademic(true)}
                  className="inline-flex items-center gap-1.5 text-body-sm text-primary hover:text-wine-hover transition-colors font-semibold"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </button>
              )
            }
          />
          {onboardingEditLocked && !editingAcademic && (
            <p className="text-caption text-warning mb-3">
              Você poderá editar novamente entre janelas de simulado.
              {onboardingNextEditableAt ? ` Liberação prevista: ${new Date(onboardingNextEditableAt).toLocaleString('pt-BR')}.` : ''}
            </p>
          )}

          {editingAcademic ? (
            <PremiumCard className="p-5 mb-8">
              <AcademicProfileEditor
                initialSpecialty={onboarding.specialty}
                initialInstitutions={onboarding.targetInstitutions}
                saving={savingAcademic}
                onCancel={() => setEditingAcademic(false)}
                onSave={async (data) => {
                  setSavingAcademic(true);
                  try {
                    await saveOnboarding(data);
                    toast({ title: 'Perfil acadêmico atualizado!' });
                    setEditingAcademic(false);
                  } catch (err) {
                    logger.error('[ConfiguracoesPage] Error saving academic profile:', err);
                    toast({
                      title: 'Erro ao salvar',
                      description: 'Tente novamente em instantes.',
                      variant: 'destructive',
                    });
                  } finally {
                    setSavingAcademic(false);
                  }
                }}
              />
            </PremiumCard>
          ) : (
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
          )}
        </>
      )}
    </PageTransition>
  );
}
