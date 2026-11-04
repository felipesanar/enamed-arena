import { useSyncExternalStore } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { getRecoveryNotice, subscribeRecoveryNotice } from '@/lib/preloadRecovery';

export function PreloadRecoveryNotice({ reload = () => window.location.reload() }: { reload?: () => void }) {
  const visible = useSyncExternalStore(subscribeRecoveryNotice, getRecoveryNotice, () => false);
  if (!visible) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[100] mx-auto max-w-xl">
      <Alert className="border-foreground/50 bg-background text-foreground shadow-sm">
        <AlertTitle>Uma atualização não pôde ser carregada</AlertTitle>
        <AlertDescription>
          <p>Sua página não será recarregada automaticamente. Alterações ainda não sincronizadas podem ser perdidas. Recarregue apenas quando estiver pronto para tentar retomar.</p>
          <button type="button" onClick={reload} className="mt-3 min-h-11 rounded-lg border border-primary px-4 py-2 font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            Recarregar e retomar
          </button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
