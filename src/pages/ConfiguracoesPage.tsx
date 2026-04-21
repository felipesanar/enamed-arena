import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Shield,
  User,
  Mail,
  GraduationCap,
  Building2,
  Edit3,
  LogOut,
  SlidersHorizontal,
  LifeBuoy,
  MessageCircle,
  HelpCircle,
  Lock,
  ExternalLink,
  Calendar,
  Check,
  AlertTriangle,
} from "lucide-react";

import { PageTransition } from "@/components/premium/PageTransition";
import { AcademicProfileEditor } from "@/components/profile/AcademicProfileEditor";
import { SettingsHero } from "@/components/settings/SettingsHero";
import { SettingsNav, type SettingsNavSection } from "@/components/settings/SettingsNav";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCardGroup, SettingsRow } from "@/components/settings/SettingsRow";
import { PlanBillboard } from "@/components/settings/PlanBillboard";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { LogoutConfirm } from "@/components/settings/LogoutConfirm";
import { InlineNameEdit } from "@/components/settings/InlineNameEdit";
import { CopyableText } from "@/components/settings/CopyableText";
import { InstitutionChip } from "@/components/settings/InstitutionChip";

import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/contexts/AuthContext";
import { SEGMENT_LABELS } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

const NAV_SECTIONS: SettingsNavSection[] = [
  { id: "conta", label: "Conta", description: "Dados pessoais", icon: User },
  { id: "plano", label: "Plano", description: "Assinatura e benefícios", icon: Shield },
  {
    id: "perfil-academico",
    label: "Perfil acadêmico",
    description: "Especialidade e instituições",
    icon: GraduationCap,
  },
  {
    id: "preferencias",
    label: "Preferências",
    description: "Aparência",
    icon: SlidersHorizontal,
  },
  { id: "suporte", label: "Ajuda & suporte", description: "Canais de contato", icon: LifeBuoy },
  { id: "sessao", label: "Sessão", description: "Encerrar acesso", icon: LogOut },
];

const HELP_LINKS = [
  {
    icon: HelpCircle,
    label: "Central de ajuda",
    description: "Respostas rápidas sobre simulados, plano e correção.",
    href: "https://sanarflix.com.br/central-ajuda",
  },
  {
    icon: MessageCircle,
    label: "Falar com a equipe SanarFlix",
    description: "Atendimento em dias úteis — respondemos em até 1 dia.",
    href: "https://sanarflix.com.br/contato",
  },
];

