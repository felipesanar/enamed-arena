import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProvider, useUser } from '@/contexts/UserContext';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'u1' } as { id: string } | null, loading: false },
  enabled: false, from: vi.fn(), rpc: vi.fn(), getTarget: vi.fn(), setTargetEdition: vi.fn(),
  getExamEditions: vi.fn(), trackEvent: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.enabled }));
vi.mock('@/services/userEditionsApi', () => ({ userEditionsApi: mocks }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock('@/services/editionsApi', () => ({ editionsApi: { getExamEditions: mocks.getExamEditions } }));
vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}><UserProvider>{children}</UserProvider></QueryClientProvider>
);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth = { user: { id: 'u1' }, loading: false };
  mocks.enabled = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.from.mockImplementation((table: string) => ({ select: vi.fn(() => ({ eq: vi.fn((_key, id) => ({
    maybeSingle: vi.fn().mockResolvedValue({ error: null, data: table === 'profiles'
      ? { id, full_name: id, segment: 'guest' }
      : { id: 'onb', user_id: id, status: 'completed', specialty_id: null } }),
  })) })) }));
  mocks.rpc.mockResolvedValue({ data: [{ can_edit: true }], error: null });
  mocks.getTarget.mockResolvedValue({ targetEditionId: 'e1', expectedGraduationTerm: '2027.1' });
  mocks.setTargetEdition.mockResolvedValue(undefined);
  mocks.getExamEditions.mockResolvedValue([{ id: 'e1', code: '2028.2' }]);
});

