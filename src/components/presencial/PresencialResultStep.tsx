/**
 * PresencialResultStep — tela 3 do fluxo presencial (QR → gabarito → resultado).
 *
 * Mostra o resultado agregado assim que o gabarito é corrigido no servidor:
 * total de acertos, percentual e a quebra por área. Deliberadamente **não**
 * mostra correção questão-a-questão nem qual era a alternativa certa — a
 * prova impressa segue com o aluno e o gabarito comentado só libera depois
 * (07/09), junto com ranking e caderno de erros na plataforma.
 *
 * Quando `is_linked` é falso, o aluno seguiu o fluxo sem confirmar uma conta
 * — a nota foi registrada, mas só entra no ranking depois que a conta for
 * vinculada por trás (não é sobre estar fora da janela do simulado).
 */
import { Progress } from '@/components/ui/progress';
import type { PresencialResult } from '@/types/presencial';

interface PresencialResultStepProps {
  result: PresencialResult;
}

export function PresencialResultStep({ result }: PresencialResultStepProps) {
  const { total_questions, total_correct, score_percentage, by_area, is_linked } = result;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <div className="space-y-2 text-center">
        <p className="text-body text-muted-foreground">Gabarito enviado com sucesso</p>
        <p className="text-kpi text-foreground">
          {total_correct}
          <span className="text-heading-3 text-muted-foreground">/{total_questions}</span>
        </p>
        <p className="text-body text-muted-foreground">
          {score_percentage.toFixed(0)}% de acerto
        </p>
      </div>

      {by_area.length > 0 && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-heading-3 text-foreground">Desempenho por área</h2>
          <div className="space-y-3">
            {by_area.map((area) => (
              <div key={area.area} className="space-y-1.5">
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-foreground">{area.area}</span>
                  <span className="text-muted-foreground">
                    {area.correct}/{area.total}
                  </span>
                </div>
                <Progress value={area.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-xl bg-muted p-4 text-center">
        <p className="text-body-sm text-muted-foreground">
          Gabarito comentado, ranking e caderno de erros liberam em <strong>07/09</strong>. Entre
          na sua conta em simulados.sanar.com.br.
        </p>
        {!is_linked && (
          <p className="text-body-sm font-medium text-warning">
            Sua nota entra no ranking quando confirmarmos sua conta.
          </p>
        )}
      </div>
    </div>
  );
}
