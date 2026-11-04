import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const { getForSimulado } = vi.hoisted(() => ({ getForSimulado: vi.fn() }));
vi.mock('@/services/blueprintsApi', () => ({ blueprintsApi: { getForSimulado } }));
import { useEditionBlueprint } from './useEditionBlueprint';
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
describe('useEditionBlueprint', () => {
  it('flag false has explicit unknown status and no new reads', () => {
    getForSimulado.mockClear();
    const { result } = renderHook(() => useEditionBlueprint('sim', false), { wrapper });
    expect(result.current.status).toBe('unknown');
    expect(getForSimulado).not.toHaveBeenCalled();
  });
  it('reports loading and error without old weights; retry can recover', async () => {
    getForSimulado.mockRejectedValueOnce(new Error('missing blueprint')).mockResolvedValue({ editionId: 'edition-of-sim' });
    const { result } = renderHook(() => useEditionBlueprint('sim', true), { wrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeUndefined();
    await result.current.refetch();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(getForSimulado).toHaveBeenCalledWith('sim');
  });
});
