import { memo } from "react";
import { cn } from "@/lib/utils";
import { SidebarBrandBlock } from "@/components/premium/sidebar/SidebarBrandBlock";
import { SidebarNavSection } from "@/components/premium/sidebar/SidebarNavSection";
import { SidebarProSection } from "@/components/premium/sidebar/SidebarProSection";
import { SidebarFooterAccount } from "@/components/premium/sidebar/SidebarFooterAccount";

export const PREMIUM_SIDEBAR_EXPANDED_W = 292;
/** Alinhado ao rail Figma + `PremiumSidebarRailItem` (max-w 80px). */
export const PREMIUM_SIDEBAR_COLLAPSED_W = 80;

export type PremiumSidebarProps = {
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
};

function PremiumSidebarInner({ collapsed, onCollapse, onExpand }: PremiumSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto border-r",
        collapsed
          ? "border-white/[0.06] bg-[#361019] bg-[linear-gradient(180deg,#421424_0%,#361019_50%,#280D14_100%)] shadow-[20px_0px_50px_0px_rgba(33,4,13,0.3)]"
          : "border-white/[0.05] bg-[#361019] bg-[linear-gradient(180deg,#421424_0%,#361019_50%,#280D14_100%)] shadow-[2px_0_32px_rgba(0,0,0,0.35),inset_-1px_0_0_rgba(255,255,255,0.03)]",
      )}
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          collapsed
            ? "items-center gap-7 px-2 py-8 [@media(max-height:620px)]:gap-6 [@media(max-height:620px)]:py-6"
            : "px-4 py-5 [@media(max-height:820px)]:px-3.5 [@media(max-height:820px)]:py-4 [@media(max-height:700px)]:px-3 [@media(max-height:700px)]:py-3",
        )}
      >
        {/* Brand (logo + expandir) — `gap-7` acima separa este bloco da navegação */}
        <div
          className={cn(
            "w-full shrink-0",
            collapsed ? "flex justify-center" : "border-b border-white/[0.06] pb-4 [@media(max-height:700px)]:pb-3",
          )}
        >
          <SidebarBrandBlock collapsed={collapsed} onCollapse={onCollapse} onExpand={onExpand} />
        </div>

        {/* Nav + Pro */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            collapsed
              ? "w-full items-center gap-3 [@media(max-height:620px)]:gap-2.5"
              : "gap-5 pt-5 [@media(max-height:700px)]:gap-3 [@media(max-height:700px)]:pt-3",
          )}
        >
          <SidebarNavSection collapsed={collapsed} />
          <div
            className={cn(
              collapsed
                ? "w-full border-t border-white/[0.07] pt-2.5 [@media(max-height:700px)]:pt-2"
                : "border-t border-white/[0.05] pt-3 [@media(max-height:700px)]:pt-2",
            )}
          >
            <SidebarProSection collapsed={collapsed} />
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "mt-auto w-full",
            collapsed
              ? "flex flex-col items-center pt-3 [@media(max-height:700px)]:pt-2"
              : "border-t border-white/[0.06] pt-4 [@media(max-height:700px)]:pt-3",
          )}
        >
          <SidebarFooterAccount collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}

export const PremiumSidebar = memo(PremiumSidebarInner);
