import { forwardRef, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: string;
  /** Ação discreta no canto direito do cabeçalho (ex.: botão "Editar"). */
  action?: ReactNode;
  /** Badge opcional à direita do título (ex.: "Bloqueado"). */
  badge?: ReactNode;
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Section premium para Configurações: título + descrição + ação à direita,
 * com entrada animada sutil. O id é usado como âncora do scroll-spy.
 */
export const SettingsSection = forwardRef<HTMLElement, SettingsSectionProps>(
  function SettingsSection(
    { id, title, description, action, badge, children, delay = 0, className },
    ref,
  ) {
    const reduced = useReducedMotion();
    return (
      <motion.section
        ref={ref}
        id={id}
        aria-labelledby={`${id}-title`}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px 0px" }}
        transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        // scroll-margin garante que o scroll-spy e o anchor jump cheguem alinhados.
        style={{ scrollMarginTop: 96 }}
        className={cn("relative", className)}
      >
        <header className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2
                id={`${id}-title`}
                className="text-heading-3 text-foreground"
              >
                {title}
              </h2>
              {badge}
            </div>
            {description && (
              <p className="mt-1 text-body-sm text-muted-foreground max-w-xl">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
        {children}
      </motion.section>
    );
  },
);
