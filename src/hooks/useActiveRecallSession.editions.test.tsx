import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => true }));
vi.mock('@/hooks/useNotebookEditionFilter', () => ({ useNotebookEditionFilter: () => ({ ready: true, editionId: 'edition-b', invalid: false, catalog: { isError: false } }) }));
vi.mock('@/services/notebookApi', () => ({ notebookApi: { getAllRows: vi.fn().mockResolvedValue(Array.from({ length: 1500 }, (_, i) => ({ id: `e-${i}`, user_id: 'owner', reason: 'did_not_know', created_at: '2026-01-01', deleted_at: null, resolved_at: null, mastered_at: null, last_review_outcome: null }))) } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getErrorNotebook: vi.fn(), getErrorNotebookEntryForReview: vi.fn().mockResolvedValue(null), clearAwaitingLesson: vi.fn().mockResolvedValue(undefined) } }));
import { useActiveRecallSession } from '@/hooks/useActiveRecallSession';
import { notebookApi } from '@/services/notebookApi';
import { simuladosApi } from '@/services/simuladosApi';
import { NOTEBOOK_QUERY_PREFIXES } from '@/hooks/useNotebookPage';
describe('recall edition load boundary', () => {
  it('loads all 1500 metadata rows from the gated edition walker, not legacy', async () => {
    const { result } = renderHook(() => useActiveRecallSession('owner', 'Aluno'), { wrapper: ({ children }) => <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/caderno/revisao?mode=all&edition=edition-b']}>{children}</MemoryRouter></QueryClientProvider> });
    await waitFor(() => expect(result.current.entries).toHaveLength(1500));
    expect(notebookApi.getAllRows).toHaveBeenCalledWith({ editionId: 'edition-b' }, { editionsEnabled: true });
    expect(simuladosApi.getErrorNotebook).not.toHaveBeenCalled();
  });
  it('invalidates notebook datasets and insights after lesson unlock', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useActiveRecallSession('owner', 'Aluno'), { wrapper: ({ children }) => <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider> });
    await waitFor(() => expect(result.current.entries).toHaveLength(1500));
    await act(async () => { await result.current.handleLessonUnlock('e-0'); });
    expect(simuladosApi.clearAwaitingLesson).toHaveBeenCalledWith('e-0');
    for (const prefix of NOTEBOOK_QUERY_PREFIXES) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [prefix] });
    }
  });
});
