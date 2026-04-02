import { memo } from "react";
import { cn } from "@/lib/utils";
import { SidebarBrandBlock } from "@/components/premium/sidebar/SidebarBrandBlock";
import { SidebarNavSection } from "@/components/premium/sidebar/SidebarNavSection";
import { SidebarProSection } from "@/components/premium/sidebar/SidebarProSection";
import { SidebarFooterAccount } from "@/components/premium/sidebar/SidebarFooterAccount";

export const PREMIUM_SIDEBAR_EXPANDED_W = 292;
export const PREMIUM_SIDEBAR_COLLAPSED_W = 72;

export type PremiumSidebarProps = {
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
};

function PremiumSidebarInner({ collapsed, onCollapse, onExpand }: PremiumSidebarProps) {
  return (
    <aside
      className="flex h-full w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto border-r border-white/[0.05] bg-[#361019] bg-[linear-gradient(180deg,#421424_0%,#361019_50%,#280D14_100%)] shadow-[2px_0_32px_rgba(0,0,0,0.35),inset_-1px_0_0_rgba(255,255,255,0.03)]"
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          collapsed
            ? "items-center px-2 py-5"
            : "px-4 py-5 [@media(max-height:820px)]:px-3.5 [@media(max-height:820px)]:py-4 [@media(max-height:700px)]:px-3 [@media(max-height:700px)]:py-3",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "shrink-0",
            collapsed
              ? "pb-4 mb-2"
              : "border-b border-white/[0.06] pb-4 [@media(max-height:700px)]:pb-3",
          )}
        >
          <SidebarBrandBlock collapsed={collapsed} onCollapse={onCollapse} onExpand={onExpand} />
        </div>

        {collapsed && (
          <div className="w-full h-px bg-white/[0.06] mb-2" />
        )}

        {/* Nav + Pro */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            collapsed
              ? "w-full items-center"
              : "gap-5 pt-5 [@media(max-height:700px)]:gap-3 [@media(max-height:700px)]:pt-3",
          )}
        >
          <SidebarNavSection collapsed={collapsed} />
          <div
            className={cn(
              collapsed
                ? "w-full border-t border-white/[0.05] pt-1.5"
                : "border-t border-white/[0.05] pt-3 [@media(max-height:700px)]:pt-2",
            )}
          >
            <SidebarProSection collapsed={collapsed} />
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "mt-auto",
            collapsed
              ? "pt-4"
              : "border-t border-white/[0.06] pt-4 [@media(max-height:700px)]:pt-3",
          )}
        >
          {collapsed && (
            <div className="w-full h-px bg-white/[0.06] mb-2" />
          )}
          <SidebarFooterAccount collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}

export const PremiumSidebar = memo(PremiumSidebarInner);
