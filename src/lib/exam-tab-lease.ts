export const LEASE_TTL_MS = 6000;
export const LEASE_HEARTBEAT_MS = 1000;
interface Candidate { tabId: string; epoch: number; expiresAt: number; confirmed?: boolean }

/** One key per contender avoids a read/modify/write race on a shared owner key. */
export function createExamTabLease(userId: string, attemptId: string, tabId: string, storage: Storage, now = Date.now) {
  const prefix = `exam_lease_v1:${encodeURIComponent(userId)}:${encodeURIComponent(attemptId)}:`;
  const key = prefix + tabId;
  let epoch = 0;
  let confirmed = false;
  let available = true;
  function candidates(): Candidate[] {
    const peers: Candidate[] = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const name = storage.key(i);
        if (!name?.startsWith(prefix)) continue;
        const value = JSON.parse(storage.getItem(name) ?? 'null') as Candidate | null;
        if (value && typeof value.tabId === 'string' && Number.isFinite(value.epoch) &&
          Number.isFinite(value.expiresAt) && value.expiresAt > now()) peers.push(value);
      }
    } catch { available = false; }
    return peers.sort((a, b) => b.epoch - a.epoch || Number(b.confirmed === true) - Number(a.confirmed === true) || a.tabId.localeCompare(b.tabId));
  }
  function persist() {
    try { storage.setItem(key, JSON.stringify({ tabId, epoch, confirmed, expiresAt: now() + LEASE_TTL_MS })); }
    catch { available = false; }
  }
  return {
    prefix,
    isAvailable() {
      try { storage.getItem(key); } catch { available = false; }
      return available;
    },
    heartbeat() {
      // Expired contenders rejoin as new tabs, without their old takeover priority.
      if (!candidates().some(peer => peer.tabId === tabId && peer.epoch === epoch)) {
        epoch = 0;
        confirmed = false;
      }
      persist();
    },
    takeover() {
      epoch = Math.max(now(), ...candidates().map(peer => peer.epoch)) + 1;
      confirmed = false;
      persist();
    },
    confirm() {
      if (this.isOwner()) { confirmed = true; persist(); }
    },
    isOwner() {
      const winner = candidates()[0];
      return available && winner?.tabId === tabId && winner.epoch === epoch;
    },
    release() {
      try { storage.removeItem(key); } catch { available = false; }
    },
  };
}
