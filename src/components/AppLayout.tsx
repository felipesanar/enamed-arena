import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { SEGMENT_LABELS } from "@/types";
import { Link } from "react-router-dom";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, isOnboardingComplete } = useUser();
  const segment = profile?.segment ?? 'guest';

  console.log('[AppLayout] Rendering, segment:', segment, 'onboarding:', isOnboardingComplete);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 px-4 md:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>

            <div className="ml-auto flex items-center gap-3">
              {!isOnboardingComplete && (
                <Link
                  to="/onboarding"
                  className="text-caption font-medium text-primary hover:text-wine-hover transition-colors"
                >
                  Completar perfil
                </Link>
              )}
              <span className="text-caption text-muted-foreground hidden sm:inline">
                {SEGMENT_LABELS[segment]}
              </span>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-caption font-bold text-primary">
                  {profile?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
