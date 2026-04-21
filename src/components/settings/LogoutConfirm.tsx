import { ReactNode, useState } from "react";
import { LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LogoutConfirmProps {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
}

/**
 * Envolve um trigger (tipicamente botão "Sair") em um AlertDialog premium
 * com confirmação obrigatória. Evita logout acidental em touch/mobile.
 */
export function LogoutConfirm({ onConfirm, children }: LogoutConfirmProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl p-0 overflow-hidden">
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full blur-3xl opacity-60"
            style={{
              background:
                "radial-gradient(closest-side, hsl(var(--destructive) / 0.2), transparent 70%)",
            }}
          />
          <div className="relative p-6">
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
              >
                <LogOut className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <AlertDialogHeader className="text-left">
                  <AlertDialogTitle className="text-heading-3">
                    Sair da sua conta?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-body-sm">
                    Você precisará fazer login novamente para acessar seus
                    simulados, ranking e Caderno de Erros.
                  </AlertDialogDescription>
                </AlertDialogHeader>
              </div>
            </div>

            <AlertDialogFooter className="mt-6 gap-2">
              <AlertDialogCancel className="rounded-xl">
                Continuar conectado
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={pending}
                className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {pending ? "Saindo..." : "Sair da conta"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
