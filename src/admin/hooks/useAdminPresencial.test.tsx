import { expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminPresencialSessionUpsert } from '@/admin/hooks/useAdminPresencial';
import { adminApi } from '@/admin/services/adminApi';
vi.mock('@/admin/services/adminApi');
it('propagates explicit ranking rule through the typed mutation and invalidates session list', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  vi.mocked(adminApi.presencialSessionUpsert).mockResolvedValue('id');
  const values = { id: null, simulado_id: 's', code: 'sala', label: 'Sala', opens_at: '2027-01-01T11:00:00Z', closes_at: '2027-01-01T15:00:00Z', is_active: true, ranking_rule: 'session_window_v1' as const };
  const { result } = renderHook(() => useAdminPresencialSessionUpsert(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  act(() => result.current.mutate(values));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(adminApi.presencialSessionUpsert).toHaveBeenCalledWith(values);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'presencial-sessions'] });
});
