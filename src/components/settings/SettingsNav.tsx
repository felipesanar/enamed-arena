import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SettingsNavSection {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  badge?: string;
}

interface SettingsNavProps {
  sections: SettingsNavSection[];
  /** ID da seção ativa (controlado). */
  activeId: string;
  /** Callback quando o usuário seleciona uma seção. */
  onSelect: (id: string) => void;
}

/**
 * Navegação lateral controlada por abas. Em telas ≥ lg aparece como
 * coluna lateral sticky; em mobile cai para chips horizontais sticky.
 */
export function SettingsNav({ sections, activeId, onSelect }: SettingsNavProps) {
  const handleSelect = (id: string) => onSelect(id);

  return (
    <>
      {/* Desktop — coluna vertical sticky */}
      <nav
        aria-label="Navegação de configurações"
        className="hidden lg:block sticky top-24 self-start"
      >
        <ul className="flex flex-col gap-1">
          {sections.map((section) => {
            const isActive = activeId === section.id;
            const Icon = section.icon;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(section.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive
                      ? "bg-accent/60 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="settings-nav-indicator"
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/70 text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-body-sm font-semibold leading-tight">
                      {section.label}
                    </span>
                    {section.description && (
                      <span className="text-caption text-muted-foreground/90 leading-tight mt-0.5 line-clamp-1">
                        {section.description}
                      </span>
                    )}
                  </span>
                  {section.badge && (
                    <span className="ml-auto text-micro-label uppercase text-primary font-bold">
                      {section.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile — chips rolagem horizontal sticky */}
      <nav
        aria-label="Navegação de configurações"
        className="lg:hidden sticky top-[calc(var(--mobile-header-h,56px)+env(safe-area-inset-top,0px)+8px)] -mx-4 sm:mx-0 z-10 mb-6"
      >
        <div className="px-4 sm:px-0">
          <div
            className="overflow-x-auto bg-background/85 backdrop-blur border border-border/70 rounded-2xl p-1.5 flex gap-1 shadow-sm settings-nav-scroll"
          >
            {sections.map((section) => {
              const isActive = activeId === section.id;
              const Icon = section.icon;
              return (
                <button
                  type="button"
                  key={section.id}
                  onClick={() => handleSelect(section.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-body-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="settings-nav-pill"
                      className="absolute inset-0 rounded-xl bg-primary/10"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
