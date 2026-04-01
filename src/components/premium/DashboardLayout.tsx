import { useEffect, useState } from "react";
import { PremiumSidebar, PREMIUM_SIDEBAR_COLLAPSED_W, PREMIUM_SIDEBAR_EXPANDED_W } from "@/components/premium/PremiumSidebar";
import { DashboardOutlet } from "@/components/premium/DashboardOutlet";
import { MobileDashboardHeader } from "@/components/premium/MobileDashboardHeader";
import { MobileBottomNav } from "@/components/premium/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "enamed-premium-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const { profile } = useUser();
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
    <div className="flex min-h-screen w-full bg-[radial-gradient(120%_100%_at_80%_0%,rgba(142,31,61,0.07)_0%,rgba(142,31,61,0)_35%),radial-gradient(80%_60%_at_0%_100%,rgba(142,31,61,0.04)_0%,transparent_50%),#F4F1F3]">
      {!isMobile && (
        <div
          className={cn(
            "fixed inset-y-0 z-40 flex shrink-0 flex-col overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            sidebarCollapsed ? "w-[72px]" : "w-[292px]",
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

      {isMobile && (
        <>
          <MobileDashboardHeader />
          <MobileBottomNav />
        </>
      )}

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding-left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          !isMobile && sidebarCollapsed && "md:pl-[72px]",
          !isMobile && !sidebarCollapsed && "md:pl-[292px]",
        )}
      >
        <main
          className={cn(
            "flex-1 px-4 md:px-8 py-6 md:py-8",
            isMobile &&
              cn(
                isGuestMobile
                  ? "pt-[calc(3.5rem+3.25rem+env(safe-area-inset-top,0px)+0.75rem)]"
                  : "pt-[calc(3.5rem+env(safe-area-inset-top,0px)+0.75rem)]",
                "pb-[calc(5.75rem+max(0.75rem,env(safe-area-inset-bottom,0px)))]"
              )
          )}
        >
          <div className={cn("mx-auto max-w-[1280px]")}>
            <DashboardOutlet />
          </div>
        </main>
      </div>
    </div>
  );
}
