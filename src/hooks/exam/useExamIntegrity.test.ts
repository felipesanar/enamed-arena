import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExamIntegrity } from './useExamIntegrity';
import type { ExamState } from '@/types/exam';

// Captura os callbacks passados ao useFocusControl para dispará-los manualmente.
let captured: { onTabExit: () => void; onTabReturn: () => void; onFullscreenExit: () => void } | null = null;
vi.mock('@/hooks/useFocusControl', () => ({
  useFocusControl: (cbs: any) => {
    captured = cbs;
    return { isFullscreen: false, enterFullscreen: vi.fn(), exitFullscreen: vi.fn() } as any;
  },
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { toast } from '@/hooks/use-toast';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { trackEvent } from '@/lib/analytics';

function makeState(overrides: Partial<ExamState> = {}): ExamState {
  return {
    status: 'in_progress',
    tabExitCount: 0,
    fullscreenExitCount: 0,
    effectiveDeadline: new Date(Date.now() + 60_000).toISOString(),
    answers: {},
    ...overrides,
  } as ExamState;
}

function setup(state: ExamState | null = makeState()) {
  const registerTabExit = vi.fn();
  const registerFullscreenExit = vi.fn();
  const setState = vi.fn();
  const storage = { registerTabExit, registerFullscreenExit, attemptId: { current: 'att-1' } };
  const stateRef = { current: state };
  const simuladoRef = { current: { id: 'sim-1' } };
  renderHook(() =>
    useExamIntegrity({ stateRef, simuladoRef, storage, setState } as any),
  );
  return { registerTabExit, registerFullscreenExit, setState };
}

describe('useExamIntegrity', () => {
  beforeEach(() => { vi.clearAllMocks(); captured = null; });

  it('onTabExit registra a saída e dispara exam_integrity_event (tab_exit)', () => {
    const { registerTabExit } = setup(makeState({ tabExitCount: 2 }));
    captured!.onTabExit();
    expect(registerTabExit).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('exam_integrity_event', expect.objectContaining({
      simulado_id: 'sim-1',
      attempt_id: 'att-1',
      event_type: 'tab_exit',
      count_so_far: 3, // tabExitCount + 1
    }));
  });

  it('onFullscreenExit registra, incrementa o contador via setState, trackeia e avisa', () => {
    const { registerFullscreenExit, setState } = setup(makeState({ fullscreenExitCount: 1 }));
    captured!.onFullscreenExit();
    expect(registerFullscreenExit).toHaveBeenCalledTimes(1);
    // setState recebe um updater que incrementa fullscreenExitCount
    const updater = setState.mock.calls[0][0];
    expect(updater(makeState({ fullscreenExitCount: 1 })).fullscreenExitCount).toBe(2);
    expect(trackEvent).toHaveBeenCalledWith('exam_integrity_event', expect.objectContaining({
      event_type: 'fullscreen_exit',
      count_so_far: 2,
    }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('não trackeia quando não há state (mas ainda registra/avisa)', () => {
    const { registerTabExit } = setup(null);
    captured!.onTabExit();
    expect(registerTabExit).toHaveBeenCalledTimes(1);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
