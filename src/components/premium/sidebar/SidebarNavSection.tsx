import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Trophy,
  GitCompareArrows,
} from "lucide-react";
import { NavItem } from "@/components/premium/NavItem";
import { cn } from "@/lib/utils";

const mainNav = [
  { title: "Início", url: "/", icon: LayoutDashboard },
  { title: "Simulados", url: "/simulados", icon: Calendar },
  { title: "Desempenho", url: "/desempenho", icon: BarChart3 },
  { title: "Ranking", url: "/ranking", icon: Trophy },
  { title: "Comparativo", url: "/comparativo", icon: GitCompareArrows },
];

export function SidebarNavSection({ collapsed }: { collapsed?: boolean }) {
  return (
    <nav
      aria-label="Links principais"
      className={cn(
        "space-y-1.5 [@media(max-height:700px)]:space-y-0.5",
        collapsed && "flex flex-col items-center gap-3 space-y-0",
      )}
    >
      {mainNav.map((item) => (
        <NavItem
          key={item.title}
          to={item.url}
          end={item.url === "/"}
          icon={item.icon}
          label={item.title}
          collapsed={collapsed}
        />
      ))}
    </nav>
  );
}
