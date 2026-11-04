/**
 * useExamIntegrity — rastreamento de integridade da prova (saída de aba / saída
 * de tela cheia) e fiação do useFocusControl.
 *
 * Extraído de useExamFlow (Fase 3 / REFACTOR_ROADMAP). Os handlers leem de refs
 * mantidas frescas pelo useExamFlow (stateRef/simuladoRef) — assim o
 * useFocusControl recebe a tentativa atual. O storage captura cada incremento;
 * o estado React recebe a mesma contagem, sem duplicar a persistência.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useFocusControl } from '@/hooks/useFocusControl';
import { trackEvent } from '@/lib/analytics';
import { toast } from '@/hooks/use-toast';
import type { ExamState } from '@/types/exam';

/** Subconjunto de useExamStorageReal usado aqui. */
interface IntegrityStorage {
  registerTabExit: (state: ExamState) => ExamState | null;
  registerFullscreenExit: (state: ExamState) => ExamState | null;
  attemptId: { current: string | null };
  userId?: string;
}

export interface UseExamIntegrityArgs {
  stateRef: MutableRefObject<ExamState | null>;
  simuladoRef: MutableRefObject<{ id: string } | null>;
  storage: IntegrityStorage;
  setState: Dispatch<SetStateAction<ExamState | null>>;
  now?: () => number;
}

/** Segundos restantes até o deadline efetivo (0 se não houver). */
function timeRemainingSeconds(state: ExamState | null, now: () => number): number {
  if (!state?.effectiveDeadline) return 0;
  return Math.max(0, Math.round((new Date(state.effectiveDeadline).getTime() - now()) / 1000));
}

export function useExamIntegrity({
  stateRef,
  simuladoRef,
  storage,
  setState,
  now = Date.now,
}: UseExamIntegrityArgs): ReturnType<typeof useFocusControl> {
  const registerExit = useCallback((kind: 'tab_exit' | 'fullscreen_exit') => {
    const s = stateRef.current;
    const sim = simuladoRef.current;
    const attemptId = storage.attemptId.current;
    const userId = storage.userId;
    if (!s || !sim || s.simuladoId !== sim.id || s.status !== 'in_progress' || !attemptId) return;
    const updated = kind === 'tab_exit' ? storage.registerTabExit(s) : storage.registerFullscreenExit(s);
    if (!updated) return;
    // Persist once outside React's replayable updater; merge captured high-water marks.
    setState(prev => !prev || prev.status !== 'in_progress' || prev.simuladoId !== sim.id ||
      storage.attemptId.current !== attemptId || storage.userId !== userId ? prev : ({
        ...prev,
        tabExitCount: Math.max(prev.tabExitCount, updated.tabExitCount),
        fullscreenExitCount: Math.max(prev.fullscreenExitCount, updated.fullscreenExitCount),
      }));
    trackEvent('exam_integrity_event', {
      simulado_id: sim.id, attempt_id: attemptId, event_type: kind,
      count_so_far: kind === 'tab_exit' ? updated.tabExitCount : updated.fullscreenExitCount,
      time_remaining_seconds: timeRemainingSeconds(s, now),
    });
  }, [storage, stateRef, simuladoRef, setState, now]);

  const onTabExit = useCallback(() => registerExit('tab_exit'), [registerExit]);

  const onTabReturn = useCallback(() => {}, []);

  const onFullscreenExit = useCallback(() => {
    registerExit('fullscreen_exit');
    toast({
      title: 'Você saiu da tela cheia',
      description: 'Penalidade de integridade registrada. Volte para tela cheia para continuar em conformidade.',
      variant: 'destructive',
    });
  }, [registerExit]);

  return useFocusControl({ onTabExit, onTabReturn, onFullscreenExit });
}
