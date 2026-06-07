import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExamBeacon } from './useExamBeacon';
import type { ExamState } from '@/types/exam';

// ── Supabase mock ────────────────────────────────────────────────────────────
// NOTE: vi.mock is hoisted, so we cannot reference top-level variables inside
// the factory. Instead we use vi.fn() inline and capture the mock via import.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok-123' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

import { supabase } from '@/integrations/supabase/client';

/** Helper to get the unsubscribe mock from the latest onAuthStateChange call. */
function getUnsubscribeMock() {
  const calls = (supabase.auth.onAuthStateChange as ReturnType<typeof vi.fn>).mock.results;
  if (calls.length === 0) return null;
  return calls[calls.length - 1].value.data.subscription.unsubscribe as ReturnType<typeof vi.fn>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeState(overrides: Partial<ExamState> = {}): ExamState {
  return {
    status: 'in_progress',
    answers: {
      'q1': {
        questionId: 'q1',
        selectedOption: 'opt-a',
        markedForReview: false,
        highConfidence: false,
        eliminatedAlternatives: [],
      },
    },
    currentQuestionIndex: 0,
    ...overrides,
  } as ExamState;
}

function setup({
  state = makeState(),
  hasFinalized = false,
}: {
  state?: ExamState | null;
  hasFinalized?: boolean;
} = {}) {
  const flushPendingState = vi.fn();
  const storage = {
    flushPendingState,
    attemptId: { current: 'att-1' },
  };
  const stateRef = { current: state };
  const hasFinalizedRef = { current: hasFinalized };

  const hook = renderHook(() =>
    useExamBeacon({ storage, stateRef, hasFinalized: hasFinalizedRef }),
  );

  return { flushPendingState, stateRef, hasFinalizedRef, storage, hook };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('useExamBeacon', () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>;
  let removeEventSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addEventSpy = vi.spyOn(window, 'addEventListener');
    removeEventSpy = vi.spyOn(window, 'removeEventListener');
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
  });

  afterEach(() => {
    addEventSpy.mockRestore();
    removeEventSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it('registra o listener beforeunload na montagem', () => {
    setup();
    expect(addEventSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('remove o listener beforeunload no desmontamento', () => {
    const { hook } = setup();
    hook.unmount();
    expect(removeEventSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('chama flushPendingState quando in_progress e não finalizado', () => {
    const { flushPendingState } = setup({ state: makeState({ status: 'in_progress' }) });

    // Captura o handler registrado e dispara manualmente
    const handler = addEventSpy.mock.calls.find(c => c[0] === 'beforeunload')?.[1] as
      | ((e: BeforeUnloadEvent) => void)
      | undefined;
    expect(handler).toBeDefined();

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', { writable: true, value: '' });
    handler!(event);

    expect(flushPendingState).toHaveBeenCalledTimes(1);
  });

  it('não age quando hasFinalized é true', () => {
    const { flushPendingState } = setup({
      state: makeState({ status: 'in_progress' }),
      hasFinalized: true,
    });

    const handler = addEventSpy.mock.calls.find(c => c[0] === 'beforeunload')?.[1] as
      | ((e: BeforeUnloadEvent) => void)
      | undefined;
    expect(handler).toBeDefined();

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', { writable: true, value: '' });
    handler!(event);

    expect(flushPendingState).not.toHaveBeenCalled();
  });

  it('não age quando status não é in_progress', () => {
    const { flushPendingState } = setup({
      state: makeState({ status: 'submitted' }),
    });

    const handler = addEventSpy.mock.calls.find(c => c[0] === 'beforeunload')?.[1] as
      | ((e: BeforeUnloadEvent) => void)
      | undefined;
    expect(handler).toBeDefined();

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', { writable: true, value: '' });
    handler!(event);

    expect(flushPendingState).not.toHaveBeenCalled();
  });

  it('não age quando state é null', () => {
    const { flushPendingState } = setup({ state: null });

    const handler = addEventSpy.mock.calls.find(c => c[0] === 'beforeunload')?.[1] as
      | ((e: BeforeUnloadEvent) => void)
      | undefined;
    expect(handler).toBeDefined();

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', { writable: true, value: '' });
    handler!(event);

    expect(flushPendingState).not.toHaveBeenCalled();
  });

  it('cancela a subscrição de auth ao desmontar', () => {
    const { hook } = setup();
    const unsubscribe = getUnsubscribeMock();
    expect(unsubscribe).not.toBeNull();
    hook.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
