import { useMemo, useState, type ComponentType } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Trophy,
  BookOpen,
  GitCompareArrows,
  Bell,
  ArrowRight,
  ExternalLink,
  Settings,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCadernoRoutes } from "@/hooks/useCadernoRoutes";
import { useNotebookDueCount } from "@/hooks/useNotebookDueCount";
import { useUser, useHasAccess } from "@/contexts/UserContext";
import { useSimulados } from "@/hooks/useSimulados";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  deriveScenario,
  notificationBellDotVisible,
  getNotificationHubContent,
} from "@/lib/simuladoBannerScenario";
import { trackEvent } from "@/lib/analytics";
import { SANARFLIX_PRO_ENAMED_URL } from "@/lib/sanarflix";

const DIRECT_ITEMS = [
  { to: "/", end: true, label: "Início", icon: LayoutDashboard },
  { to: "/simulados", end: false, label: "Simulados", icon: Calendar },
  { to: "/desempenho", end: false, label: "Desempenho", icon: BarChart3 },
  { to: "/caderno-erros", end: false, label: "Erros", icon: BookOpen },
] as const;

/** Kept in sync with desktop collapsed rail (`PremiumSidebarRailItem` / `PREMIUM_RAIL_ICON_STROKE`). */
const ICON_STROKE = 1.75;

