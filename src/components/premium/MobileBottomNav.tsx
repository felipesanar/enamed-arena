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

const DIRECT_ITEMS = [
  { to: "/", end: true, label: "Início", icon: LayoutDashboard },
  { to: "/simulados", end: false, label: "Simulados", icon: Calendar },
  { to: "/desempenho", end: false, label: "Desempenho", icon: BarChart3 },
  { to: "/caderno-erros", end: false, label: "Erros", icon: BookOpen },
] as const;

const ICON_STROKE = 1.75;

function NavIconButton({
  to,
  end,
  label,
  icon: Icon,
  className,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: ComponentType<any>;
  className?: string;
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
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
              isActive
                ? "border border-primary/45 bg-primary/[0.12] text-primary shadow-[0_0_0_1px_rgba(232,56,98,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]"
                : "border border-transparent bg-transparent"
            )}
          >
            <Icon strokeWidth={ICON_STROKE} className="h-[18px] w-[18px] shrink-0" aria-hidden />
          </span>
          <span className="max-w-full truncate text-center">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function MobileBottomNav() {
  const location = useLocation();
  const [rankingOpen, setRankingOpen] = useState(false);

  const rankingActive =
    location.pathname === "/ranking" || location.pathname === "/comparativo";

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/10 bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_-6px_rgba(0,0,0,0.1)] md:hidden"
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
                "group flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121827] sm:text-[11px]",
                rankingActive
                  ? "text-primary"
                  : "text-[#D3D9E4] hover:text-white"
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
              <span className="max-w-full truncate text-center">Ranking</span>
            </button>

            <NavIconButton
              to={DIRECT_ITEMS[3].to}
              end={DIRECT_ITEMS[3].end}
              label={DIRECT_ITEMS[3].label}
              icon={DIRECT_ITEMS[3].icon}
            />
        </div>
      </nav>

      <Sheet open={rankingOpen} onOpenChange={setRankingOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[24px] border border-white/10 bg-[linear-gradient(180deg,#161a24_0%,#0c0e14_100%)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-zinc-100 shadow-[0_-24px_60px_-16px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <SheetHeader className="space-y-1 pb-2 text-left">
            <SheetTitle className="text-base font-semibold text-white">
              Ranking e comparativo
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Escolha onde deseja ir
            </SheetDescription>
          </SheetHeader>
          <div className="mt-2 flex flex-col gap-2">
            <Link
              to="/ranking"
              onClick={() => setRankingOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 no-underline"
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
              className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 no-underline"
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
