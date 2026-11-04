import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExamTabLease } from './useExamTabLease';
import { createExamTabLease } from '@/lib/exam-tab-lease';

describe('tab ownership hooks', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('fails closed when the localStorage property getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const h = renderHook(() => useExamTabLease('u', 'a', vi.fn()));
    expect(h.result.current.status).toBe('error');
    expect(h.result.current.canWrite()).toBe(false);
  });
  it.each(['getItem', 'setItem'] as const)('reports storage failure for %s without BroadcastChannel', async method => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const reload = vi.fn();
    const h = renderHook(() => useExamTabLease('u', 'a', reload));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(h.result.current.status).toBe('error');
    expect(h.result.current.canWrite()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
  it('allows only one of two tabs, reloads before interaction, and supports takeover', async () => {
    const reloadA = vi.fn().mockResolvedValue(undefined);
    let finish!: () => void;
    const reloadB = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const a = renderHook(() => useExamTabLease('u', 'attempt', reloadA));
    const b = renderHook(() => useExamTabLease('u', 'attempt', reloadB));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(Number(a.result.current.canWrite()) + Number(b.result.current.canWrite())).toBeLessThanOrEqual(1);
    act(() => b.result.current.takeover());
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(a.result.current.canWrite()).toBe(false);
    expect(b.result.current.canWrite()).toBe(false);
    await act(async () => { finish(); });
    expect(b.result.current.canWrite()).toBe(true);
    a.unmount(); b.unmount();
    expect(localStorage.length).toBe(0);
  });
  it('cleans up on logout and does not grant interaction from an old reload', async () => {
    let finish!: () => void;
    const reload = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const h = renderHook(({ user }) => useExamTabLease(user, 'attempt', reload), { initialProps: { user: 'u' as string | undefined } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    h.rerender({ user: undefined });
    await act(async () => { finish(); });
    expect(h.result.current.canWrite()).toBe(false);
    expect(localStorage.length).toBe(0);
  });
  it('times out a stalled reload, aborts it and allows explicit recovery', async () => {
    let signal: AbortSignal | undefined;
    const reload = vi.fn((value: AbortSignal) => { signal = value; return new Promise<void>(() => {}); });
    const h = renderHook(() => useExamTabLease('u', 'attempt', reload));
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(h.result.current.status).toBe('error');
    expect(h.result.current.canWrite()).toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    reload.mockImplementationOnce(async () => {});
    act(() => h.result.current.takeover());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(h.result.current.canWrite()).toBe(true);
  });
  it('uses storage-only notifications and reloads after user/attempt changes', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const reload = vi.fn().mockResolvedValue(undefined);
    const h = renderHook(({ user, attempt }) => useExamTabLease(user, attempt, reload),
      { initialProps: { user: 'u', attempt: 'a' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(h.result.current.canWrite()).toBe(true);
    const peer = createExamTabLease('u', 'a', 'remote', localStorage);
    act(() => {
      peer.takeover();
      window.dispatchEvent(new StorageEvent('storage', { key: peer.prefix + 'remote' }));
    });
    expect(h.result.current.canWrite()).toBe(false);
    h.rerender({ user: 'other', attempt: 'b' });
    expect(h.result.current.canWrite()).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(h.result.current.canWrite()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
  it('cannot regain ownership from BFCache when another tab took control', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const reload = vi.fn().mockResolvedValue(undefined);
    const h = renderHook(() => useExamTabLease('u', 'a', reload));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(h.result.current.canWrite()).toBe(false);
    const peer = createExamTabLease('u', 'a', 'remote', localStorage);
    peer.takeover(); peer.confirm();
    act(() => window.dispatchEvent(new Event('pageshow')));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(h.result.current.canWrite()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    act(() => h.result.current.takeover());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(h.result.current.canWrite()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
