import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { act, renderHook } from '@testing-library/react';
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
  let fetchSpy: MockInstance<typeof fetch>;

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

  it('does not let a stale getSession overwrite a newer auth token', async () => {
    let resolve!: (value: any) => void;
    vi.mocked(supabase.auth.getSession).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { hook } = setup();
    const callback = vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0];
    act(() => { callback('TOKEN_REFRESHED', { access_token: 'new', user: { id: 'new-user' } } as any); });
    await act(async () => { resolve({ data: { session: { access_token: 'old', user: { id: 'old-user' } } } }); });
    expect(hook.result.current.current).toBe('new');
  });

  it('only sends a validated storage snapshot belonging to the current token user', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.invalid');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-key');
    const snapshot = { userId: 'u', attemptId: 'captured-attempt', state: makeState() };
    const storage = { flushPendingState: vi.fn(), attemptId: { current: 'wrong-ref' }, getPersistenceSnapshot: vi.fn(() => snapshot) };
    const hook = renderHook(() => useExamBeacon({ storage, stateRef: { current: makeState() }, hasFinalized: { current: false } }));
    const callback = vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0];
    act(() => { callback('SIGNED_IN', { access_token: 'current-token', user: { id: 'u' } } as any); });
    window.dispatchEvent(new Event('beforeunload'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1]!;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer current-token' });
    expect(JSON.parse(init.body as string)[0].attempt_id).toBe('captured-attempt');
    act(() => { callback('SIGNED_IN', { access_token: 'other-token', user: { id: 'other' } } as any); });
    window.dispatchEvent(new Event('beforeunload'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    storage.getPersistenceSnapshot.mockReturnValueOnce(null as any);
    window.dispatchEvent(new Event('beforeunload'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    hook.unmount();
    vi.unstubAllEnvs();
  });
});
