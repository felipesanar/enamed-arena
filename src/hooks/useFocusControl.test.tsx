import { StrictMode, type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useFocusControl } from './useFocusControl';

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
  vi.spyOn(document, 'fullscreenElement', 'get').mockReturnValue(document.documentElement);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function setup() {
  const listeners = vi.spyOn(document, 'addEventListener');
  const callbacks = { onTabExit: vi.fn(), onTabReturn: vi.fn(), onFullscreenExit: vi.fn() };
  const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
  const h = renderHook(() => useFocusControl({ ...callbacks,
    onFullscreenExit: () => callbacks.onFullscreenExit() }), { wrapper });
  const escape = (target: Element = document.body, trusted = true) => {
    const listener = listeners.mock.calls.filter(([name]) => name === 'keydown').at(-1)?.[1] as EventListener;
    act(() => listener?.({ key: 'Escape', isTrusted: trusted, target, repeat: false } as unknown as Event));
  };
  const fullscreen = (value: Element | null) => act(() => {
    vi.spyOn(document, 'fullscreenElement', 'get').mockReturnValue(value);
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  return { ...h, ...callbacks, escape, fullscreen };
}
it('consumes a trusted Escape exit once, keeps interaction, and counts a later real exit', () => {
  const h = setup();
  h.escape(); h.fullscreen(null);
  expect(h.onFullscreenExit).not.toHaveBeenCalled();
  expect(h.result.current.canInteract).toBe(true);
  expect(h.result.current.isFullscreenLost).toBe(false);
  h.fullscreen(document.documentElement); h.fullscreen(null);
  expect(h.onFullscreenExit).toHaveBeenCalledTimes(1);
});
it('preserves the consumable Escape marker across a modal rerender with fresh callbacks', () => {
  const h = setup();
  h.escape(); h.rerender(); h.fullscreen(null);
  expect(h.onFullscreenExit).not.toHaveBeenCalled();
  expect(h.result.current.isFullscreenLost).toBe(false);
});
it.each(['none', 'old', 'untrusted', 'input'])('does not suppress unrelated fullscreen exit (%s)', kind => {
  const h = setup();
  if (kind !== 'none') h.escape(kind === 'input' ? document.createElement('input') : document.body, kind !== 'untrusted');
  if (kind === 'old') act(() => vi.advanceTimersByTime(600));
  h.fullscreen(null);
  expect(h.onFullscreenExit).toHaveBeenCalledTimes(1);
  expect(h.result.current.canInteract).toBe(false);
});
it('never suppresses visibility penalties and removes listeners under StrictMode', () => {
  const remove = vi.spyOn(document, 'removeEventListener');
  const h = setup(); h.escape();
  act(() => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(h.onTabExit).toHaveBeenCalledTimes(1);
  h.unmount();
  expect(remove.mock.calls.filter(([name]) => name === 'keydown')).toHaveLength(2);
});
