import { useState, type ComponentType } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Trophy,
  BookOpen,
  GitCompareArrows,
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
  const [rankingOpen, setRankingOpen] = useState(false);

  const caderno = useCadernoRoutes();
  const { profile } = useUser();
  const hasCadernoErros = useHasAccess("cadernoErros");
  const { data: dueCount } = useNotebookDueCount(
    profile?.id,
    hasCadernoErros && caderno.v2
  );

  const rankingActive =
    location.pathname === "/ranking" || location.pathname === "/comparativo";

  return (
    <>
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
    </>
  );
}