function NavIconButton({
  to,
  end,
  label,
  icon: Icon,
  className,
  badge,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: ComponentType<any>;
  className?: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:text-[11px]",
          isActive
            ? "text-primary"
            : "text-primary/40 hover:text-primary/70",
          className
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
              isActive
                ? "border border-primary/45 bg-primary/[0.12] text-primary shadow-[0_0_0_1px_rgba(232,56,98,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]"
                : "border border-transparent bg-transparent"
            )}
          >
            <Icon strokeWidth={ICON_STROKE} className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {badge != null && badge > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground"
                aria-label={`${badge} questões para revisar`}
              >
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </span>
          <span className="max-w-[56px] truncate text-center leading-none">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [rankingOpen, setRankingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const caderno = useCadernoRoutes();
  const { profile, isOnboardingComplete } = useUser();
  const hasCadernoErros = useHasAccess("cadernoErros");
  const { data: dueCount } = useNotebookDueCount(
    profile?.id,
    hasCadernoErros && caderno.v2
  );

  const isGuest = (profile?.segment ?? "guest") === "guest";
  const initial = profile?.name?.[0]?.toUpperCase() || "U";
  const { simulados, loading } = useSimulados();
  const scenario = useMemo(
    () => (loading ? { type: "no_upcoming" as const } : deriveScenario(simulados)),
    [loading, simulados],
  );
  const showAccountDot = notificationBellDotVisible(scenario);
  const notificationHub = useMemo(
    () => getNotificationHubContent(scenario),
    [scenario],
  );

  const rankingActive =
    location.pathname === "/ranking" || location.pathname === "/comparativo";
  const accountActive = location.pathname === "/configuracoes";

  return (
    <>
      {isGuest && (
        <a
          href={SANARFLIX_PRO_ENAMED_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            trackEvent("upsell_clicked", {
              source: "mobile_nav_upsell_bar",
              cta_to: SANARFLIX_PRO_ENAMED_URL,
            })
          }
          className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-40 flex min-h-[40px] items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-[12px] font-bold leading-tight !text-white shadow-glow-wine transition-[filter] hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Sparkles className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <span className="truncate">Desbloquear o PRO ENAMED</span>
          <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </a>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/30 bg-card pb-[env(safe-area-inset-bottom,0px)] shadow-sm md:hidden"
        aria-label="Navegação principal"
      >
        <div className="mx-auto flex max-w-[1280px] items-stretch justify-between gap-0.5 px-1 pt-1.5">
            <NavIconButton
              to={DIRECT_ITEMS[0].to}
              end={DIRECT_ITEMS[0].end}
              label={DIRECT_ITEMS[0].label}
              icon={DIRECT_ITEMS[0].icon}
            />
            <NavIconButton
              to={DIRECT_ITEMS[1].to}
              end={DIRECT_ITEMS[1].end}
              label={DIRECT_ITEMS[1].label}
              icon={DIRECT_ITEMS[1].icon}
            />
            <NavIconButton
              to={DIRECT_ITEMS[2].to}
              end={DIRECT_ITEMS[2].end}
              label={DIRECT_ITEMS[2].label}
              icon={DIRECT_ITEMS[2].icon}
            />

            <button
              type="button"
              onClick={() => setRankingOpen(true)}
              className={cn(
                "group flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:text-[11px]",
                rankingActive
                  ? "text-primary"
                  : "text-primary/40 hover:text-primary/70"
              )}
              aria-current={rankingActive ? "page" : undefined}
              aria-label="Ranking e comparativo"
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                  rankingActive
                    ? "border border-primary/45 bg-primary/[0.12] text-primary shadow-[0_0_0_1px_rgba(232,56,98,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "border border-transparent bg-transparent"
                )}
              >
                <Trophy
                  strokeWidth={ICON_STROKE}
                  className="h-[18px] w-[18px] shrink-0"
                  aria-hidden
                />
              </span>
              <span className="max-w-[56px] truncate text-center leading-none">Ranking</span>
            </button>

            <NavIconButton
              to={caderno.base}
              end={DIRECT_ITEMS[3].end}
              label={DIRECT_ITEMS[3].label}
              icon={DIRECT_ITEMS[3].icon}
              badge={dueCount}
            />

            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className={cn(
                "group flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:text-[11px]",
                accountActive
                  ? "text-primary"
                  : "text-primary/40 hover:text-primary/70"
              )}
              aria-label="Conta e notificações"
            >
              <span
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-bold transition-all duration-200",
                  accountActive
                    ? "border border-primary/45 bg-primary/[0.12] text-primary shadow-[0_0_0_1px_rgba(232,56,98,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "border border-primary/14 bg-accent text-primary"
                )}
              >
                {initial}
                {showAccountDot && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </span>
              <span className="max-w-[56px] truncate text-center leading-none">Conta</span>
            </button>
        </div>
      </nav>

      <Sheet open={rankingOpen} onOpenChange={setRankingOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[24px] border-t border-border/30 bg-card px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lg dark:bg-gradient-to-b dark:from-muted dark:to-muted/80"
        >
          <SheetHeader className="space-y-1 pb-2 text-left">
            <SheetTitle className="text-base font-semibold">
              Ranking e comparativo
            </SheetTitle>
            <SheetDescription>
              Escolha onde deseja ir
            </SheetDescription>
          </SheetHeader>
          <div className="mt-2 flex flex-col gap-2">
            <Link
              to="/ranking"
              onClick={() => setRankingOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3.5 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 no-underline"
            >
              <Trophy
                strokeWidth={ICON_STROKE}
                className="h-5 w-5 shrink-0 text-primary"
                aria-hidden
              />
              Ver ranking
            </Link>
            <Link
              to="/comparativo"
              onClick={() => setRankingOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3.5 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 no-underline"
            >
              <GitCompareArrows
                strokeWidth={ICON_STROKE}
                className="h-5 w-5 shrink-0 text-primary"
                aria-hidden
              />
              Comparativo
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={accountOpen} onOpenChange={setAccountOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t border-border/30 bg-card px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lg dark:bg-gradient-to-b dark:from-muted dark:to-muted/80"
        >
          <SheetHeader className="space-y-1 pb-2 text-left">
            <SheetTitle className="text-base font-semibold">Conta</SheetTitle>
            <SheetDescription>Notificações, tema e configurações</SheetDescription>
          </SheetHeader>

          <div className="mt-2 flex flex-col gap-4">
            {isGuest && (
              <a
                href={SANARFLIX_PRO_ENAMED_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  trackEvent("upsell_clicked", {
                    source: "mobile_account_sheet_upsell",
                    cta_to: SANARFLIX_PRO_ENAMED_URL,
                  })
                }
                className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 !text-white shadow-glow-wine transition-[filter] hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring no-underline"
              >
                <Sparkles className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-tight">
                    Desbloqueie o SanarFlix PRO ENAMED
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium leading-snug opacity-90">
                    Caderno de erros, comparativo e muito mais.
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </a>
            )}

            {/* Central de notificações */}
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Notificações
              </p>
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  navigate(notificationHub.primaryHref);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-primary/18 bg-primary/[0.08] px-3 py-3 text-left transition-colors hover:bg-primary/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {notificationHub.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {notificationHub.subtitle}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    navigate("/simulados");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                  Simulados
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    navigate("/ranking");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trophy className="h-4 w-4 text-primary" aria-hidden />
                  Ranking
                </button>
              </div>
            </div>

            {/* Tema + configurações */}
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Preferências
              </p>
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">Tema</span>
                <ThemeToggle variant="icon" />
              </div>
              <Link
                to="/configuracoes"
                onClick={() => setAccountOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 no-underline"
              >
                <Settings strokeWidth={ICON_STROKE} className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                Conta e configurações
              </Link>
              {!isOnboardingComplete && (
                <Link
                  to="/onboarding"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 no-underline"
                >
                  <ArrowRight strokeWidth={ICON_STROKE} className="h-5 w-5 shrink-0" aria-hidden />
                  Completar perfil
                </Link>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
