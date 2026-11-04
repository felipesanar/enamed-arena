import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readOfflineAttempts, saveOfflineAttempt, removeOfflineAttempt } from './offline-attempt-cache';

const attempt = { id: 'a1', simulado_id: 's1', simulado_slug: 'slug', started_at: '2026-01-01T00:00:00Z', effective_deadline: '2026-01-01T05:00:00Z', status: 'offline_pending' };
describe('owned offline cache', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it('isolates users and simulations, preserves ownerless legacy data', () => {
    localStorage.setItem('enamed_offline_attempt', JSON.stringify(attempt));
    expect(readOfflineAttempts('u1')).toEqual([]);
    saveOfflineAttempt('u1', attempt);
    saveOfflineAttempt('u2', { ...attempt, id: 'a2' });
    expect(readOfflineAttempts('u1', 's2')).toEqual([]);
    expect(readOfflineAttempts('u1')).toEqual([attempt]);
    removeOfflineAttempt('u1', 's1', 'a1');
    expect(readOfflineAttempts('u2')).toHaveLength(1);
    expect(localStorage.getItem('enamed_offline_attempt')).not.toBeNull();
  });
  it('rejects invalid dates/status and survives blocked storage', () => {
    expect(saveOfflineAttempt('u1', { ...attempt, started_at: 'bad' })).toBe(false);
    expect(saveOfflineAttempt('u1', { ...attempt, status: 'submitted' })).toBe(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(saveOfflineAttempt('u1', attempt)).toBe(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readOfflineAttempts('u1')).toEqual([]);
    expect(() => removeOfflineAttempt('u1', 's1', 'a1')).not.toThrow();
  });
});
