import { logger } from '@/lib/logger';

export type QueueItem = {
  event_name: string;
  event_id: string;
  payload: Record<string, unknown>;
  client_timestamp: string;
  route: string;
};

type FlushFn = (batch: QueueItem[]) => Promise<void>;
type BeaconFn = (batch: QueueItem[]) => void;

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_SIZE = 20;
const MAX_RETRIES = 3;

let _queue: QueueItem[] = [];
let _timer: ReturnType<typeof setTimeout> | null = null;
let _flushFn: FlushFn | null = null;
let _beaconFn: BeaconFn | null = null;

export function initAnalyticsQueue(flush: FlushFn, beacon: BeaconFn): void {
  _flushFn = flush;
  _beaconFn = beacon;
  document.addEventListener('visibilitychange', _onVisibility);
  window.addEventListener('pagehide', _onPageHide);
}

export function enqueueAnalyticsEvent(item: QueueItem): void {
  _queue.push(item);
  if (_queue.length >= FLUSH_BATCH_SIZE) {
    _schedule(0);
  } else if (_timer === null) {
    _schedule(FLUSH_INTERVAL_MS);
  }
}

export function _resetForTests(): void {
  _queue = [];
  _timer = null;
  _flushFn = null;
  _beaconFn = null;
}

function _onVisibility() {
  if (document.visibilityState === 'hidden') _drainBeacon();
}

function _onPageHide() {
  _drainBeacon();
}

function _drainBeacon() {
  if (!_beaconFn || _queue.length === 0) return;
  const batch = _queue.splice(0, _queue.length);
  try { _beaconFn(batch); } catch { /* best-effort */ }
}

function _schedule(delayMs: number) {
  if (_timer !== null) clearTimeout(_timer);
  _timer = setTimeout(async () => {
    _timer = null;
    await _doFlush();
  }, delayMs);
}

async function _doFlush(): Promise<void> {
  if (!_flushFn || _queue.length === 0) return;
  const batch = _queue.splice(0, _queue.length);
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      await _flushFn(batch);
      return;
    } catch (err) {
      if (i === MAX_RETRIES) {
        logger.error('[analyticsQueue] flush falhou após retries — re-enfileirando', err);
        _queue.unshift(...batch);
        return;
      }
      await _sleep(200 * Math.pow(2, i));
    }
  }
}

function _sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}
