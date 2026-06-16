import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PremiumSidebar, PREMIUM_SIDEBAR_COLLAPSED_W, PREMIUM_SIDEBAR_EXPANDED_W } from "@/components/premium/PremiumSidebar";
import { DashboardOutlet } from "@/components/premium/DashboardOutlet";
import { MobileBottomNav } from "@/components/premium/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "enamed-premium-sidebar-collapsed";

// Alturas dos componentes mobile — manter sincronizado com MobileBottomNav
const MOBILE_BOTTOM_NAV_H = '5.75rem'; // MobileBottomNav
const MOBILE_UPSELL_BAR_H = '2.5rem';  // Barra fina de upsell (somente visitante)

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DashboardLayout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { profile } = useUser();
  const isExamRoute = useMemo(
    () => /^\/simulados\/[^/]+\/prova(?:\/|$)/.test(location.pathname),
    [location.pathname]
  );

  // Auto-collapse sidebar when entering simulado detail / arena pages
  const isArenaRoute = useMemo(
    () => /^\/simulados\/[^/]+(?:\/start)?(?:\/|$)/.test(location.pathname) && !isExamRoute,
    [location.pathname, isExamRoute]
  );
  // Rotas que devem ocupar toda a área útil (sem padding lateral do <main>).
  // /comparativo NÃO entra mais aqui — usa o layout-padrão das demais páginas
  // do dashboard (px-4 md:px-8 py-6 md:py-8).
  const isFullBleedRoute = useMemo(
    () => false,
    []
  );
  useEffect(() => {
    if (isArenaRoute && !isMobile) {
      setSidebarCollapsed(true);
    }
  }, [isArenaRoute, isMobile]);
  const isGuestMobile =
    isMobile && (profile?.segment ?? "guest") === "guest";

  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  return (
    <div className="dashboard-page-bg flex min-h-screen w-full">
      {!isMobile && !isExamRoute && (
        <div
          className={cn(
            "fixed inset-y-0 z-40 flex shrink-0 flex-col overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            sidebarCollapsed ? "w-[80px]" : "w-[292px]",
          )}
          style={{
            width: sidebarCollapsed ? PREMIUM_SIDEBAR_COLLAPSED_W : PREMIUM_SIDEBAR_EXPANDED_W,
          }}
        >
          <PremiumSidebar
            collapsed={sidebarCollapsed}
            onCollapse={() => setSidebarCollapsed(true)}
            onExpand={() => setSidebarCollapsed(false)}
          />
        </div>
      )}

      {isMobile && !isExamRoute && <MobileBottomNav />}

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding-left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          isExamRoute && "md:pl-0",
          !isExamRoute && !isMobile && sidebarCollapsed && "md:pl-[80px]",
          !isExamRoute && !isMobile && !sidebarCollapsed && "md:pl-[292px]",
        )}
      >
        <main
          className={cn(
            "flex-1",
            isExamRoute ? "p-0 overflow-hidden" : (isArenaRoute || isFullBleedRoute) ? "p-0" : "px-4 md:px-8 py-6 md:py-8",
            isMobile &&
              !isExamRoute &&
              !isArenaRoute &&
              !isFullBleedRoute &&
              cn(
                // Sem header: apenas a status bar + um respiro
                "pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]",
                isGuestMobile
                  // MOBILE_BOTTOM_NAV_H + barra de upsell + safe-area bottom
                  ? "pb-[calc(5.75rem+2.5rem+max(0.75rem,env(safe-area-inset-bottom,0px)))]"
                  // MOBILE_BOTTOM_NAV_H + safe-area bottom
                  : "pb-[calc(5.75rem+max(0.75rem,env(safe-area-inset-bottom,0px)))]"
              )
          )}
        >
          <DashboardOutlet />
        </main>
      </div>
    </div>
  );
}
