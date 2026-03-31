import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, Command } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PremiumSidebar } from "@/components/premium/PremiumSidebar";
import { TopUtilityBar } from "@/components/premium/TopUtilityBar";
import { CommandPalette } from "@/components/CommandPalette";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";


export function DashboardLayout() {
  const location = useLocation();
  const sectionLabel = ROUTE_LABELS[location.pathname] ?? "";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const sidebarContent = <PremiumSidebar />;

  return (
    <div className="flex min-h-screen w-full bg-[#F7F5F7]">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-[280px] md:shrink-0 md:flex-col md:fixed md:inset-y-0 md:z-40">
        {sidebarContent}
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[280px] max-w-[85vw] p-0 border-0 bg-[#07111F] bg-[linear-gradient(180deg,#07111F_0%,#091427_50%,#0B1630_100%)] shadow-[2px_0_24px_rgba(0,0,0,0.2)]"
        >
          <div className="h-full overflow-y-auto">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 md:pl-[280px]">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[#E8E1E5] bg-[#FCFAFB]/95 backdrop-blur-sm px-4 md:px-8">
          {isMobile && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#5F6778] hover:bg-[#F3ECEF] hover:text-[#1A2233] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(142,31,61,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5F7]"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#E8E1E5] bg-[#FCFAFB] px-2.5 py-1.5 text-[12px] text-[#5F6778] hover:bg-[#F3ECEF] hover:text-[#1A2233] hover:border-[#E8E1E5] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(142,31,61,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5F7]"
            title="Atalhos (⌘K)"
          >
            <Command className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">⌘K</span>
          </button>
          <TopUtilityBar className="ml-auto" />
        </div>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-8">
          <div className={cn("mx-auto max-w-[1280px]")}>
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
