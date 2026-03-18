import { Link, LinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-[220ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(142,31,61,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5F7] active:scale-[0.98] no-underline group";

const variants = {
  primary:
    "bg-[#8E1F3D] text-white hover:bg-[#A3294B] px-5 py-2.5 text-[15px] shadow-[0_2px_8px_rgba(142,31,61,0.22),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_14px_rgba(142,31,61,0.28),0_2px_4px_rgba(0,0,0,0.06)] hover:[&>svg]:translate-x-0.5",
  secondary:
    "bg-[#FCFAFB] border border-[#E8E1E5] text-[#1A2233] hover:bg-[#F3ECEF] hover:border-[#D8D0D6] px-5 py-2.5 text-[15px]",
  tertiary:
    "bg-transparent text-[#8E1F3D] hover:bg-[rgba(142,31,61,0.08)] px-3 py-2 text-sm",
};

interface PremiumLinkProps extends LinkProps {
  variant?: "primary" | "secondary" | "tertiary";
  showArrow?: boolean;
  className?: string;
}

export function PremiumLink({
  variant = "primary",
  showArrow = false,
  className,
  children,
  ...props
}: PremiumLinkProps) {
  return (
    <Link className={cn(base, variants[variant], className)} {...props}>
      {children}
      {showArrow && (
        <ArrowRight
          className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      )}
    </Link>
  );
}
