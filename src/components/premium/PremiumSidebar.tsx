import { memo } from "react";
import { SidebarBrandBlock } from "@/components/premium/sidebar/SidebarBrandBlock";
import { SidebarNavSection } from "@/components/premium/sidebar/SidebarNavSection";
import { SidebarProSection } from "@/components/premium/sidebar/SidebarProSection";
import { SidebarFooterAccount } from "@/components/premium/sidebar/SidebarFooterAccount";

const SIDEBAR_WIDTH = 292;

function PremiumSidebarInner() {
  return (
    <aside
      className="flex h-screen w-full max-w-[292px] flex-col overflow-hidden border-r border-white/[0.05] bg-[#361019] bg-[linear-gradient(180deg,#421424_0%,#361019_50%,#280D14_100%)] shadow-[2px_0_32px_rgba(0,0,0,0.35),inset_-1px_0_0_rgba(255,255,255,0.03)]"
      style={{ width: SIDEBAR_WIDTH }}
      aria-label="Navegação principal"
    >
      <div className="flex h-full flex-col px-4 py-5 [@media(max-height:820px)]:px-3.5 [@media(max-height:820px)]:py-4 [@media(max-height:700px)]:px-3 [@media(max-height:700px)]:py-3">
        <div className="shrink-0 border-b border-white/[0.06] pb-4 [@media(max-height:700px)]:pb-3">
          <SidebarBrandBlock />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 pt-5 [@media(max-height:700px)]:gap-3 [@media(max-height:700px)]:pt-3">
          <SidebarNavSection />
          <div className="border-t border-white/[0.05] pt-3 [@media(max-height:700px)]:pt-2">
            <SidebarProSection />
          </div>
        </div>

        <div className="mt-auto border-t border-white/[0.06] pt-4 [@media(max-height:700px)]:pt-3">
          <SidebarFooterAccount />
        </div>
      </div>
    </aside>
  );
}

export const PremiumSidebar = memo(PremiumSidebarInner);
