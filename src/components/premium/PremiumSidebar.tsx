import { SidebarBrandBlock } from "@/components/premium/sidebar/SidebarBrandBlock";
import { SidebarNavSection } from "@/components/premium/sidebar/SidebarNavSection";
import { SidebarProSection } from "@/components/premium/sidebar/SidebarProSection";
import { SidebarFooterAccount } from "@/components/premium/sidebar/SidebarFooterAccount";

const SIDEBAR_WIDTH = 280;

export function PremiumSidebar() {
  return (
    <aside
      className="flex h-screen w-full max-w-[280px] flex-col overflow-hidden border-r border-white/[0.06] bg-[#07111F] bg-[linear-gradient(180deg,#07111F_0%,#091427_50%,#0B1630_100%)] shadow-[2px_0_24px_rgba(0,0,0,0.15)]"
      style={{ width: SIDEBAR_WIDTH }}
      aria-label="Navegação principal"
    >
      <div className="flex h-full flex-col px-4 py-4 [@media(max-height:820px)]:px-3.5 [@media(max-height:820px)]:py-3.5 [@media(max-height:700px)]:px-3 [@media(max-height:700px)]:py-3">
        <div className="shrink-0 border-b border-white/[0.06] pb-3 [@media(max-height:700px)]:pb-2.5">
          <SidebarBrandBlock />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 [@media(max-height:700px)]:gap-2.5 [@media(max-height:700px)]:pt-2.5">
          <SidebarNavSection />
          <div className="border-t border-white/[0.05] pt-2.5 [@media(max-height:700px)]:pt-2">
            <SidebarProSection />
          </div>
        </div>
        <div className="mt-auto border-t border-white/[0.06] pt-3 [@media(max-height:700px)]:pt-2.5">
          <SidebarFooterAccount />
        </div>
      </div>
    </aside>
  );
}