describe('UserContext edition target', () => {
  it('does not read or write target fields with flag off', async () => {
    const { result } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.getTarget).not.toHaveBeenCalled();
    expect(result.current.onboarding).not.toHaveProperty('targetEditionId');
    await expect(result.current.saveTargetEdition(null, null)).rejects.toThrow();
    expect(mocks.setTargetEdition).not.toHaveBeenCalled();
    expect(mocks.getExamEditions).not.toHaveBeenCalled();
  });
  it('maps targets after flag activation and refreshes profile, guard and query cache after save', async () => {
    const { result, rerender } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mocks.enabled = true;
    rerender();
    await waitFor(() => expect(result.current.onboarding?.targetEditionId).toBe('e1'));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    client.setQueryData(['simulados', 'u1'], []);
    client.setQueryData(['simulados', 'u2'], []);
    client.setQueryData(['exam-editions'], []);
    mocks.getTarget.mockResolvedValue({ targetEditionId: null, expectedGraduationTerm: null });
    await act(() => result.current.saveTargetEdition(null, null));
    expect(mocks.setTargetEdition).toHaveBeenCalledWith(null, null);
    expect(result.current.onboarding?.targetEditionId).toBeNull();
    expect(result.current.isOnboardingComplete).toBe(true);
    expect(invalidate).toHaveBeenCalled();
    expect(client.getQueryState(['simulados', 'u1'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['simulados', 'u2'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['exam-editions'])?.isInvalidated).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith('get_onboarding_edit_guard_state', undefined);
  });
  it('ignores a save that finishes after another user signs in', async () => {
    mocks.enabled = true;
    const { result, rerender } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.onboarding?.userId).toBe('u1'));
    let finish!: () => void;
    mocks.setTargetEdition.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveTargetEdition('e2', null); });
    mocks.auth = { user: { id: 'u2' }, loading: false };
    rerender();
    await waitFor(() => expect(result.current.profile?.id).toBe('u2'));
    await act(async () => { finish(); await saving; });
    expect(result.current.profile?.id).toBe('u2');
    expect(result.current.onboarding?.userId).toBe('u2');
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });
  it('ignores an old profile fetch after logout and logging into the same account', async () => {
    mocks.enabled = true;
    let finish!: (value: { targetEditionId: string; expectedGraduationTerm: null }) => void;
    mocks.getTarget.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(mocks.getTarget).toHaveBeenCalledTimes(1));
    mocks.auth = { user: null, loading: false };
    rerender();
    expect(result.current.profile).toBeNull();
    mocks.auth = { user: { id: 'u1' }, loading: false };
    rerender();
    await waitFor(() => expect(result.current.onboarding?.targetEditionId).toBe('e1'));
    await act(async () => { finish({ targetEditionId: 'stale', expectedGraduationTerm: null }); });
    expect(result.current.onboarding?.targetEditionId).toBe('e1');
  });
  it('does not apply a previous user guard response or save after logout', async () => {
    mocks.enabled = true;
    const { result, rerender } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let finishGuard!: (value: unknown) => void;
    mocks.rpc.mockImplementationOnce(() => new Promise(resolve => { finishGuard = resolve; }));
    let guard!: Promise<void>;
    act(() => { guard = result.current.refreshOnboardingEditGuard(); });
    let finishSave!: () => void;
    mocks.setTargetEdition.mockImplementationOnce(() => new Promise<void>(resolve => { finishSave = resolve; }));
    let save!: Promise<void>;
    act(() => { save = result.current.saveTargetEdition('e2', null); });
    mocks.auth = { user: null, loading: false };
    rerender();
    await act(async () => {
      finishGuard({ data: [{ can_edit: false, reason: 'old', next_edit_available_at: 'old-date' }], error: null });
      finishSave();
      await Promise.all([guard, save]);
    });
    expect(result.current.profile).toBeNull();
    expect(result.current.onboarding).toBeNull();
    expect(result.current.onboardingEditLocked).toBe(false);
    expect(result.current.onboardingNextEditableAt).toBeNull();
  });
  it('propagates target save errors without overwriting onboarding or invalidating cache', async () => {
    mocks.enabled = true;
    const { result } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.onboarding?.targetEditionId).toBe('e1'));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    mocks.setTargetEdition.mockRejectedValueOnce(new Error('invalid edition'));
    await act(async () => {
      await expect(result.current.saveTargetEdition('missing', null)).rejects.toThrow('invalid edition');
    });
    expect(result.current.onboarding?.targetEditionId).toBe('e1');
    expect(invalidate).not.toHaveBeenCalled();
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });
  it('keeps the existing save signature with the flag off', async () => {
    const { result } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mocks.rpc.mockResolvedValueOnce({ data: { user_id: 'u1', status: 'completed' }, error: null });
    await act(() => result.current.saveOnboarding({ specialtyId: null, targetInstitutionIds: [] }));
    expect(mocks.rpc).toHaveBeenCalledWith('save_onboarding_guarded', { p_specialty_id: null, p_target_institution_ids: [] });
    expect(mocks.getTarget).not.toHaveBeenCalled();
  });
  it('keeps target fields when an academic save refreshes the enabled profile', async () => {
    mocks.enabled = true;
    const { result } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.onboarding?.targetEditionId).toBe('e1'));
    await act(() => result.current.saveOnboarding({ specialtyId: null, targetInstitutionIds: [] }));
    expect(result.current.onboarding?.targetEditionId).toBe('e1');
    expect(result.current.onboarding?.expectedGraduationTerm).toBe('2027.1');
  });
  it('refetches after an auth-loading transition interrupts a flag-triggered fetch', async () => {
    const { result, rerender } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let finish!: (value: unknown) => void;
    mocks.getTarget.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mocks.enabled = true;
    rerender();
    await waitFor(() => expect(mocks.getTarget).toHaveBeenCalledTimes(1));
    mocks.auth = { user: { id: 'u1' }, loading: true };
    rerender();
    mocks.auth = { user: { id: 'u1' }, loading: false };
    rerender();
    await act(async () => { finish({ targetEditionId: 'old', expectedGraduationTerm: null }); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.onboarding?.targetEditionId).toBe('e1');
  });
  it('emits the real catalog code only after a confirmed target save', async () => {
    mocks.enabled = true;
    const { result } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let finish!: () => void;
    mocks.setTargetEdition.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveTargetEdition('e1', '2027.1'); });
    expect(mocks.trackEvent).not.toHaveBeenCalled();
    expect(mocks.getExamEditions).not.toHaveBeenCalled();
    await act(async () => { finish(); await saving; });
    expect(mocks.trackEvent).toHaveBeenCalledExactlyOnceWith('target_edition_set', { edition_code: '2028.2' });
  });
  it('emits null for undecided without inferring code from the graduation term', async () => {
    mocks.enabled = true;
    const { result } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.saveTargetEdition(null, '2027.1'));
    expect(mocks.trackEvent).toHaveBeenCalledExactlyOnceWith('target_edition_set', { edition_code: null });
    expect(mocks.getExamEditions).not.toHaveBeenCalled();
  });
  it.each(['catalog', 'missing', 'analytics', 'async analytics'])('%s telemetry failure does not reject a confirmed save', async failure => {
    mocks.enabled = true;
    const { result } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    if (failure === 'catalog') mocks.getExamEditions.mockRejectedValueOnce(new Error('catalog unavailable'));
    if (failure === 'missing') mocks.getExamEditions.mockResolvedValueOnce([]);
    if (failure === 'analytics') mocks.trackEvent.mockImplementationOnce(() => { throw new Error('analytics unavailable'); });
    if (failure === 'async analytics') mocks.trackEvent.mockRejectedValueOnce(new Error('analytics unavailable'));
    await act(async () => {
      await expect(result.current.saveTargetEdition('e1', null)).resolves.toBeUndefined();
    });
    expect(result.current.onboarding?.userId).toBe('u1');
    expect(result.current.isOnboardingComplete).toBe(true);
    expect(mocks.getExamEditions).toHaveBeenCalledTimes(1);
    if (failure === 'catalog' || failure === 'missing') expect(mocks.trackEvent).not.toHaveBeenCalled();
    else expect(mocks.trackEvent).toHaveBeenCalledExactlyOnceWith('target_edition_set', { edition_code: '2028.2' });
  });
  it.each(['logout', 'switch'])('discards telemetry when the catalog resolves after %s', async transition => {
    mocks.enabled = true;
    const { result, rerender } = renderHook(useUser, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let finish!: (value: unknown) => void;
    mocks.getExamEditions.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveTargetEdition('e1', null); });
    await waitFor(() => expect(mocks.getExamEditions).toHaveBeenCalledTimes(1));
    const nextId = transition === 'logout' ? null : 'u2';
    mocks.auth = { user: nextId ? { id: nextId } : null, loading: false };
    rerender();
    await waitFor(() => expect(result.current.profile?.id ?? null).toBe(nextId));
    await act(async () => { finish([{ id: 'e1', code: '2028.2' }]); await saving; });
    expect(mocks.trackEvent).not.toHaveBeenCalled();
    expect(result.current.onboarding?.userId ?? null).toBe(nextId);
  });
});
