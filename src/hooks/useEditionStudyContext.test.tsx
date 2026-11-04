import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ExamEdition } from '@/types/edition';
import { useEditionStudyContext } from '@/hooks/useEditionStudyContext';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'u1' } as { id: string } | null, loading: false },
  account: { profile: { id: 'u1' }, isLoading: false },
  editions: { userEdition: null as ExamEdition | null, isPending: false, isError: false,
    isSuccess: true, now: new Date('2026-11-04T12:00:00Z'), refetch: vi.fn() },
  getForEdition: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => mocks.account }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: () => mocks.editions }));
vi.mock('@/services/blueprintsApi', () => ({ blueprintsApi: { getForEdition: mocks.getForEdition } }));
const edition = (id = 'target'): ExamEdition => ({ id, code: id, label: `ENAMED ${id}`, year: 2027, term: 1,
  status: 'planned', exam_date: '2027-06-01', exam_date_confirmed: true, official_results_at: null,
  blueprint_id: 'b', format: { questions: 120, options: 5, duration_minutes: 300, scoring: 'raw' }, created_at: '', updated_at: '' });
const matrix = (id = 'target') => ({ editionId: id, blueprint: { id: 'b', code: 'b', label: 'Matriz', weights_provisional: true,
  areas: [{ id: 'a', blueprint_id: 'b', code: 'ped', label: 'Pediatria', aliases: [], weight: 1, sort_order: 1 }] } });
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => { mocks.auth.user = { id: 'u1' }; mocks.account.profile.id = 'u1'; mocks.account.isLoading = false;
  mocks.editions.userEdition = edition(); mocks.getForEdition.mockReset().mockResolvedValue(matrix()); });
afterEach(cleanup);
describe('useEditionStudyContext', () => {
  it('loads the resolved target directly with provisional weights and validated format', async () => {
    const { result } = renderHook(() => useEditionStudyContext(true), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.getForEdition).toHaveBeenCalledWith('target');
    expect(result.current.context).toMatchObject({ edition: { id: 'target' }, matrixStatus: 'provisional', format: { questions: 120 }, areaWeights: [{ weight: 1 }] });
  });
  it('disabled, logout and unresolved account never query or expose cached target', () => {
    const { result, rerender } = renderHook(({ enabled }) => useEditionStudyContext(enabled), { wrapper, initialProps: { enabled: false } });
    expect(result.current.context.edition).toBeNull();
    mocks.auth.user = null; rerender({ enabled: true });
    expect(result.current.context.edition).toBeNull();
    expect(mocks.getForEdition).not.toHaveBeenCalled();
  });
  it('hides old weights immediately on target/account changes and ignores stale completion', async () => {
    let finish!: (value: unknown) => void;
    mocks.getForEdition.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(() => useEditionStudyContext(true), { wrapper });
    await waitFor(() => expect(mocks.getForEdition).toHaveBeenCalledWith('target'));
    mocks.editions.userEdition = edition('new'); mocks.getForEdition.mockResolvedValue(matrix('new')); rerender();
    expect(result.current.context.areaWeights).toEqual([]);
    await waitFor(() => expect(result.current.context.edition?.id).toBe('new'));
    finish(matrix());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.context.edition?.id).toBe('new');
    mocks.auth.user = { id: 'u2' }; rerender();
    expect(result.current.context.edition).toBeNull();
  });
  it('missing matrix stays neutral and invalid or unconfirmed dates never become an official countdown', async () => {
    mocks.getForEdition.mockRejectedValue(new Error('missing'));
    mocks.editions.userEdition = { ...edition(), format: {}, exam_date_confirmed: false };
    const { result } = renderHook(() => useEditionStudyContext(true), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.context).toMatchObject({ date: null, daysUntil: null, format: null, matrixStatus: 'unavailable', areaWeights: [] });
  });
  it('flag off clears an already loaded context and does not start another matrix request', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useEditionStudyContext(enabled), { wrapper, initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.context.matrixStatus).toBe('provisional'));
    rerender({ enabled: false }); expect(result.current.context.edition).toBeNull(); expect(result.current.context.areaWeights).toEqual([]);
    expect(mocks.getForEdition).toHaveBeenCalledTimes(1);
  });
});
