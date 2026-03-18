import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { Menu, Command } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { SEGMENT_LABELS } from "@/types";
import { Link } from "react-router-dom";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const { profile, isOnboardingComplete } = useUser();
  const segment = profile?.segment ?? 'guest';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 px-4 md:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="ml-2 flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-caption text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              title="Atalhos (⌘K)"
            >
              <Command className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">⌘K</span>
            </button>

            <div className="ml-auto flex items-center gap-3">
              {!isOnboardingComplete && (
                <Link
                  to="/onboarding"
                  className="text-caption font-semibold text-primary hover:text-wine-hover transition-colors"
                >
                  Completar perfil
                </Link>
              )}
              <span className="text-caption text-muted-foreground hidden sm:inline">
                {SEGMENT_LABELS[segment]}
              </span>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/10">
                <span className="text-caption font-bold text-primary">
                  {profile?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  );
}