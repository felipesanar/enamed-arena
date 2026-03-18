import { 
  LayoutDashboard, 
  Calendar, 
  Trophy, 
  BarChart3, 
  BookOpen, 
  Settings,
  GraduationCap,
  Sparkles,
  GitCompareArrows,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Início", url: "/", icon: LayoutDashboard },
  { title: "Simulados", url: "/simulados", icon: Calendar },
  { title: "Desempenho", url: "/desempenho", icon: BarChart3 },
  { title: "Ranking", url: "/ranking", icon: Trophy },
  { title: "Comparativo", url: "/comparativo", icon: GitCompareArrows },
];

const proNav = [
  { title: "Caderno de Erros", url: "/caderno-erros", icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const { profile } = useUser();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary shrink-0">
            <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col animate-fade-in">
              <span className="text-[10px] uppercase text-sidebar-muted tracking-[0.12em] font-semibold">
                sanarflix
              </span>
              <span className="text-body font-bold text-sidebar-accent-foreground -mt-0.5">
                PRO: ENAMED
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-overline uppercase text-sidebar-muted px-3 mb-1">
              Navegação
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="min-h-[44px] h-11">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 rounded-lg text-body text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-[3px] border-l-sidebar-primary pl-[9px] -ml-px"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          {!collapsed && (
            <SidebarGroupLabel className="text-overline uppercase text-sidebar-muted px-3 mb-1">
              <Sparkles className="h-3 w-3 inline mr-1.5" />
              PRO Exclusivo
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {proNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="min-h-[44px] h-11">
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 rounded-lg text-body text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-[3px] border-l-sidebar-primary pl-[9px] -ml-px"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          {item.title}
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-sidebar-primary/20 text-sidebar-primary px-1.5 py-0.5 rounded">
                            PRO
                          </span>
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="min-h-[44px] h-11">
              <NavLink
                to="/configuracoes"
                className="flex items-center gap-3 px-3 rounded-lg text-body text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-[3px] border-l-sidebar-primary pl-[9px] -ml-px"
              >
                <Settings className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {!collapsed && <span>Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* User info + Logout */}
          {!collapsed && profile && (
            <div className="mt-2 px-3 py-2 border-t border-sidebar-border">
              <p className="text-caption text-sidebar-muted truncate mb-1">
                {profile.email || profile.name || 'Usuário'}
              </p>
            </div>
          )}

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="min-h-[44px] h-11 flex items-center gap-3 px-3 rounded-lg text-body text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
