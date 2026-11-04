import { afterEach, expect, it, vi } from 'vitest';
import { configureErrorMonitoring, reportError, installErrorMonitoring, resetErrorMonitoring, clearErrorMonitoringSession } from './errorMonitoring';
afterEach(() => { resetErrorMonitoring(); vi.restoreAllMocks(); });
it('is disabled by default and sends nothing without a transport', () => {
  const transport = vi.fn(); configureErrorMonitoring({ transport }); reportError('boundary', Error('private'));
  expect(transport).not.toHaveBeenCalled(); configureErrorMonitoring({ enabled: true }); expect(() => reportError('window', Error('x'))).not.toThrow();
});
it('only emits allowlisted metadata, no message/stack/query/hash/user data or dynamic path', () => {
  const transport = vi.fn(); configureErrorMonitoring({ enabled: true, transport, release: '2027.1' });
  history.replaceState(null, '', '/simulados/123e4567-e89b-12d3-a456-426614174000/prova?email=private#jwt');
  reportError('boundary', new TypeError('email@example.com answer=secret jwt=xxx'));
  expect(transport).toHaveBeenCalledWith({ source: 'boundary', name: 'TypeError', code: 'render_failure', route: '/simulados/:id/prova', release: '2027.1' });
  history.replaceState(null, '', '/users/email@example.com/123?token=x');
  reportError('window', { name: 'email@example.com', message: 'secret' });
  expect(transport.mock.calls[1][0]).toMatchObject({ name: 'Error', route: '/:id/:id/:id' });
});
it('deduplicates and rate limits even distinct routes', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  const transport = vi.fn(); configureErrorMonitoring({ enabled: true, transport });
  for (let i = 0; i < 30; i++) { history.replaceState(null, '', i % 2 ? '/login' : '/simulados'); reportError('window', Error('sensitive')); }
  expect(transport).toHaveBeenCalledTimes(2);
});
it('contains thrown/rejected/recursive transports and hostile error getters', async () => {
  const transport = vi.fn(() => { reportError('rejection', Error('recursive')); return Promise.reject(Error('transport')); });
  configureErrorMonitoring({ enabled: true, transport });
  const error = { get name() { throw Error('getter'); } };
  expect(() => reportError('boundary', error)).not.toThrow(); await Promise.resolve(); await Promise.resolve();
  expect(transport).toHaveBeenCalledOnce();
});
it('does not let a pending transport block later distinct reports', () => {
  const transport = vi.fn(() => new Promise<void>(() => {}));
  configureErrorMonitoring({ enabled: true, transport });
  reportError('window', Error('first'));
  reportError('boundary', Error('second'));
  expect(transport).toHaveBeenCalledTimes(2);
});
it('installs idempotently, never prevents error events and clears config on shutdown', () => {
  const transport = vi.fn(); configureErrorMonitoring({ enabled: true, transport });
  const old = installErrorMonitoring(); const dispose = installErrorMonitoring(); old();
  const e = new Event('unhandledrejection', { cancelable: true }); Object.defineProperty(e, 'reason', { value: Error('private') });
  window.dispatchEvent(e); expect(e.defaultPrevented).toBe(false); expect(transport).toHaveBeenCalledOnce();
  resetErrorMonitoring(); window.dispatchEvent(e); expect(transport).toHaveBeenCalledOnce(); dispose();
});
it('reports window.error metadata without preventing the original event', () => {
  const transport = vi.fn(); configureErrorMonitoring({ enabled: true, transport });
  const dispose = installErrorMonitoring();
  // A plain event exercises our listener without asking jsdom/Vitest to throw a runtime exception.
  const event = new Event('error', { cancelable: true }); Object.defineProperty(event, 'error', { value: new RangeError('private') });
  window.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
  expect(transport).toHaveBeenCalledWith(expect.objectContaining({ source: 'window', name: 'RangeError' })); dispose();
});
it('caps at ten reports per minute, resumes after cooldown and contains sync failures', () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  const transport = vi.fn(); configureErrorMonitoring({ enabled: true, transport });
  const names = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AbortError'];
  for (const source of ['boundary', 'window', 'rejection'] as const) for (const name of names) reportError(source, { name });
  expect(transport).toHaveBeenCalledTimes(10);
  clock.mockReturnValue(61_001); reportError('window', Error('private')); expect(transport).toHaveBeenCalledTimes(11);
  configureErrorMonitoring({ enabled: true, transport: () => { throw Error('failure'); } });
  expect(() => reportError('boundary', Error('private'))).not.toThrow();
});
it('retains the configured transport after clearing session state on logout', () => {
  const transport = vi.fn(); configureErrorMonitoring({ enabled: true, transport });
  reportError('window', Error('first'));
  clearErrorMonitoringSession();
  reportError('window', Error('next session'));
  expect(transport).toHaveBeenCalledTimes(2);
});
it('can reconfigure after logout even when an old transport never settles', () => {
  configureErrorMonitoring({ enabled: true, transport: () => new Promise<void>(() => {}) });
  reportError('window', Error('old'));
  resetErrorMonitoring();
  const transport = vi.fn(); configureErrorMonitoring({ enabled: true, transport });
  reportError('window', Error('new')); expect(transport).toHaveBeenCalledOnce();
});
