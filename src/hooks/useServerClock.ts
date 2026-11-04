import { useCallback, useEffect, useRef, useState } from 'react';
import { serverClockApi } from '@/services/serverClockApi';
import { logger } from '@/lib/logger';

export interface ServerClock {
  now: () => number;
  status: 'pending' | 'synced' | 'fallback';
  ready: boolean;
  resync?: () => void;
}

export function useServerClock(sessionKey: string): ServerClock {
  const anchorRef = useRef<{ epoch: number; mono: number; key: string } | null>(null);
  if (!anchorRef.current) anchorRef.current = { epoch: Date.now(), mono: performance.now(), key: sessionKey };
  const [sync, setSync] = useState<{ key: string; status: ServerClock['status'] }>({ key: sessionKey, status: 'pending' });
  const refreshRef = useRef<{ key: string; refresh: () => Promise<void> } | null>(null);
  const resync = useCallback(() => {
    if (refreshRef.current?.key === sessionKey) void refreshRef.current.refresh();
  }, [sessionKey]);
  const now = useCallback(() => {
    const anchor = anchorRef.current!;
    return anchor.epoch + performance.now() - anchor.mono;
  }, []);

  useEffect(() => {
    let active = true;
    let request = 0;
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    anchorRef.current = { epoch: Date.now(), mono: performance.now(), key: sessionKey };
    setSync({ key: sessionKey, status: 'pending' });
    let synced = false;
    const refresh = async () => {
      const sequence = ++request;
      if (!synced) setSync({ key: sessionKey, status: 'pending' });
      const startMono = performance.now();
      const startEpoch = now();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const server = await Promise.race([
          serverClockApi.getServerTime(),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => reject(new Error('Server clock timeout')), 5000);
            timeouts.add(timeout);
          }),
        ]);
        const endMono = performance.now();
        if (!active || sequence !== request) return;
        if (!Number.isFinite(server) || !Number.isFinite(endMono - startMono) || endMono < startMono) throw new Error('Invalid clock sample');
        const midpoint = startEpoch + (endMono - startMono) / 2;
        const offset = server - midpoint;
        anchorRef.current = { epoch: startEpoch + (endMono - startMono) + offset, mono: endMono, key: sessionKey };
        synced = true;
        setSync({ key: sessionKey, status: 'synced' });
      } catch {
        if (!active || sequence !== request) return;
        // Explicit degraded mode: keep the last monotonic anchor, never a new
        // OS-clock reading. Deadlines, write guards and scoring stay server-side.
        if (!synced) {
          logger.warn('[ServerClock] RPC unavailable; using monotonic local fallback');
          setSync({ key: sessionKey, status: 'fallback' });
        }
      } finally {
        if (timeout !== undefined) {
          clearTimeout(timeout);
          timeouts.delete(timeout);
        }
      }
    };
    refreshRef.current = { key: sessionKey, refresh };
    void refresh();
    const online = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      if (refreshRef.current?.refresh === refresh) refreshRef.current = null;
      timeouts.forEach(clearTimeout);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [sessionKey, now]);

  const status = sync.key === sessionKey ? sync.status : 'pending';
  return { now, status, ready: status !== 'pending', resync };
}
