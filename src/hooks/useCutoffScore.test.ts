import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/rankingApi', () => ({
  fetchCutoffScore: vi.fn(),
}));

import { fetchCutoffScore } from '@/services/rankingApi';
import { useCutoffScore } from '@/hooks/useCutoffScore';

const mockFetch = vi.mocked(fetchCutoffScore);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

const mockRow = {
  institution_name: 'UFBA',
  practice_scenario: 'Hospital das Clínicas',
  specialty_name: 'Pediatria',
  cutoff_score_general: 70,
  cutoff_score_quota: 60,
};

describe('useCutoffScore', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns loading=false and cutoff=null when specialty is empty — query disabled', () => {
    const { result } = renderHook(() => useCutoffScore('', 'UFBA'), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(result.current.cutoff).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns loading=false and cutoff=null when institution is empty — query disabled', () => {
    const { result } = renderHook(() => useCutoffScore('Pediatria', ''), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(result.current.cutoff).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns cutoff data when fetch resolves with a match', async () => {
    mockFetch.mockResolvedValue(mockRow);
    const { result } = renderHook(
      () => useCutoffScore('Pediatria', 'UFBA'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cutoff).toEqual(mockRow);
  });

  it('returns cutoff=null when fetch resolves with null (no match)', async () => {
    mockFetch.mockResolvedValue(null);
    const { result } = renderHook(
      () => useCutoffScore('Pediatria', 'UnknownHospital'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cutoff).toBeNull();
  });
});