export default function ConfiguracoesPage() {
  const reduced = useReducedMotion();
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
  const segment = profile?.segment ?? "guest";

  const [editingAcademic, setEditingAcademic] = useState(false);
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("conta");

  const navSections = useMemo(
    () =>
      NAV_SECTIONS.filter(
        (s) => s.id !== "perfil-academico" || (isOnboardingComplete && !!onboarding),
      ),
    [isOnboardingComplete, onboarding],
  );

  // Saneamento: se a aba ativa não existe mais (ex.: perfil-academico filtrado), volta para conta.
  useEffect(() => {
    if (!navSections.some((s) => s.id === activeSection)) {
      setActiveSection("conta");
    }
  }, [navSections, activeSection]);

  const memberSinceLabel = useMemo(() => {
    const iso =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (authUser as any)?.created_at ?? (profile as any)?.createdAt;
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [authUser, profile]);

  const handleSaveName = async (nextName: string) => {
    if (!authUser) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: nextName })
      .eq("id", authUser.id);
    if (error) {
      logger.error("[ConfiguracoesPage] Error saving name:", error);
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
      throw error;
    }
    toast({ title: "Nome atualizado com sucesso." });
    refreshProfile?.();
  };

  const nextEditableFormatted = onboardingNextEditableAt
    ? new Date(onboardingNextEditableAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <PageTransition>
      {/* HERO */}
      <SettingsHero
        name={profile?.name || ""}
        email={authUser?.email || ""}
        segment={segment}
        specialty={onboarding?.specialty}
        institutionsCount={onboarding?.targetInstitutions?.length}
        avatarUrl={profile?.avatarUrl}
      />

      {/* 2-col shell: sidebar + stack */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 lg:gap-10">
        <SettingsNav
          sections={navSections}
          activeId={activeSection}
          onSelect={setActiveSection}
        />

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
          {/* === CONTA === */}
          {activeSection === "conta" && authUser && (
            <SettingsSection
              id="conta"
              title="Conta"
              description="Dados pessoais usados em simulados, correções e ranking."
            >
              <SettingsCardGroup>
                <SettingsRow
                  icon={User}
                  label="Nome completo"
                  description="Exibido no ranking e nos resultados oficiais."
                  value={
                    <InlineNameEdit
                      value={profile?.name || ""}
                      onSave={handleSaveName}
                      emptyLabel="Adicionar nome"
                    />
                  }
                />
                <SettingsRow
                  icon={Mail}
                  label="E-mail"
                  description="Usado para login e comunicações importantes."
                  value={
                    <CopyableText
                      value={authUser.email || ""}
                      label="Copiar e-mail"
                    />
                  }
                  action={
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (authUser as any)?.email_confirmed_at ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-micro-label font-bold uppercase tracking-wider ring-1 ring-success/20">
                        <Check className="h-2.5 w-2.5" aria-hidden="true" />
                        Verificado
                      </span>
                    ) : null
                  }
                />
                <SettingsRow
                  icon={Calendar}
                  label="Membro desde"
                  value={
                    <span className="capitalize text-muted-foreground">
                      {memberSinceLabel ?? "—"}
                    </span>
                  }
                  divider={false}
                />
              </SettingsCardGroup>
            </SettingsSection>
          )}

          {/* === PLANO === */}
          {activeSection === "plano" && (
          <SettingsSection
            id="plano"
            title="Plano & benefícios"
            description={
              segment === "pro"
                ? "Você tem acesso completo à plataforma ENAMED."
                : "Veja o que você tem e o que pode desbloquear com o PRO."
            }
            badge={
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-micro-label font-bold uppercase tracking-wider ring-1",
                  segment === "pro"
                    ? "bg-primary/10 text-primary ring-primary/20"
                    : "bg-muted text-muted-foreground ring-border",
                )}
              >
                {SEGMENT_LABELS[segment]}
              </span>
            }
          >
            <PlanBillboard segment={segment} />
          </SettingsSection>
          )}

          {/* === PERFIL ACADÊMICO === */}
          {activeSection === "perfil-academico" && isOnboardingComplete && onboarding && (
            <SettingsSection
              id="perfil-academico"
              title="Perfil acadêmico"
              description="Direciona o ranking comparativo e os insights de desempenho."
              action={
                !editingAcademic && !onboardingEditLocked ? (
                  <button
                    onClick={() => setEditingAcademic(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-body-sm font-semibold text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Editar
                  </button>
                ) : undefined
              }
              badge={
                onboardingEditLocked && !editingAcademic ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-micro-label font-bold uppercase tracking-wider ring-1 ring-warning/20">
                    <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                    Bloqueado
                  </span>
                ) : null
              }
            >
              {onboardingEditLocked && !editingAcademic && (
                <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3 text-body-sm text-foreground">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 text-warning shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold">Edição bloqueada durante janela ativa</p>
                    <p className="text-muted-foreground mt-0.5">
                      Preservamos seu perfil enquanto um simulado oficial está em
                      andamento.{" "}
                      {nextEditableFormatted && (
                        <>
                          Você poderá editar novamente a partir de{" "}
                          <span className="font-semibold text-foreground">
                            {nextEditableFormatted}
                          </span>
                          .
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {editingAcademic ? (
                <div className="rounded-2xl border border-border/80 bg-card p-5 md:p-6 shadow-[0_1px_2px_rgba(20,20,30,0.03),0_8px_24px_-12px_rgba(20,20,30,0.06)]">
                  <AcademicProfileEditor
                    initialSpecialty={onboarding.specialty}
                    initialInstitutions={onboarding.targetInstitutions}
                    saving={savingAcademic}
                    onCancel={() => setEditingAcademic(false)}
                    onSave={async (data) => {
                      setSavingAcademic(true);
                      try {
                        await saveOnboarding(data);
                        toast({ title: "Perfil acadêmico atualizado!" });
                        setEditingAcademic(false);
                      } catch (err) {
                        logger.error(
                          "[ConfiguracoesPage] Error saving academic profile:",
                          err,
                        );
                        toast({
                          title: "Erro ao salvar",
                          description: "Tente novamente em instantes.",
                          variant: "destructive",
                        });
                      } finally {
                        setSavingAcademic(false);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Especialidade */}
                  <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_rgba(20,20,30,0.03),0_8px_24px_-12px_rgba(20,20,30,0.06)]">
                    <div className="flex items-center gap-2.5 mb-3">
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary"
                      >
                        <GraduationCap className="h-4 w-4" />
                      </span>
                      <p className="text-overline uppercase text-muted-foreground font-bold tracking-wider">
                        Especialidade
                      </p>
                    </div>
                    <p className="text-heading-3 text-foreground leading-snug">
                      {onboarding.specialty}
                    </p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      Define sua trilha recomendada e relatórios por área.
                    </p>
                  </div>

                  {/* Instituições */}
                  <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_rgba(20,20,30,0.03),0_8px_24px_-12px_rgba(20,20,30,0.06)]">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary"
                        >
                          <Building2 className="h-4 w-4" />
                        </span>
                        <p className="text-overline uppercase text-muted-foreground font-bold tracking-wider">
                          Instituições alvo
                        </p>
                      </div>
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {onboarding.targetInstitutions.length}{" "}
                        {onboarding.targetInstitutions.length === 1
                          ? "selecionada"
                          : "selecionadas"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {onboarding.targetInstitutions.length > 0 ? (
                        onboarding.targetInstitutions.map((inst) => (
                          <InstitutionChip key={inst} name={inst} />
                        ))
                      ) : (
                        <p className="text-body-sm text-muted-foreground italic">
                          Nenhuma instituição selecionada.
                        </p>
                      )}
                    </div>
                    <p className="mt-3 text-caption text-muted-foreground">
                      Comparamos seu desempenho com outros candidatos dessas
                      instituições.
                    </p>
                  </div>
                </div>
              )}
            </SettingsSection>
          )}

          {/* === PREFERÊNCIAS === */}
          {activeSection === "preferencias" && (
          <SettingsSection
            id="preferencias"
            title="Preferências"
            description="Tema da interface."
          >
            <PreferencesSection />
          </SettingsSection>
          )}

          {/* === SUPORTE === */}
          {activeSection === "suporte" && (
          <SettingsSection
            id="suporte"
            title="Ajuda & suporte"
            description="Está com dúvida? Nosso time médico-acadêmico te responde."
          >
            <SettingsCardGroup>
              {HELP_LINKS.map((link, idx) => {
                const Icon = link.icon;
                return (
                  <SettingsRow
                    key={link.href}
                    icon={Icon}
                    label={link.label}
                    description={link.description}
                    divider={idx < HELP_LINKS.length - 1}
                    action={
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={link.label}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-body-sm font-semibold text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        Abrir
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    }
                  />
                );
              })}
            </SettingsCardGroup>
          </SettingsSection>
          )}

          {/* === SESSÃO === */}
          {activeSection === "sessao" && authUser && (
            <SettingsSection
              id="sessao"
              title="Sessão"
              description="Encerre o acesso neste dispositivo."
            >
              <SettingsCardGroup>
                <SettingsRow
                  icon={LogOut}
                  tone="danger"
                  label="Sair da conta"
                  description="Você precisará fazer login novamente para voltar."
                  divider={false}
                  action={
                    <LogoutConfirm onConfirm={signOut}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-background px-3 py-2 text-body-sm font-semibold text-destructive hover:bg-destructive/10 hover:border-destructive/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                        Sair
                      </button>
                    </LogoutConfirm>
                  }
                />
              </SettingsCardGroup>
            </SettingsSection>
          )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
