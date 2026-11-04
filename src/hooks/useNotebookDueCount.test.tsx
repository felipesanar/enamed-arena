import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
vi.mock('@/services/notebookApi', () => ({ notebookApi: { getCounts: vi.fn().mockResolvedValue({ due: 1477 }) } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getErrorNotebook: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => true }));
import { useNotebookDueCount } from '@/hooks/useNotebookDueCount';
import { notebookApi } from '@/services/notebookApi';
import { simuladosApi } from '@/services/simuladosApi';
describe('notebook due count editions', () => {
  it('requests only current cumulative counts, never fetch-all', async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useNotebookDueCount('owner', true), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await waitFor(() => expect(result.current.data).toBe(1477));
    expect(notebookApi.getCounts).toHaveBeenCalledWith({}, { editionsEnabled: true });
    expect(simuladosApi.getErrorNotebook).not.toHaveBeenCalled();
  });
});
