import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const config = vi.hoisted(() => ({ enabled: false }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => config.enabled }));

vi.mock('@/services/rankingApi', () => ({
  fetchCutoffScores: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }) }));
vi.mock('@/services/cutoffApi', () => ({ cutoffApi: { getScores: vi.fn() } }));

import { fetchCutoffScores } from '@/services/rankingApi';
import { useCutoffScores } from '@/hooks/useCutoffScores';
import { cutoffApi } from '@/services/cutoffApi';

const mockFetch = vi.mocked(fetchCutoffScores);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['app-config', 'u', 'editions_ui'], config.enabled);
  return React.createElement(QueryClientProvider, { client }, children);
}

const rows = [
  {
    institution_id: 'inst-1',
    institution_name: 'Universidade Federal da Bahia',
    practice_scenario: 'Hospital das Clínicas',
    specialty_name: 'PEDIATRIA',
    cutoff_score_general: 70,
    cutoff_score_quota: 60,
  },
];

describe('useCutoffScores', () => {
  beforeEach(() => { config.enabled = false; mockFetch.mockReset(); vi.mocked(cutoffApi.getScores).mockReset(); });

  it('uses the DB flag and fails closed even when an old caller supplies no scope', () => {
    config.enabled = true;
    renderHook(() => useCutoffScores('spec', ['inst']), { wrapper });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(cutoffApi.getScores).not.toHaveBeenCalled();
  });

  it('fails closed when opted in without a reference', () => {
    config.enabled = true;
    const { result } = renderHook(() => useCutoffScores('spec', ['inst'], { editionsUi: true, referenceEditionId: null }), { wrapper });
    expect(result.current.cutoffs).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(cutoffApi.getScores).not.toHaveBeenCalled();
  });
  it('preserves explicit enabled=false and uses the reference API only when opted in', async () => {
    config.enabled = true;
    vi.mocked(cutoffApi.getScores).mockResolvedValue([]);
    const { rerender } = renderHook(({ enabled }) => useCutoffScores('spec', ['inst'], { editionsUi: true, referenceEditionId: 'edition', enabled }), { wrapper, initialProps: { enabled: false } });
    expect(cutoffApi.getScores).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(cutoffApi.getScores).toHaveBeenCalledWith('spec', ['inst'], 'edition'));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('query desabilitada sem specialtyId', () => {
    const { result } = renderHook(() => useCutoffScores(null, ['inst-1']), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(result.current.cutoffs).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('query desabilitada sem instituições', () => {
    const { result } = renderHook(() => useCutoffScores('spec-1', []), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retorna as linhas quando habilitada', async () => {
    mockFetch.mockResolvedValue(rows);
    const { result } = renderHook(() => useCutoffScores('spec-1', ['inst-1']), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cutoffs).toEqual(rows);
    expect(mockFetch).toHaveBeenCalledWith('spec-1', ['inst-1']);
  });
});
