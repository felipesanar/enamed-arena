import { PremiumSidebar } from "@/components/premium/PremiumSidebar";
import { DashboardOutlet } from "@/components/premium/DashboardOutlet";
import { MobileDashboardHeader } from "@/components/premium/MobileDashboardHeader";
import { MobileBottomNav } from "@/components/premium/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const { profile } = useUser();
  const isGuestMobile =
    isMobile && (profile?.segment ?? "guest") === "guest";

  return (
    <div className="flex min-h-screen w-full bg-[radial-gradient(120%_100%_at_80%_0%,rgba(142,31,61,0.07)_0%,rgba(142,31,61,0)_35%),radial-gradient(80%_60%_at_0%_100%,rgba(142,31,61,0.04)_0%,transparent_50%),#F4F1F3]">
      {!isMobile && (
        <div className="flex w-[292px] shrink-0 flex-col fixed inset-y-0 z-40">
          <PremiumSidebar />
        </div>
      )}

      {isMobile && (
        <>
          <MobileDashboardHeader />
          <MobileBottomNav />
        </>
      )}

      <div className="flex flex-1 flex-col min-w-0 md:pl-[292px]">
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
