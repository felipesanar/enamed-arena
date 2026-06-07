import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Radius: "hero" | "large" | "medium" */
  radius?: "hero" | "large" | "medium";
  /** Slightly interactive (hover lift + layered shadow) */
  interactive?: boolean;
}

const radiusMap = {
  hero: "rounded-[28px]",
  large: "rounded-2xl",
  medium: "rounded-xl",
};

/** Layered shadow: soft ambient + subtle elevation for premium depth */
const shadowBase =
  "shadow-[0_1px_2px_rgba(20,20,30,0.02),0_4px_12px_rgba(20,20,30,0.04)] dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.45),0_2px_4px_-2px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.04)]";

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ className, radius = "large", interactive, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "border border-border/80 bg-card",
        radiusMap[radius],
        shadowBase,
        interactive &&
          "transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:border-border hover:shadow-[0_2px_4px_rgba(20,20,30,0.03),0_12px_32px_rgba(20,20,30,0.07),0_0_0_1px_rgba(20,20,30,0.03)] dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.4),0_12px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] focus-within:ring-2 focus-within:ring-primary/15 focus-within:ring-offset-2 focus-within:ring-offset-background focus-within:border-primary/30",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
SurfaceCard.displayName = "SurfaceCard";
