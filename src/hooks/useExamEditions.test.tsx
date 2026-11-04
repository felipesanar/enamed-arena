import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useExamEditions } from '@/hooks/useExamEditions';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });
const setup = (data?: unknown[], enabled = true) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  if (data) client.setQueryData(['exam-editions'], data);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(() => useExamEditions(enabled), { wrapper }) };
};
describe('useExamEditions', () => {
  it('disabled never queries or exposes cached edition context', () => {
    const { result, client } = setup([{ id: 'old', status: 'planned', exam_date: null }], false);
    expect(rpc).not.toHaveBeenCalled();
    expect(result.current.nextEdition).toBeNull();
    client.clear();
  });
  it('reavalia virada do calendario em SP sem refetch e limpa timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-29T02:59:30Z'));
    const { result, unmount, client } = setup([
      { id: 'today', code: '2026', status: 'active', exam_date: '2026-11-28' },
      { id: 'tomorrow', code: '2027', status: 'active', exam_date: '2026-11-29' },
    ]);
    expect(result.current.nextEdition?.id).toBe('today');
    expect(result.current.now.toISOString()).toBe('2026-11-29T02:59:30.000Z');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.nextEdition?.id).toBe('tomorrow');
    expect(rpc).not.toHaveBeenCalled();
    unmount();
    client.clear();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('consulta RPC e deriva edicao sem data, com cache de uma hora', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'next', year: 2027, term: 1, status: 'planned', exam_date: null }], error: null });
    const { result, client } = setup();
    expect(result.current.nextEdition).toBeNull();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith('get_exam_editions');
    expect(result.current.nextEdition?.id).toBe('next');
    expect(client.getQueryCache().getAll()[0].options).toMatchObject({ staleTime: 3_600_000 });
    rpc.mockResolvedValue({ data: [{ id: 'next', year: 2099, term: 1, status: 'planned', exam_date: '2099-01-01' }], error: null });
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.nextEdition?.exam_date).toBe('2099-01-01'));
    client.clear();
  });
  it('erro permanece neutro, inclusive depois de sucesso em cache', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'next', year: 2099, status: 'planned', exam_date: '2099-01-01' }], error: null });
    const { result, client } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rpc.mockResolvedValue({ data: null, error: new Error('offline') });
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.nextEdition).toBeNull();
    client.clear();
  });
});
