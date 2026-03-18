import { useUser } from "@/contexts/UserContext";
import { SidebarBrandBlock } from "@/components/premium/sidebar/SidebarBrandBlock";
import { SidebarContextCard } from "@/components/premium/sidebar/SidebarContextCard";
import { SidebarNavSection } from "@/components/premium/sidebar/SidebarNavSection";
import { SidebarProSection } from "@/components/premium/sidebar/SidebarProSection";
import { SidebarFooterAccount } from "@/components/premium/sidebar/SidebarFooterAccount";

const SIDEBAR_WIDTH = 280;

export function PremiumSidebar() {
  const { profile } = useUser();
  const completed =
    profile && "simuladosCompleted" in profile
      ? (profile as { simuladosCompleted?: number }).simuladosCompleted
      : undefined;
  const simuladosRealizados = completed ?? 1;
  const mediaAtual = 10;
  const proximoPasso = "revisar erros";

  return (
    <aside
      className="flex h-full w-full max-w-[280px] flex-col border-r border-white/[0.06] bg-[#07111F] bg-[linear-gradient(180deg,#07111F_0%,#091427_50%,#0B1630_100%)] shadow-[2px_0_24px_rgba(0,0,0,0.15)]"
      style={{ width: SIDEBAR_WIDTH }}
      aria-label="Navegação principal"
    >
      <div className="flex flex-1 flex-col overflow-y-auto p-5">
        <div className="mb-8">
          <SidebarBrandBlock />
        </div>
        <div className="mb-8">
          <SidebarContextCard
            simuladosRealizados={simuladosRealizados}
            mediaAtual={mediaAtual}
            proximoPasso={proximoPasso}
          />
        </div>
        <div className="mb-8">
          <SidebarNavSection />
        </div>
        <div className="mb-8">
          <SidebarProSection />
        </div>
        <SidebarFooterAccount />
      </div>
    </aside>
  );
}
