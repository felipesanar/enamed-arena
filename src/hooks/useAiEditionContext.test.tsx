import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  user: { id: 'user-a' } as { id: string } | null, flag: false,
  editions: vi.fn(), context: vi.fn(), invoke: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/services/editionsApi', () => ({ editionsApi: { getExamEditions: mocks.editions } }));
vi.mock('@/services/cutoffApi', () => ({ cutoffApi: { getUserContext: mocks.context } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
import { useAiEditionContext, useAiSummary } from '@/hooks/useAiEditionContext';

function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => {
    const value = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    for (const id of ['user-a', 'user-b']) value.setQueryData(['app-config', id, 'editions_ui'], mocks.flag);
    return value;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const edition = { id: 'ed-a', label: 'ENAMED A', format: { questions: 120, options: 5, duration_minutes: 300, scoring: 'tri' } };

describe('AI edition resolution and request lifecycle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.user = { id: 'user-a' }; mocks.flag = false;
    mocks.editions.mockReset().mockResolvedValue([edition]);
    mocks.context.mockReset().mockResolvedValue(null);
    mocks.invoke.mockReset().mockResolvedValue({ data: { markdown: 'summary' }, error: null });
  });
  it('flag false performs zero catalog reads and keeps legacy cutoff arguments', async () => {
    const { result } = renderHook(() => useAiEditionContext(['ed-a']), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.editions).not.toHaveBeenCalled();
    expect(mocks.context).toHaveBeenCalledWith('user-a', undefined);
    expect(result.current.editionContext).toBeNull();
  });
  it('flag true missing or mixed edition never makes a global cutoff/AI request', async () => {
    mocks.flag = true;
    const { result } = renderHook(() => useAiSummary({ kind: 'comparative', simuladoIds: ['one', 'two'], editionIds: ['ed-a', 'ed-b'], body: { scores: [1, 2] } }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canGenerate).toBe(false);
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('awaits cutoff, sends real context/IDs/percentile and generates only once', async () => {
    mocks.flag = true;
    const pending = deferred<null>(); mocks.context.mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(() => useAiSummary({ kind: 'ranking', simuladoIds: ['exam'], editionIds: ['ed-a'], percentile: 6, body: { userScore: 83 } }), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.context).toHaveBeenCalledWith('user-a', 'ed-a'));
    expect(mocks.invoke).not.toHaveBeenCalled();
    await act(async () => pending.resolve(null));
    await waitFor(() => expect(result.current.markdown).toBe('summary'));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.calls[0][1].body).toMatchObject({ simuladoId: 'exam', editionContext: { editionId: 'ed-a', percentile: 6, cutoffReference: null } });
    rerender();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it('ignores old-account in-flight response and never writes its cache', async () => {
    const pending = deferred<unknown>(); mocks.invoke.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(() => useAiSummary({ kind: 'performance', simuladoIds: ['exam'], editionIds: [], body: { score: 70 } }), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    mocks.user = { id: 'user-b' }; rerender();
    await waitFor(() => expect(result.current.markdown).toBe('summary'));
    await act(async () => pending.resolve({ data: { markdown: 'private user-a' }, error: null }));
    expect(result.current.markdown).toBe('summary');
    expect(Object.keys(sessionStorage).some(key => key.includes('user-a'))).toBe(false);
  });
  it('reprocessing intermediate scores invalidates the signature without double calls', async () => {
    const { result, rerender } = renderHook(({ middle }) => useAiSummary({ kind: 'comparative', simuladoIds: ['one', 'two', 'three'], editionIds: [], body: { scores: [50, middle, 70] } }), { wrapper: Wrapper, initialProps: { middle: 60 } });
    await waitFor(() => expect(result.current.markdown).toBe('summary'));
    rerender({ middle: 61 });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ middle: 61 });
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
  it('preserves screen on auto failure, does not loop, and manual retry works', async () => {
    mocks.invoke.mockResolvedValueOnce({ error: new Error('offline') });
    const { result, rerender } = renderHook(() => useAiSummary({ kind: 'performance', simuladoIds: ['exam'], editionIds: [], body: {} }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).toBe('offline'));
    rerender(); expect(mocks.invoke).toHaveBeenCalledTimes(1);
    await act(async () => result.current.generate());
    expect(result.current.markdown).toBe('summary');
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
  it('ignores an older exam/edition request and generates once for each new reference', async () => {
    mocks.flag = true;
    mocks.editions.mockResolvedValue([edition, { ...edition, id: 'ed-b', label: 'ENAMED B' }]);
    const pending = deferred<unknown>(); mocks.invoke.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(({ id, ed }) => useAiSummary({ kind: 'performance', simuladoIds: [id], editionIds: [ed], body: { score: 70 } }), { wrapper: Wrapper, initialProps: { id: 'exam-a', ed: 'ed-a' } });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    rerender({ id: 'exam-b', ed: 'ed-b' });
    await waitFor(() => expect(result.current.markdown).toBe('summary'));
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.context).toHaveBeenLastCalledWith('user-a', 'ed-b');
    await act(async () => pending.resolve({ data: { markdown: 'old exam text' }, error: null }));
    expect(result.current.markdown).toBe('summary');
    expect(Object.values(sessionStorage).some(value => value.includes('old exam text'))).toBe(false);
  });
  it('never sends unknown legacy cuts as a chance or fabricated reference', async () => {
    mocks.context.mockResolvedValue({ has_target_cutoff: true, stats: { avg: 60 }, matches: [{ cutoff_general: 60 }] });
    renderHook(() => useAiSummary({ kind: 'performance', simuladoIds: ['exam'], editionIds: [], body: { percentageScore: 80 } }), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(body.cutoffContext).toBeNull(); expect(body.editionContext).toBeUndefined();
  });
});
