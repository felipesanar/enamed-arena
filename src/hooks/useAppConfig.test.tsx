import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAppConfig, useAppConfigState } from '@/hooks/useAppConfig';

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  error: vi.fn(), auth: { user: { id: 'u1' } as { id: string } | null, loading: false } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.error } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.auth.user = { id: 'u1' }; mocks.auth.loading = false; });

function setupHook<T>(read: () => T) {
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(read, { wrapper }) };
}
const setup = () => setupHook(() => useAppConfig('editions_ui'));
const setupState = () => setupHook(() => useAppConfigState('editions_ui'));

describe('useAppConfig', () => {
  it.each([true, false, 'true', 1, null, { enabled: true }])('somente boolean true habilita: %j', async (value) => {
    mocks.maybeSingle.mockResolvedValue({ data: { value }, error: null });
    const { result, client } = setup();
    expect(result.current).toBe(false);
    await waitFor(() => expect(client.getQueryCache().getAll()[0].state.status).toBe('success'));
    expect(result.current).toBe(value === true);
    expect(mocks.from).toHaveBeenCalledWith('app_config');
    expect(mocks.select).toHaveBeenCalledWith('value');
    expect(mocks.eq).toHaveBeenCalledWith('key', 'editions_ui');
  });
  it.each([{ data: null, error: null }, { data: null, error: { code: '42P01' } }])('ausencia/tabela inexistente falha fechada', async (response) => {
    mocks.maybeSingle.mockResolvedValue(response);
    const { result, client } = setup();
    await waitFor(() => expect(client.getQueryCache().getAll()[0].state.fetchStatus).toBe('idle'));
    expect(result.current).toBe(false);
    if (response.error) expect(mocks.error).toHaveBeenCalled();
  });
  it.each(['error', 'true', 'missing'] as const)('preserva true durante refetch pendente e aplica resultado final: %s', async (outcome) => {
    mocks.maybeSingle.mockResolvedValue({ data: { value: true }, error: null });
    const { result, client, rerender } = setup();
    await waitFor(() => expect(result.current).toBe(true));
    let settle: (response: { data: { value: boolean } | null; error: Error | null }) => void;
    const pending = new Promise((resolve) => { settle = resolve; });
    mocks.maybeSingle.mockReturnValueOnce(pending);
    let refresh: Promise<void>;
    act(() => { refresh = client.refetchQueries(); });
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(2));
    expect(client.getQueryCache().getAll()[0].state.fetchStatus).toBe('fetching');
    rerender();
    expect(result.current).toBe(true);
    await act(async () => {
      settle({ data: outcome === 'true' ? { value: true } : null, error: outcome === 'error' ? new Error('offline') : null });
      await refresh;
    });
    await waitFor(() => expect(result.current).toBe(outcome === 'true'));
    if (outcome === 'error') expect(mocks.error).toHaveBeenCalled();
  });
  it('logout/troca de usuario nao reaproveita flag e login consulta novamente', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { value: true }, error: null });
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current).toBe(true));
    mocks.auth.user = null;
    rerender();
    expect(result.current).toBe(false);
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
    mocks.maybeSingle.mockResolvedValue({ data: { value: false }, error: null });
    mocks.auth.user = { id: 'u2' };
    rerender();
    expect(result.current).toBe(false);
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(2));
  });
  it('loading de autenticacao nao exibe true em cache', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { value: true }, error: null });
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current).toBe(true));
    mocks.auth.loading = true;
    rerender();
    expect(result.current).toBe(false);
  });
});

describe('useAppConfigState', () => {
  it('distinguishes an initial deferred read from a disabled flag', async () => {
    let resolve: (response: { data: { value: boolean }; error: null }) => void;
    mocks.maybeSingle.mockReturnValue(new Promise(settle => { resolve = settle; }));
    const { result } = setupState();
    expect(result.current).toEqual({ enabled: false, isPending: true });
    await act(async () => { resolve({ data: { value: true }, error: null }); });
    await waitFor(() => expect(result.current).toEqual({ enabled: true, isPending: false }));
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('waits for authentication but settles disabled when logged out', () => {
    mocks.auth.user = null; mocks.auth.loading = true;
    const { result, rerender } = setupState();
    expect(result.current).toEqual({ enabled: false, isPending: true });
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
    mocks.auth.loading = false; rerender();
    expect(result.current).toEqual({ enabled: false, isPending: false });
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it.each([{ data: { value: false }, error: null }, { data: null, error: new Error('offline') }])(
    'settles fail-closed on disabled or error responses', async response => {
      mocks.maybeSingle.mockResolvedValue(response);
      const { result } = setupState();
      expect(result.current.isPending).toBe(true);
      await waitFor(() => expect(result.current).toEqual({ enabled: false, isPending: false }));
    });

  it('does not reuse enabled state for another account or a late response after logout', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { value: true }, error: null });
    const { result, rerender } = setupState();
    await waitFor(() => expect(result.current.enabled).toBe(true));
    let resolve: (response: { data: { value: boolean }; error: null }) => void;
    mocks.maybeSingle.mockReturnValue(new Promise(settle => { resolve = settle; }));
    mocks.auth.user = { id: 'u2' }; rerender();
    expect(result.current).toEqual({ enabled: false, isPending: true });
    mocks.auth.user = null; rerender();
    expect(result.current).toEqual({ enabled: false, isPending: false });
    await act(async () => { resolve({ data: { value: true }, error: null }); });
    expect(result.current).toEqual({ enabled: false, isPending: false });
  });
});
