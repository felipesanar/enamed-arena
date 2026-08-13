/**
 * PresencialIdentifyStep — tela 1 do fluxo presencial (QR → gabarito → resultado).
 *
 * É a primeira coisa que o aluno vê ao ler o QR code na sala de prova: ele
 * informa nome e e-mail e a partir daí segue para o gabarito. Usada por
 * dezenas de pessoas ao mesmo tempo, no celular, numa rede de evento — todo
 * ramo (não achou conta, não é a conta dele, desistiu) precisa ter uma saída
 * visível.
 *
 * Ramos possíveis do `checkin`:
 * - `ready`        → identificado direto, segue para o gabarito.
 * - `suggestions`  → 1 a 3 candidatos parecidos por nome; o aluno confirma
 *                    qual é a dele (ou nenhuma).
 * - `no_account`   → nenhuma conta encontrada; oferece criar conta ou seguir
 *                    sem vincular (fora do ranking até vincular depois).
 */
import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PresencialCandidateCard } from './PresencialCandidateCard';
import { presencialApi } from '@/services/presencialApi';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { PresencialCandidate, PresencialReady } from '@/types/presencial';

type SubStep = 'form' | 'suggestions' | 'no_account';

interface DeclaredIdentity {
  name: string;
  email: string;
}

interface PresencialIdentifyStepProps {
  code: string;
  onReady: (ready: PresencialReady, declared: DeclaredIdentity) => void;
}

export function PresencialIdentifyStep({ code, onReady }: PresencialIdentifyStepProps) {
  const prefersReducedMotion = useReducedMotion();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subStep, setSubStep] = useState<SubStep>('form');
  const [candidates, setCandidates] = useState<PresencialCandidate[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && !submitting;
  const declared: DeclaredIdentity = { name, email };
  const loginHref = `/login?next=${encodeURIComponent(`/presencial/${code}`)}`;

  const handleApiError = (context: string, err: unknown, title: string) => {
    logger.error(`[PresencialIdentifyStep] ${context}:`, err);
    toast({
      title,
      description: (err as Error)?.message ?? 'Tente novamente.',
      variant: 'destructive',
    });
  };

  const handleContinue = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const result = await presencialApi.checkin({ code, name, email });
      if (result.status === 'ready') {
        onReady(result, declared);
        return;
      }
      if (result.status === 'suggestions') {
        setCandidates(result.candidates);
        setSubStep('suggestions');
        return;
      }
      setSubStep('no_account');
    } catch (err) {
      handleApiError('Erro no checkin', err, 'Não foi possível continuar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async (candidateRef: string) => {
    setSubmitting(true);
    try {
      const result = await presencialApi.claim({ code, name, email, candidateRef });
      onReady(result, declared);
    } catch (err) {
      handleApiError('Erro ao confirmar candidato', err, 'Não foi possível confirmar a conta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartUnlinked = async () => {
    setSubmitting(true);
    try {
      const result = await presencialApi.startUnlinked({ code, name, email });
      onReady(result, declared);
    } catch (err) {
      handleApiError('Erro ao seguir sem vincular', err, 'Não foi possível continuar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-heading-2 text-foreground">Identifique-se</h1>
        <p className="text-body text-muted-foreground">
          Você está na Plataforma de Simulados SanarFlix PRO. Informe o e-mail que você usa aqui
          — se você já tem conta.
        </p>
      </div>

      {subStep === 'form' && (
        <form onSubmit={handleContinue} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="presencial-name">Nome completo</Label>
            <Input
              id="presencial-name"
              className="h-12 text-base"
              autoComplete="name"
              placeholder="Seu nome completo"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="presencial-email">E-mail</Label>
            <Input
              id="presencial-email"
              type="email"
              inputMode="email"
              className="h-12 text-base"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar'}
          </Button>
        </form>
      )}

      {subStep === 'suggestions' && (
        <div className="space-y-4">
          <p className="text-body-sm text-muted-foreground">
            Não encontramos uma conta com esse e-mail exato. Alguma dessas é a sua?
          </p>
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <PresencialCandidateCard
                key={candidate.ref}
                candidate={candidate}
                onClaim={handleClaim}
                disabled={submitting}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full text-base"
            disabled={submitting}
            onClick={() => setSubStep('no_account')}
          >
            Nenhuma é minha
          </Button>
          <UnlinkedFallback submitting={submitting} onStartUnlinked={handleStartUnlinked} />
        </div>
      )}

      {subStep === 'no_account' && (
        <div className="space-y-4">
          <p className="text-body-sm text-muted-foreground">
            Não encontramos uma conta sua na plataforma.
          </p>
          <Button asChild size="lg" className="h-12 w-full text-base">
            <a href={loginHref}>Criar minha conta</a>
          </Button>
          <UnlinkedFallback submitting={submitting} onStartUnlinked={handleStartUnlinked} />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Saída secundária disponível em `suggestions` e `no_account`: segue para o
 * gabarito sem vincular a conta agora. Fica explícito o custo (fora do
 * ranking até vincularmos depois) — não escondemos a consequência, mas
 * também não viramos o caminho principal.
 */
function UnlinkedFallback({
  submitting,
  onStartUnlinked,
}: {
  submitting: boolean;
  onStartUnlinked: () => void;
}) {
  return (
    <div className="space-y-2 text-center">
      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full text-base"
        disabled={submitting}
        onClick={onStartUnlinked}
      >
        Seguir sem vincular agora
      </Button>
      <p className="text-caption text-muted-foreground">
        Sua nota só entra no ranking depois que vincularmos sua conta.
      </p>
    </div>
  );
}
