import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export interface PremiumButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary";
  showArrow?: boolean;
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-[220ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

const variants = {
  primary:
    "bg-primary text-primary-foreground hover:bg-[hsl(var(--wine-hover))] px-5 py-2.5 text-[15px] shadow-[0_2px_8px_hsl(var(--primary)/0.22),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_14px_hsl(var(--primary)/0.28),0_2px_4px_rgba(0,0,0,0.06)] active:shadow-[0_1px_4px_hsl(var(--primary)/0.2)]",
  secondary:
    "bg-card border border-border text-foreground hover:bg-muted hover:border-border/60 px-5 py-2.5 text-[15px]",
  tertiary:
    "bg-transparent text-primary hover:bg-primary/[0.08] px-3 py-2 text-sm",
};

export const PremiumButton = forwardRef<HTMLButtonElement, PremiumButtonProps>(
  (
    {
      variant = "primary",
      showArrow = false,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], className)}
      {...props}
    >
      {children}
      {showArrow && (
        <ArrowRight
          className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      )}
    </button>
  )
);
PremiumButton.displayName = "PremiumButton";

export interface PremiumLinkButtonProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: "primary" | "secondary" | "tertiary";
  showArrow?: boolean;
  children: React.ReactNode;
  className?: string;
  href: string;
}

export function PremiumLinkButton({
  variant = "primary",
  showArrow = false,
  className,
  children,
  href,
  ...props
}: PremiumLinkButtonProps) {
  return (
    <a
      href={href}
      className={cn(
        base,
        variants[variant],
        "no-underline group",
        className
      )}
      {...props}
    >
      {children}
      {showArrow && (
        <ArrowRight
          className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      )}
    </a>
  );
}
