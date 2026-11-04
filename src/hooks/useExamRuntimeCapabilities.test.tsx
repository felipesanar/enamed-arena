import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/examRuntimeCapabilitiesApi', () => ({ examRuntimeCapabilitiesApi: { get } }));
import { useExamRuntimeCapabilities } from './useExamRuntimeCapabilities';
beforeEach(() => vi.resetAllMocks());
const v1 = { version: 1, answer_freshness_v1: true, safe_auto_finalize: false,
  question_explanations: false, attempt_counts: false, server_clock: false, exam_editions: false };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(({ user, attempt }) => useExamRuntimeCapabilities(user, attempt),
    { wrapper, initialProps: { user: 'u', attempt: 'a' } });
}
it('keeps pending/error distinct from confirmed legacy, then allows honest retry', async () => {
  let reject!: (error: unknown) => void;
  get.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; })).mockResolvedValue(null);
  const h = setup();
  expect(h.result.current.mode).toBe('pending');
  await act(async () => reject(new Error('network')));
  await waitFor(() => expect(h.result.current.mode).toBe('error'));
  act(() => h.result.current.retry());
  await waitFor(() => expect(h.result.current.mode).toBe('legacy'));
});
it('caches five minutes per identity and reprobes on ACK mismatch', async () => {
  get.mockResolvedValueOnce(null).mockResolvedValue(v1);
  const h = setup();
  await waitFor(() => expect(h.result.current.mode).toBe('legacy'));
  h.rerender({ user: 'u', attempt: 'a' });
  expect(get).toHaveBeenCalledTimes(1);
  const old = h.result.current.revision;
  act(() => h.result.current.retry());
  await waitFor(() => expect(h.result.current.mode).toBe('v1'));
  expect(h.result.current.revision).not.toBe(old);
});
it('isolates old asynchronous probes across user and attempt changes', async () => {
  let finish!: (value: unknown) => void;
  get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(v1);
  const h = setup();
  h.rerender({ user: 'other', attempt: 'b' });
  await waitFor(() => expect(h.result.current.mode).toBe('v1'));
  await act(async () => finish(null));
  expect(h.result.current.mode).toBe('v1');
});
it('adapts confirmed freshness false to legacy regardless of other capabilities', async () => {
  get.mockResolvedValue({ ...v1, answer_freshness_v1: false, safe_auto_finalize: true });
  const h = setup();
  await waitFor(() => expect(h.result.current.mode).toBe('legacy'));
});
