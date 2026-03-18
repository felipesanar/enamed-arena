import { LucideIcon, AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { forwardRef, ReactNode } from "react";

export type EmptyStateVariant = "empty" | "error";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  /** Pre-built action slot; if not set, onRetry/backHref are used to render buttons */
  action?: ReactNode;
  variant?: EmptyStateVariant;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon: Icon,
      title,
      description,
      action,
      variant = "empty",
      onRetry,
      backHref,
      backLabel = "Voltar",
    },
    ref
  ) => {
    const prefersReducedMotion = useReducedMotion();
    const isError = variant === "error";
    const defaultIcon = isError ? RefreshCw : AlertTriangle;
    const IconToUse = Icon ?? defaultIcon;

    const builtInAction =
      (onRetry || backHref) && !action ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Tentar novamente
            </button>
          )}
          {backHref && (
            <Link
              to={backHref}
              className="inline-flex items-center min-h-[44px] px-4 py-3 text-body font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
            >
              {backLabel}
            </Link>
          )}
        </div>
      ) : null;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
        className="flex flex-col items-center justify-center text-center py-20 px-6"
      >
        <div
          className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-5 ${
            isError ? "bg-destructive/10" : "bg-muted"
          }`}
        >
          <IconToUse
            className={`h-7 w-7 ${isError ? "text-destructive" : "text-muted-foreground"}`}
            aria-hidden
          />
        </div>
        <h3 className="text-heading-2 text-foreground mb-2">{title}</h3>
        <p className="text-body text-muted-foreground max-w-md leading-relaxed">{description}</p>
        {(action ?? builtInAction) && <div className="mt-6">{action ?? builtInAction}</div>}
      </motion.div>
    );
  }
);

EmptyState.displayName = "EmptyState";
