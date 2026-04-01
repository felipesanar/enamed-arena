import { motion } from "framer-motion";
import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** `inline-end`: subtítulo à direita na mesma linha do título (md+), economiza altura. */
  subtitlePlacement?: "below" | "inline-end";
  badge?: string;
  action?: ReactNode;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, subtitle, subtitlePlacement = "below", badge, action }, ref) => {
    const inlineSubtitle = subtitlePlacement === "inline-end" && subtitle;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-8 md:mb-10"
      >
        <div className="min-w-0 flex-1">
          {inlineSubtitle ? (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6 lg:gap-8">
              <div className="min-w-0 flex flex-col gap-1.5">
                {badge && (
                  <span className="text-overline uppercase text-primary font-bold tracking-wider block">
                    {badge}
                  </span>
                )}
                <h1 className="text-heading-1 text-foreground">{title}</h1>
              </div>
              {subtitle && (
                <p className="max-w-2xl shrink-0 text-body-lg text-muted-foreground md:max-w-[min(28rem,42vw)] md:text-right">
                  {subtitle}
                </p>
              )}
            </div>
          ) : (
            <>
              {badge && (
                <span className="mb-1.5 block text-overline font-bold uppercase tracking-wider text-primary">
                  {badge}
                </span>
              )}
              <h1 className="text-heading-1 text-foreground">{title}</h1>
              {subtitle && (
                <p className="mt-1.5 max-w-2xl text-body-lg text-muted-foreground">{subtitle}</p>
              )}
            </>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </motion.div>
    );
  }
);

PageHeader.displayName = "PageHeader";
