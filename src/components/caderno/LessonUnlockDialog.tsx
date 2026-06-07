/**
 * LessonUnlockDialog — modal exibido quando o aluno tenta revisar uma entrada
 * "Lacuna" (reason = did_not_know) ainda no estado `awaiting_lesson`.
 *
 * Comportamento Fase 2 (docs/specs/00-contratos-canonicos.md §11 + §12):
 *   - Explica que a entrada precisa ser estudada antes do re-teste.
 *   - "Já estudei isso" confirma manualmente → desbloqueia o re-teste
 *     (o caller chama clearAwaitingLesson e dispara analytics).
 *   - "Ver aula" abre busca do SanarFlix pelo tema/área em nova aba,
 *     dispara `caderno_lesson_accessed` e chama clearAwaitingLesson.
 *
 * TODO (mapa tema→aula): substituir URL de busca por deep-link direto para
 * a aula correta assim que o mapa oficial tema→conteúdo estiver disponível.
 *
 * Props:
 *   entry            — entry do caderno; campos SRS lidos via casts
 *   open             — visibilidade controlada
 *   onConfirmStudied — chamado quando o aluno confirma que estudou;
 *                      o caller é responsável pela chamada de API e analytics
 *   onClose          — chamado ao fechar sem confirmar
 *
 * A11y:
 *   - Construído sobre Radix Dialog (focus-trap, Esc, aria-labelledby/aria-describedby).
 *   - Botão de confirmação recebe foco automático ao abrir.
 *   - Estado de loading desabilita os botões e exibe spinner.
 */

import { useRef, useState } from 'react';
import { BookOpen, PlayCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { logger } from '@/lib/logger';
import type { NotebookEntry } from '@/components/caderno/NotebookEntryCard';

// ─── URL helper ──────────────────────────────────────────────────────────────

/**
 * Constrói URL de busca do SanarFlix pelo tema/área da entrada.
 * TODO: substituir por deep-link direto para a aula quando o mapa
 * oficial tema→conteúdo estiver disponível.
 */
function buildLessonSearchUrl(entry: NotebookEntry): string {
  const query = [entry.theme, entry.area].filter(Boolean).join(' ');
  const encoded = encodeURIComponent(query || 'residência médica');
  return `https://www.sanarflix.com.br/app/busca?q=${encoded}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface LessonUnlockDialogProps {
  /** The error notebook entry being unblocked. */
  entry: NotebookEntry;
  /** Controls dialog visibility (controlled component). */
  open: boolean;
  /**
   * Called after student confirms they have studied the topic.
   * May be async — dialog shows a loading state while awaiting resolution.
   * On error, the dialog stays open (caller should show a toast).
   */
  onConfirmStudied: (entryId: string) => Promise<void> | void;
  /** Called when the dialog is closed without confirming. */
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LessonUnlockDialog({
  entry,
  open,
  onConfirmStudied,
  onClose,
}: LessonUnlockDialogProps) {
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const meta = getReasonMeta(entry.reason);

  const topicLabel = [entry.area, entry.theme].filter(Boolean).join(' › ') || 'este tema';

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirmStudied(entry.id);
      // O caller controla a visibilidade do dialog após confirmação; não chamamos
      // onClose aqui para que o caller possa navegar antes da desmontagem.
    } catch {
      // O caller é responsável pelo feedback de erro (toast).
      // Resetamos loading para permitir nova tentativa.
    } finally {
      setLoading(false);
    }
  }

  /**
   * Abre busca do SanarFlix pelo tema da entrada em nova aba,
   * dispara analytics `caderno_lesson_accessed` e limpa o estado
   * awaiting_lesson server-side (best-effort — não bloqueia a navegação).
   */
  async function handleViewLesson() {
    const url = buildLessonSearchUrl(entry);

    // Dispara evento de analytics antes de abrir a aba (best-effort)
    trackEvent('caderno_lesson_accessed', {
      entry_id: entry.id,
      area: entry.area ?? undefined,
      theme: entry.theme ?? undefined,
      reason: entry.reason,
    });

    // Abre em nova aba imediatamente para não ser bloqueada pelo browser
    window.open(url, '_blank', 'noopener,noreferrer');

    // Limpa awaiting_lesson server-side (best-effort, sem bloquear UX)
    try {
      await onConfirmStudied(entry.id);
    } catch (err) {
      logger.error('[LessonUnlockDialog] Erro ao limpar awaiting_lesson via ver aula:', err);
      // Não mostra toast de erro — o foco do aluno já mudou para a nova aba
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !loading) onClose();
      }}
    >
      <DialogContent
        className="max-w-md"
        // Auto-focus the primary action on open for keyboard users
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          confirmRef.current?.focus();
        }}
      >
        {/* ── Header ── */}
        <DialogHeader>
          {/* Cause badge */}
          <span
            className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: meta.colorBg,
              color: meta.colorText,
              borderColor: meta.colorBorder,
            }}
            aria-hidden
          >
            <BookOpen className="h-3 w-3" />
            {meta.badge}
          </span>

          <DialogTitle className="text-heading-2 leading-snug">
            Estude antes de re-testar
          </DialogTitle>

          <DialogDescription className="text-body text-muted-foreground">
            Esta questão foi marcada como{' '}
            <strong className="font-semibold" style={{ color: meta.colorText }}>
              Lacuna
            </strong>{' '}
            — você nunca viu o conteúdo de{' '}
            <span className="font-medium text-foreground">{topicLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* ── Explanation box ── */}
        <div
          className={cn(
            'rounded-xl border border-border/60 bg-muted/30 px-4 py-3.5',
            'text-[13px] leading-relaxed text-muted-foreground',
          )}
          role="note"
          aria-label="Estratégia pedagógica"
        >
          <p>
            <span className="font-semibold text-foreground">Por que isso importa?</span>
            {' '}Re-testar sem entender o conceito leva à memorização fraca. Ao estudar
            o tema primeiro, você consolida o raciocínio — e o caderno vai espaçar as
            revisões no ritmo certo a partir daí.
          </p>
          <p className="mt-2">
            Quando estiver pronto, confirme abaixo para liberar a questão para revisão.
          </p>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Deep-link de aula — Fase 2: busca SanarFlix pelo tema */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleViewLesson()}
            disabled={loading}
            className="w-full gap-2 sm:w-auto"
            aria-label={`Buscar aula sobre ${topicLabel} no SanarFlix (abre em nova aba)`}
          >
            <PlayCircle className="h-4 w-4" aria-hidden />
            Ver aula no SanarFlix
          </Button>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Agora não
            </Button>

            <Button
              ref={confirmRef}
              size="sm"
              onClick={handleConfirm}
              disabled={loading}
              className="w-full gap-2 sm:w-auto"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden
                  />
                  Liberando…
                </>
              ) : (
                'Já estudei isso'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
