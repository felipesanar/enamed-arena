import { beforeEach, describe, expect, it } from 'vitest';
import { createExamTabLease, LEASE_TTL_MS } from './exam-tab-lease';

describe('lease election without BroadcastChannel', () => {
  beforeEach(() => localStorage.clear());
  it('elects the same winner regardless of startup order and supports explicit takeover', () => {
    const now = 100;
    const b = createExamTabLease('u', 'attempt', 'b', localStorage, () => now);
    const a = createExamTabLease('u', 'attempt', 'a', localStorage, () => now);
    b.heartbeat(); a.heartbeat();
    expect(a.isOwner()).toBe(true); expect(b.isOwner()).toBe(false);
    b.takeover();
    expect(b.isOwner()).toBe(true); expect(a.isOwner()).toBe(false);
    a.heartbeat();
    expect(a.isOwner()).toBe(false);
    b.release();
    expect(a.isOwner()).toBe(true);
  });
  it('expires dead tabs, isolates identities, and fails closed if storage is denied', () => {
    let now = 100;
    const a = createExamTabLease('u', 'attempt', 'a', localStorage, () => now);
    const b = createExamTabLease('u', 'attempt', 'b', localStorage, () => now);
    a.heartbeat(); b.heartbeat();
    now += LEASE_TTL_MS + 1;
    b.heartbeat();
    expect(b.isOwner()).toBe(true);
    const other = createExamTabLease('other', 'attempt', 'a', localStorage, () => now);
    other.heartbeat(); expect(other.isOwner()).toBe(true);
    const denied = createExamTabLease('u', 'a', 'x', { getItem() { throw Error(); } } as unknown as Storage, () => now);
    expect(denied.isOwner()).toBe(false);
  });
  it('does not let a newly opened or resurrected tab steal an established owner', () => {
    let now = 100;
    const b = createExamTabLease('u', 'attempt', 'b', localStorage, () => now);
    b.heartbeat(); b.confirm();
    const a = createExamTabLease('u', 'attempt', 'a', localStorage, () => now);
    a.heartbeat();
    expect(b.isOwner()).toBe(true);
    a.takeover(); a.confirm();
    now += LEASE_TTL_MS + 1;
    b.heartbeat(); b.confirm();
    a.heartbeat();
    expect(a.isOwner()).toBe(false);
    expect(b.isOwner()).toBe(true);
  });
});
