/**
 * useExamIntegrity — rastreamento de integridade da prova (saída de aba / saída
 * de tela cheia) e fiação do useFocusControl.
 *
 * Extraído de useExamFlow (Fase 3 / REFACTOR_ROADMAP). Os handlers leem de refs
 * mantidas frescas pelo useExamFlow (stateRef/simuladoRef) — assim o
 * useFocusControl não re-registra listeners do window a cada resposta. NÃO muda
 * comportamento.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useFocusControl } from '@/hooks/useFocusControl';
import { trackEvent } from '@/lib/analytics';
import { toast } from '@/hooks/use-toast';
import type { ExamState } from '@/types/exam';

/** Subconjunto de useExamStorageReal usado aqui. */
interface IntegrityStorage {
  registerTabExit: () => void;
  registerFullscreenExit: () => void;
  attemptId: { current: string | null };
}

export interface UseExamIntegrityArgs {
  stateRef: MutableRefObject<ExamState | null>;
  simuladoRef: MutableRefObject<{ id: string } | null>;
  storage: IntegrityStorage;
  setState: Dispatch<SetStateAction<ExamState | null>>;
}

/** Segundos restantes até o deadline efetivo (0 se não houver). */
function timeRemainingSeconds(state: ExamState | null): number {
  if (!state?.effectiveDeadline) return 0;
  return Math.max(0, Math.round((new Date(state.effectiveDeadline).getTime() - Date.now()) / 1000));
}

export function useExamIntegrity({
  stateRef,
  simuladoRef,
  storage,
  setState,
}: UseExamIntegrityArgs): ReturnType<typeof useFocusControl> {
  const onTabExit = useCallback(() => {
    storage.registerTabExit();
    const s = stateRef.current;
    const sim = simuladoRef.current;
    if (s && sim) {
      trackEvent('exam_integrity_event', {
        simulado_id: sim.id,
        attempt_id: storage.attemptId.current ?? '',
        event_type: 'tab_exit',
        count_so_far: (s.tabExitCount ?? 0) + 1,
        time_remaining_seconds: timeRemainingSeconds(s),
      });
    }
  }, [storage, stateRef, simuladoRef]);

  const onTabReturn = useCallback(() => {}, []);

  const onFullscreenExit = useCallback(() => {
    storage.registerFullscreenExit();
    setState(prev => prev ? { ...prev, fullscreenExitCount: prev.fullscreenExitCount + 1 } : prev);
    const s = stateRef.current;
    const sim = simuladoRef.current;
    if (s && sim) {
      trackEvent('exam_integrity_event', {
        simulado_id: sim.id,
        attempt_id: storage.attemptId.current ?? '',
        event_type: 'fullscreen_exit',
        count_so_far: (s.fullscreenExitCount ?? 0) + 1,
        time_remaining_seconds: timeRemainingSeconds(s),
      });
    }
    toast({
      title: 'Você saiu da tela cheia',
      description: 'Penalidade de integridade registrada. Volte para tela cheia para continuar em conformidade.',
      variant: 'destructive',
    });
  }, [storage, stateRef, simuladoRef, setState]);

  return useFocusControl({ onTabExit, onTabReturn, onFullscreenExit });
}
