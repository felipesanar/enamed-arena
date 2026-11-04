import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function ExamTabOwnershipNotice({ status, onTakeover }: {
  status: 'blocked' | 'syncing' | 'owned' | 'error' | 'preparing' | 'runtime_error'; onTakeover: () => void;
}) {
  if (status === 'owned') return null;
  const syncing = status === 'syncing' || status === 'preparing';
  return <Alert role="status" aria-live="polite" aria-busy={syncing} className="rounded-none border-x-0 bg-muted text-foreground">
    <AlertTitle>{status === 'preparing' ? 'Preparando sua prova' : status === 'runtime_error' ? 'Não foi possível preparar a prova' : syncing ? 'Sincronizando suas respostas' : status === 'error' ? 'Não foi possível sincronizar' : 'Esta prova está aberta em outra aba'}</AlertTitle>
    <AlertDescription>
      <p>{syncing ? 'Aguarde a confirmação do servidor e a sincronização antes de continuar. Suas respostas locais serão preservadas.' : status === 'runtime_error'
        ? 'Verifique a conexão e tente novamente. Suas respostas locais foram preservadas; ainda não há confirmação de salvamento.' : status === 'error'
        ? 'Verifique a conexão e permita o armazenamento local neste navegador. Depois tente novamente ou recarregue a página. As respostas estão bloqueadas por segurança.'
        : 'Continue nesta aba para sincronizar suas respostas antes de responder. O prazo da prova não muda.'}</p>
      <Button type="button" className="mt-3 min-h-[44px]" onClick={onTakeover} disabled={syncing}>
        {status === 'preparing' ? 'Preparando...' : syncing ? 'Sincronizando...' : status === 'runtime_error' ? 'Tentar novamente' : 'Continuar nesta aba'}
      </Button>
    </AlertDescription>
  </Alert>;
}
