/**
 * PresencialCandidateCard — um candidato sugerido pelo checkin presencial
 * quando o e-mail digitado não bate com nenhuma conta, mas o nome é parecido
 * com uma ou mais contas existentes.
 *
 * O e-mail chega já mascarado pela API (`masked_email`) — este componente
 * nunca tem acesso ao e-mail em claro do candidato e nunca deve tentar
 * reconstruí-lo.
 */
import { Button } from '@/components/ui/button';
import type { PresencialCandidate } from '@/types/presencial';

interface PresencialCandidateCardProps {
  candidate: PresencialCandidate;
  onClaim: (candidateRef: string) => void;
  disabled?: boolean;
}

export function PresencialCandidateCard({ candidate, onClaim, disabled }: PresencialCandidateCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0">
        <p className="truncate font-mono text-body text-foreground">{candidate.masked_email}</p>
        {candidate.hint && (
          <p className="mt-1 text-caption text-muted-foreground">{candidate.hint}</p>
        )}
      </div>
      <Button
        type="button"
        size="lg"
        className="h-11 shrink-0 px-4"
        disabled={disabled}
        onClick={() => onClaim(candidate.ref)}
      >
        É minha conta
      </Button>
    </div>
  );
}
