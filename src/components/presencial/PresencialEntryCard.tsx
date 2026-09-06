/**
 * PresencialEntryCard — ponto de entrada do fluxo presencial v2, em `/ranking`.
 *
 * Fluxo definido pela liderança: QR code → página do ranking → login →
 * "Fiz o simulado presencialmente" → subir o gabarito → caderno 1 ou 2 →
 * mesma experiência de resultado de sempre. Este card é o gatilho: aparece
 * enquanto existir um simulado com a janela de execução aberta e o aluno
 * ainda não tiver enviado uma tentativa nele.
 *
 * Ao tocar em "Subir o gabarito": cria (ou retoma — a RPC é idempotente) o
 * attempt offline e leva direto para `/simulados/:slug/gabarito`. Não baixa
 * PDF nem mostra as etapas do modo offline de casa — quem chega aqui já fez
 * a prova no papel, na sala.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileEdit, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulados } from '@/hooks/useSimulados';
import { offlineApi } from '@/services/offlineApi';
import { persistOfflineAttempt } from '@/hooks/useOfflineAttempt';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { SimuladoStatus } from '@/types';

// Janela aberta e o aluno ainda não enviou: 'available' (não iniciou) e
// 'in_progress' (iniciou — inclusive uma tentativa online abandonada — mas
// não terminou) são os dois status em que falta tentativa enviada.
const ELIGIBLE_STATUSES = new Set<SimuladoStatus>(['available', 'in_progress']);

export function PresencialEntryCard() {
  const navigate = useNavigate();
  const { simulados, loading } = useSimulados();
  const [submitting, setSubmitting] = useState(false);

  const eligible = useMemo(
    () => simulados.find((s) => ELIGIBLE_STATUSES.has(s.status)) ?? null,
    [simulados],
  );

  const handleClick = useCallback(async () => {
    if (!eligible || submitting) return;
    setSubmitting(true);
    try {
      // `createPresencialAttempt`, e não `createOfflineAttempt`: a RPC offline
      // RECUSA quem tem tentativa online `in_progress`, e é exatamente esse o
      // aluno que aparece aqui com status 'in_progress' — o que começou online,
      // abandonou, e fez a prova no papel. Com a RPC antiga ele ficaria travado
      // na sala. Ver `create_presencial_attempt_guarded` ("presencial ganha").
      const attempt = await offlineApi.createPresencialAttempt(eligible.id);
      const slug = attempt.simulado_slug || eligible.slug;

      persistOfflineAttempt({
        id: attempt.attempt_id,
        simulado_id: eligible.id,
        simulado_slug: slug,
        started_at: attempt.started_at,
        exam_duration_seconds: attempt.exam_duration_seconds,
      });

      // Substituir a tentativa online do aluno não pode acontecer calado.
      if (attempt.converted_from_online) {
        toast({
          title: 'Tentativa online substituída',
          description:
            'Você tinha uma tentativa online em andamento neste simulado. Ela foi substituída pelo gabarito presencial que você vai preencher agora.',
        });
      }

      navigate(`/simulados/${slug}/gabarito`);
    } catch (err) {
      logger.error('[PresencialEntryCard] Erro ao criar tentativa presencial:', err);
      toast({
        title: 'Erro ao abrir o gabarito',
        description: (err as Error)?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  }, [eligible, submitting, navigate]);

  if (loading || !eligible) return null;

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 md:mb-10">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <FileEdit className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-heading-3 text-foreground">Fiz o simulado presencialmente</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Preencha o gabarito digital com as respostas que você marcou no papel.
          </p>
        </div>
      </div>
      <Button
        size="lg"
        onClick={() => void handleClick()}
        disabled={submitting}
        className="h-14 w-full gap-2 px-8 text-body font-semibold sm:h-12 sm:w-auto"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitting ? 'Abrindo gabarito…' : 'Subir o gabarito'}
      </Button>
    </div>
  );
}
