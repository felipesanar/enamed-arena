import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ExternalLink,
  ArrowRight,
  CalendarDays,
  Stethoscope,
  Trophy,
} from "lucide-react";
import { BrandIcon } from "@/components/brand/BrandMark";
import { useUser } from "@/contexts/UserContext";
import { useSimulados } from "@/hooks/useSimulados";
import {
  type BannerScenario,
  deriveScenario,
  notificationBellDotVisible,
} from "@/lib/simuladoBannerScenario";
import { trackEvent } from "@/lib/analytics";
import { SANARFLIX_PRO_ENAMED_URL } from "@/lib/sanarflix";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MobileDashboardHeaderProps {
  className?: string;
}

export function MobileDashboardHeader({
  className,
}: MobileDashboardHeaderProps) {
  const navigate = useNavigate();
  const { profile, isOnboardingComplete } = useUser();
  const isGuest = (profile?.segment ?? "guest") === "guest";
  const { simulados, loading } = useSimulados();
  const initial = profile?.name?.[0]?.toUpperCase() || "U";
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const scenario = loading
    ? { type: "no_upcoming" as const }
    : deriveScenario(simulados);
  const showDot = notificationBellDotVisible(scenario);
  const notificationHub = useMemo(() => getNotificationHubContent(scenario), [scenario]);

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 14);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top,0px)]",
        className
      )}
      role="banner"
    >
      {/* Superfície do header: compacta ao scroll com sombra/raio refinados */}
      <div
        className={cn(
          "mx-2 overflow-hidden border border-[#E5DEE3]/90 bg-[#F4F1F3]/94 backdrop-blur-lg transition-all duration-300",
          isCompact
            ? "rounded-b-xl shadow-[0_8px_22px_-16px_rgba(26,34,51,0.25)]"
            : "rounded-b-2xl shadow-[0_10px_26px_-18px_rgba(26,34,51,0.18)]"
        )}
      >
        <div
          className={cn(
            "flex w-full items-center justify-between gap-3 px-4 transition-all duration-300",
            isCompact ? "h-[50px]" : "h-14"
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <Link
            to="/"
            className="group flex w-fit max-w-full items-center gap-3 rounded-2xl py-0.5 pr-2 no-underline outline-none focus-visible:ring-2 focus-visible:ring-[rgba(142,31,61,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F1F3]"
            aria-label="Início"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/12 bg-[linear-gradient(145deg,rgba(253,240,244,0.95)_0%,rgba(245,228,234,0.85)_100%)] shadow-[0_2px_10px_-4px_rgba(142,31,61,0.18),inset_0_1px_0_rgba(255,255,255,0.65)]"
              aria-hidden
            >
              <Stethoscope className="h-[19px] w-[19px] text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 text-left">
              <span className="block text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-muted-foreground/90">
                SANARFLIX
              </span>
              <span className="mt-0.5 block truncate text-[14px] font-bold leading-tight tracking-[-0.02em] text-foreground">
                PRO: ENAMED
              </span>
            </div>
          </Link>

          {!isOnboardingComplete && (
            <Link
              to="/onboarding"
              className="w-fit max-w-full truncate pl-[52px] text-[10px] font-semibold leading-none text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Completar perfil
            </Link>
          )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(true);
                trackEvent("ranking_viewed", { source: "mobile_header_bell" });
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E8E1E5]/90 bg-white text-primary shadow-[0_1px_3px_rgba(26,34,51,0.06)] transition-colors hover:bg-[#FAF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(142,31,61,0.24)] focus-visible:ring-offset-2"
              aria-label="Abrir central de notificações"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              {showDot && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E83862] ring-2 ring-white" />
              )}
            </button>

            <Link
              to="/configuracoes"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/14 bg-[linear-gradient(145deg,rgba(253,240,244,0.95)_0%,rgba(245,228,234,0.75)_100%)] text-[13px] font-bold text-primary shadow-[0_2px_8px_-4px_rgba(142,31,61,0.2)] transition-colors hover:border-primary/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Conta e configurações"
            >
              {initial}
            </Link>
          </div>
        </div>

        {isGuest && (
          <div className="border-t border-primary/10 bg-[linear-gradient(90deg,rgba(142,31,61,0.08)_0%,rgba(142,31,61,0.04)_50%,rgba(142,31,61,0.07)_100%)] px-4 pb-2 pt-1.5">
            <a
              href={SANARFLIX_PRO_ENAMED_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                trackEvent("upsell_clicked", {
                  source: "mobile_header_guest",
                  ctaTo: SANARFLIX_PRO_ENAMED_URL,
                })
              }
              className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-center text-[11px] font-bold leading-tight text-primary-foreground shadow-[0_4px_14px_-6px_hsl(345_65%_30%/0.55)] transition-[transform,filter] hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-xs"
            >
              <span className="line-clamp-2">
                Acessar o Sanarflix PRO ENAMED
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            </a>
          </div>
        )}
      </div>

      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent
          side="top"
          className="rounded-b-2xl border-b border-[#E5DEE3]/90 bg-[#F4F1F3]/98 px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] shadow-[0_18px_36px_-24px_rgba(26,34,51,0.25)]"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">Central de notificações</SheetTitle>
            <SheetDescription>{notificationHub.description}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(false);
                navigate(notificationHub.primaryHref);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-primary/18 bg-primary/[0.08] px-3 py-3 text-left transition-colors hover:bg-primary/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">{notificationHub.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{notificationHub.subtitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            </button>

            <div className="grid grid-cols-2 gap-2">
              <HubLink
                onClick={() => {
                  setNotificationsOpen(false);
                  navigate("/simulados");
                }}
                icon={CalendarDays}
                label="Simulados"
              />
              <HubLink
                onClick={() => {
                  setNotificationsOpen(false);
                  navigate("/ranking");
                }}
                icon={Trophy}
                label="Ranking"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function HubLink({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: React.ComponentType<any>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-[#E8E1E5]/85 bg-white/80 px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      {label}
    </button>
  );
}

function getNotificationHubContent(scenario: BannerScenario): {
  title: string;
  subtitle: string;
  description: string;
  primaryHref: string;
} {
  if (scenario.type === "open_not_done") {
    return {
      title: "Janela aberta agora",
      subtitle: scenario.title,
      description: "Você tem uma ação importante para esta janela de simulado.",
      primaryHref: `/simulados/${scenario.simuladoId}`,
    };
  }

  if (scenario.type === "after_done") {
    return {
      title: "Resultado disponível",
      subtitle: scenario.title,
      description: "Seu resultado já pode ser conferido.",
      primaryHref: `/simulados/${scenario.simuladoId}/resultado`,
    };
  }

  if (scenario.type === "open_done_waiting") {
    return {
      title: "Resultado em breve",
      subtitle: `Liberação prevista para ${formatDateShort(scenario.resultsAt)}`,
      description: "Você concluiu o simulado e o resultado será liberado em breve.",
      primaryHref: "/simulados",
    };
  }

  if (scenario.type === "before_window") {
    return {
      title: "Próxima janela programada",
      subtitle: `${formatDateShort(scenario.start)} a ${formatDateShort(scenario.end)}`,
      description: "Planeje sua participação para entrar no ranking nacional.",
      primaryHref: "/simulados",
    };
  }

  return {
    title: "Sem alertas no momento",
    subtitle: "Nenhuma notificação pendente",
    description: "Acompanhe novos simulados e atualizações por aqui.",
    primaryHref: "/simulados",
  };
}

function formatDateShort(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}
