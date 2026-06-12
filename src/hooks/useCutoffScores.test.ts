import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/rankingApi', () => ({
  fetchCutoffScores: vi.fn(),
}));

import { fetchCutoffScores } from '@/services/rankingApi';
import { useCutoffScores } from '@/hooks/useCutoffScores';

const mockFetch = vi.mocked(fetchCutoffScores);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  beforeEach(() => mockFetch.mockReset());

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
