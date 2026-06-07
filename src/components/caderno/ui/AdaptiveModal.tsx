import * as React from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export interface AdaptiveModalProps {
  /** Controla abertura do modal. */
  open: boolean;
  /** Callback quando muda estado de abertura. */
  onOpenChange: (open: boolean) => void;
  /** Título exibido no header do modal/drawer. */
  title: string;
  /** Descrição opcional abaixo do título. */
  description?: string;
  /** Conteúdo principal. */
  children: React.ReactNode;
  /** Rodapé (botões de ação). */
  footer?: React.ReactNode;
  /** Largura máxima do dialog desktop (ex: "sm" | "md" | "lg"). Default: "md". */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/**
 * Modal adaptativo:
 * - Desktop (≥768px): `Dialog` centralizado.
 * - Mobile (<768px): `Drawer` bottom-sheet.
 * Mesma API em ambos os casos — open/onOpenChange/title/children/footer.
 */
export function AdaptiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: AdaptiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "caderno-root rounded-t-[20px] border-t border-[var(--c-border)] bg-[var(--c-surface)]",
            "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            className,
          )}
        >
          <DrawerHeader className="px-5 pt-2 text-left">
            <DrawerTitle className="text-heading-3 font-semibold text-[var(--c-ink)]">
              {title}
            </DrawerTitle>
            {description && (
              <p className="text-body-sm text-[var(--c-muted)]">{description}</p>
            )}
          </DrawerHeader>
          <div className="overflow-y-auto px-5 pb-2">{children}</div>
          {footer && (
            <DrawerFooter className="px-5 pt-2">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "caderno-root",
          SIZE_MAP[size] ?? SIZE_MAP.md,
          "rounded-[var(--c-radius-card)] border-[var(--c-border)] bg-[var(--c-surface)] shadow-[var(--c-shadow-md)]",
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-heading-3 font-semibold text-[var(--c-ink)]">
            {title}
          </DialogTitle>
          {description && (
            <p className="text-body-sm text-[var(--c-muted)]">{description}</p>
          )}
        </DialogHeader>
        <div>{children}</div>
        {footer && (
          <DialogFooter>{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
