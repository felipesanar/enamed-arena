/**
 * ResponsiveModal — Dialog em desktop, Sheet (bottom) em mobile.
 *
 * Uso:
 *   <ResponsiveModal open={open} onOpenChange={setOpen} title="Título">
 *     <p>Conteúdo</p>
 *   </ResponsiveModal>
 *
 * Aceita `dialogClassName` e `sheetClassName` para customizar cada variante.
 */

import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Classe extra aplicada ao DialogContent (desktop) */
  dialogClassName?: string;
  /** Classe extra aplicada ao SheetContent (mobile) */
  sheetClassName?: string;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  dialogClassName,
  sheetClassName,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={sheetClassName ?? 'rounded-t-[20px] max-h-[90svh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]'}
        >
          {(title || description) && (
            <SheetHeader className="text-left pb-4">
              {title && <SheetTitle>{title}</SheetTitle>}
              {description && <SheetDescription>{description}</SheetDescription>}
            </SheetHeader>
          )}
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClassName}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
