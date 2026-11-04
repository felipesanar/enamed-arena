import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAppConfig } from '@/hooks/useAppConfig';

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  error: vi.fn(), auth: { user: { id: 'u1' } as { id: string } | null, loading: false } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.error } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.auth.user = { id: 'u1' }; mocks.auth.loading = false; });

function setup() {
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(() => useAppConfig('editions_ui'), { wrapper }) };
}

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
