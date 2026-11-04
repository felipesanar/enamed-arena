import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installPreloadRecovery, hasPendingExamCache, RECOVERY_KEY } from './preloadRecovery';
let dispose: (() => void) | undefined;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '/'); });
afterEach(() => { dispose?.(); vi.restoreAllMocks(); });
function setup(options: Record<string, unknown> = {}) {
  const reload = vi.fn(); const notify = vi.fn();
  dispose = installPreloadRecovery({ reload, notify, ...options });
  return { reload, notify };
}
function preload() { const e = new Event('vite:preloadError', { cancelable: true }); window.dispatchEvent(e); return e; }
it('never reloads an exam and leaves answers and tokens intact', () => {
  history.replaceState(null, '', '/simulados/fixture/prova');
  localStorage.setItem('enamed_exam_v1:fixture', '{"dirtyQuestionIds":["q1"]}');
  localStorage.setItem('token', 'synthetic');
  const { reload, notify } = setup(); expect(preload().defaultPrevented).toBe(true);
  expect(reload).not.toHaveBeenCalled(); expect(notify).toHaveBeenCalledOnce();
  expect(localStorage.getItem('token')).toBe('synthetic');
  expect(localStorage.getItem('enamed_exam_v1:fixture')).toContain('q1');
});
it('allows only one automatic reload per window including new listener installation', () => {
  const { reload } = setup(); preload(); preload(); expect(reload).toHaveBeenCalledOnce();
  dispose?.(); const next = setup(); preload(); expect(next.reload).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(RECOVERY_KEY)).not.toBeNull();
});
it('does not reload with pending, legacy, malformed or unreadable cache', () => {
  for (const value of ['{"dirtyQuestionIds":["q"]}', 'broken', '{}']) {
    localStorage.setItem('enamed_exam_v1:test', value); expect(hasPendingExamCache()).toBe(true);
  }
  const { reload } = setup(); preload(); expect(reload).not.toHaveBeenCalled();
});
it.each(['enamed_offline_attempt', 'enamed_offline_draft:fixture'])('preserves offline pending state %s outside the editor', key => {
  localStorage.setItem(key, '{"answers":{"q":"a"}}');
  const { reload } = setup(); preload();
  expect(reload).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toContain('answers');
});
it('permits clean known cache but blocks legacy cache', () => {
  localStorage.setItem('enamed_exam_v1:test', '{"dirtyQuestionIds":[]}');
  expect(hasPendingExamCache()).toBe(false);
  localStorage.setItem('enamed_exam_old', '{}'); expect(hasPendingExamCache()).toBe(true);
});
it('fails closed with blocked storage and no reload loop', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
  const { reload, notify } = setup(); preload(); preload(); expect(reload).not.toHaveBeenCalled(); expect(notify).toHaveBeenCalledOnce();
});
it('ignores unrelated errors and disposes/replaces its own listeners', () => {
  const first = setup(); dispose?.(); const next = setup();
  const other = new Event('error', { cancelable: true }); window.dispatchEvent(other);
  expect(other.defaultPrevented).toBe(false); expect(next.reload).not.toHaveBeenCalled();
  preload(); expect(first.reload).not.toHaveBeenCalled(); expect(next.reload).toHaveBeenCalledOnce();
});
it('rechecks route at event time and guards failing callbacks', () => {
  const { reload } = setup({ notify: () => { throw Error('render'); } });
  history.replaceState(null, '', '/simulados/id/prova'); expect(() => preload()).not.toThrow(); expect(reload).not.toHaveBeenCalled();
});
it.each(['/SIMULADOS/id/PROVA', '/simulados/id/%70rova/', '/simulados/id/gabarito', '/simulados/id/%67abarito/'])('treats editable exam route %s as protected', (route) => {
  history.replaceState(null, '', route); const { reload } = setup(); preload(); expect(reload).not.toHaveBeenCalled();
});
it('blocks automatic reload if local storage cannot be inspected', () => {
  vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw Error('blocked'); });
  localStorage.setItem('synthetic', 'value'); const { reload } = setup(); preload(); expect(reload).not.toHaveBeenCalled();
});
it('allows a new attempt after the short persisted cooldown, not on every error', () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000); const first = setup(); preload(); expect(first.reload).toHaveBeenCalledOnce();
  clock.mockReturnValue(61_001); const next = setup(); preload(); expect(next.reload).toHaveBeenCalledOnce();
});
