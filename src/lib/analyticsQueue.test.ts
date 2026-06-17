import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enqueueAnalyticsEvent, initAnalyticsQueue, _resetForTests } from './analyticsQueue';
import type { QueueItem } from './analyticsQueue';

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function makeItem(n = 1): QueueItem {
  return {
    event_name: `test_event_${n}`,
    event_id: `uuid-${n}`,
    payload: { x: n },
    client_timestamp: '2026-06-17T00:00:00Z',
    route: '/test',
  };
}

describe('analyticsQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('chama flush após FLUSH_INTERVAL_MS quando há eventos', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    initAnalyticsQueue(flush, vi.fn());
    enqueueAnalyticsEvent(makeItem(1));
    expect(flush).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([makeItem(1)]);
  });

  it('chama flush imediatamente ao atingir FLUSH_BATCH_SIZE', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    initAnalyticsQueue(flush, vi.fn());
    for (let i = 1; i <= 20; i++) enqueueAnalyticsEvent(makeItem(i));
    await vi.runAllTimersAsync();
    expect(flush).toHaveBeenCalled();
    const batch = flush.mock.calls[0][0] as QueueItem[];
    expect(batch).toHaveLength(20);
  });

  it('re-enfileira batch se flush falhar em todas as tentativas', async () => {
    const { logger } = await import('@/lib/logger');
    const flush = vi.fn().mockRejectedValue(new Error('network'));
    initAnalyticsQueue(flush, vi.fn());
    enqueueAnalyticsEvent(makeItem(1));
    await vi.runAllTimersAsync();
    expect(logger.error).toHaveBeenCalled();
    // flush tenta 4x (0, 1, 2, 3 = MAX_RETRIES+1)
    expect(flush.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('chama beacon ao invés de flush em visibilitychange:hidden', () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const beacon = vi.fn();
    initAnalyticsQueue(flush, beacon);
    enqueueAnalyticsEvent(makeItem(1));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).toHaveBeenCalledWith([makeItem(1)]);
    expect(flush).not.toHaveBeenCalled();
  });

  it('não chama beacon se a fila estiver vazia', () => {
    const beacon = vi.fn();
    initAnalyticsQueue(vi.fn(), beacon);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).not.toHaveBeenCalled();
  });
});
