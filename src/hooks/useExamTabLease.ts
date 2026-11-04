import { useCallback, useEffect, useRef, useState } from 'react';
import { createExamTabLease, LEASE_HEARTBEAT_MS } from '@/lib/exam-tab-lease';

type Status = 'blocked' | 'syncing' | 'owned' | 'error';

/** BroadcastChannel is a notification only; storage election also works without it. */
export function useExamTabLease(userId: string | undefined, attemptId: string | null, reload: (signal: AbortSignal) => Promise<void>) {
  const [status, setStatus] = useState<Status>('blocked');
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const current = useRef<{ identity: string; lease: ReturnType<typeof createExamTabLease>; ready: boolean; takeover: () => void } | null>(null);
  const identity = userId && attemptId ? `${userId}:${attemptId}` : '';

  useEffect(() => {
    setStatus('blocked');
    if (!userId || !attemptId) return;
    let active = true;
    let syncing = false;
    let failed = false;
    let hidden = false;
    let syncController: AbortController | null = null;
    let generation = 0;
    let settledAt = Date.now() + 150;
    let lease: ReturnType<typeof createExamTabLease>;
    try { lease = createExamTabLease(userId, attemptId, crypto.randomUUID(), window.localStorage); }
    catch { setStatus('error'); return; }
    let channel: BroadcastChannel | undefined;
    try { if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(lease.prefix); } catch { /* storage fallback */ }
    function notify() { try { channel?.postMessage('changed'); } catch { /* best effort */ } }
    const scope = { identity, lease, ready: false, takeover: () => {
      scope.ready = false;
      generation++;
      syncController?.abort();
      syncing = false;
      failed = false;
      settledAt = Date.now() + 150;
      setStatus('syncing');
      lease.takeover(); notify();
    } };
    current.current = scope;
    async function inspect() {
      if (!active || hidden) return;
      if (!lease.isOwner()) {
        generation++;
        syncController?.abort();
        syncing = false;
        failed = false;
        scope.ready = false;
        setStatus(lease.isAvailable() ? 'blocked' : 'error');
        return;
      }
      if (scope.ready || syncing || failed || Date.now() < settledAt) return;
      lease.confirm();
      syncing = true;
      const run = ++generation;
      const controller = new AbortController();
      syncController = controller;
      const timeout = setTimeout(() => controller.abort(), 10000);
      let abortListener: () => void = () => undefined;
      setStatus('syncing');
      try {
        await Promise.race([
          reloadRef.current(controller.signal),
          new Promise<never>((_resolve, reject) => {
            abortListener = () => reject(new Error('Ownership sync cancelled or timed out'));
            controller.signal.addEventListener('abort', abortListener, { once: true });
          }),
        ]);
        if (active && generation === run && lease.isOwner()) {
          scope.ready = true;
          setStatus('owned');
        }
      } catch {
        if (active && generation === run) { failed = true; setStatus('error'); }
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', abortListener);
        if (generation === run) syncing = false;
      }
    }
    const changed = (event: StorageEvent) => { if (event.key?.startsWith(lease.prefix)) void inspect(); };
    if (channel) channel.onmessage = () => { void inspect(); };
    window.addEventListener('storage', changed);
    const pagehide = () => { hidden = true; scope.ready = false; generation++; syncController?.abort(); syncing = false; lease.release(); notify(); };
    const pageshow = () => { hidden = false; settledAt = Date.now() + 150; lease.heartbeat(); notify(); };
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    lease.heartbeat(); notify();
    const timer = setInterval(() => {
      if (hidden) return;
      // A throttled/suspended tab must reload again, never resurrect its old ready state.
      if (!lease.isOwner() && scope.ready) { scope.ready = false; generation++; syncing = false; }
      lease.heartbeat(); notify(); void inspect();
    }, LEASE_HEARTBEAT_MS);
    const settle = setTimeout(() => { void inspect(); }, 160);
    return () => {
      active = false; generation++; scope.ready = false;
      syncController?.abort();
      clearInterval(timer); clearTimeout(settle);
      window.removeEventListener('storage', changed);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      lease.release(); notify(); channel?.close();
      if (current.current === scope) current.current = null;
    };
  }, [identity, userId, attemptId]);

  const canWrite = useCallback(() => {
    const scope = current.current;
    return !!identity && scope?.identity === identity && scope.ready && scope.lease.isOwner();
  }, [identity]);
  const takeover = useCallback(() => { if (current.current?.identity === identity) current.current.takeover(); }, [identity]);
  return { status, canWrite, takeover, blocked: status !== 'owned' || !canWrite() };
}
