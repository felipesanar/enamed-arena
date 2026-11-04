import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: { id: 'a' }, flag: false, getUserContext: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/cutoffApi', () => ({ cutoffApi: { getUserContext: mocks.getUserContext } }));
import { useCutoffContext } from '@/hooks/useCutoffContext';
function wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => {
    const value = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    for (const id of ['a', 'b']) value.setQueryData(['app-config', id, 'editions_ui'], mocks.flag);
    return value;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
describe('useCutoffContext scope isolation', () => {
  beforeEach(() => { mocks.user = { id: 'a' }; mocks.flag = false; mocks.getUserContext.mockReset().mockResolvedValue(null); });
  it('does not let an old unscoped caller resolve a global reference with the DB flag on', () => {
    mocks.flag = true;
    renderHook(() => useCutoffContext(), { wrapper });
    expect(mocks.getUserContext).not.toHaveBeenCalled();
  });
  it('does not issue a legacy request while the DB flag is still unknown', () => {
    const pendingWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
    renderHook(() => useCutoffContext(), { wrapper: pendingWrapper });
    expect(mocks.getUserContext).not.toHaveBeenCalled();
  });
  it('preserves the legacy call but never sends a null reference with editions enabled', async () => {
    const { result, rerender } = renderHook(({ editionsUi }) => useCutoffContext({ editionsUi, referenceEditionId: null }), { wrapper, initialProps: { editionsUi: false } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.getUserContext).toHaveBeenCalledWith('a', undefined);
    mocks.flag = true;
    mocks.getUserContext.mockClear(); rerender({ editionsUi: true });
    expect(result.current.cutoffContext).toBeNull();
    expect(mocks.getUserContext).not.toHaveBeenCalled();
  });
  it('changes reference exactly once and never exposes an old response after account switch', async () => {
    mocks.flag = true;
    let resolve!: (value: unknown) => void;
    mocks.getUserContext.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result, rerender } = renderHook(({ id }) => useCutoffContext({ editionsUi: true, referenceEditionId: id }), { wrapper, initialProps: { id: 'old' } });
    await waitFor(() => expect(mocks.getUserContext).toHaveBeenCalledTimes(1));
    mocks.user = { id: 'b' }; rerender({ id: 'new' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.getUserContext).toHaveBeenCalledTimes(2);
    await act(async () => resolve({ specialty: 'private old user' }));
    expect(result.current.cutoffContext).toBeNull();
    rerender({ id: 'new' }); expect(mocks.getUserContext).toHaveBeenCalledTimes(2);
  });
  it('does not expose context returned for a different reference', async () => {
    mocks.flag = true;
    mocks.getUserContext.mockResolvedValue({ reference_edition_id: 'other', matches: [] });
    const { result } = renderHook(() => useCutoffContext({ editionsUi: true, referenceEditionId: 'selected' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cutoffContext).toBeNull();
  });
});
