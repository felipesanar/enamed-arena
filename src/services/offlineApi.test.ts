import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn(), track: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: mocks.maybeSingle }; return q; },
} }));
vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.track }));
import { offlineApi } from './offlineApi';
describe('offline API authority and metrics', () => {
  beforeEach(() => vi.resetAllMocks());
  it('distinguishes a database error from confirmed absence', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error('network') });
    await expect(offlineApi.getActiveOfflineAttempt('u', 's')).rejects.toThrow('network');
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(offlineApi.getActiveOfflineAttempt('u', 's')).resolves.toBeNull();
  });
  it('includes simulation ID but no raw error in failed telemetry', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('private server text') });
    await expect(offlineApi.submitOfflineAnswers('a', [], 's')).rejects.toThrow();
    expect(mocks.track).toHaveBeenCalledWith('offline_answers_submit_failed', { attempt_id: 'a', simulado_id: 's', status: 'error' });
  });
  it('telemetry failure cannot turn a successful write into a failed submission', async () => {
    mocks.rpc.mockResolvedValue({ data: { attempt_id: 'a', is_within_window: false }, error: null });
    mocks.track.mockImplementation(() => { throw new Error('telemetry'); });
    await expect(offlineApi.submitOfflineAnswers('a', [], 's')).resolves.toEqual({ attempt_id: 'a', is_within_window: false });
  });
  it('records transport failures with simulation identity and no raw error', async () => {
    mocks.rpc.mockRejectedValue(new Error('network private details'));
    await expect(offlineApi.submitOfflineAnswers('a', [], 's')).rejects.toThrow('network private details');
    expect(mocks.track).toHaveBeenCalledWith('offline_answers_submit_failed', { attempt_id: 'a', simulado_id: 's', status: 'error' });
  });
});
