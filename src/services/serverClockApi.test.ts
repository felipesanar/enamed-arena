import { expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { serverClockApi } from '@/services/serverClockApi';
it('validates the RPC timestamp and propagates failures', async () => {
  rpc.mockResolvedValueOnce({ data: '2026-01-01T00:00:00Z', error: null });
  expect(await serverClockApi.getServerTime()).toBe(Date.parse('2026-01-01T00:00:00Z'));
  expect(rpc).toHaveBeenCalledWith('get_server_time');
  rpc.mockResolvedValueOnce({ data: 'bad', error: null });
  await expect(serverClockApi.getServerTime()).rejects.toThrow();
  rpc.mockResolvedValueOnce({ error: new Error('offline') });
  await expect(serverClockApi.getServerTime()).rejects.toThrow('offline');
});
