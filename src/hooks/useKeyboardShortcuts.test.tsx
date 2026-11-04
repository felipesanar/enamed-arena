import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
afterEach(() => { cleanup(); document.body.innerHTML = ''; });
it.each(['INPUT', 'TEXTAREA', 'SELECT', 'editable', 'textbox', 'dialog'])('ignores %s and descendants', (kind) => {
  const action = vi.fn();
  renderHook(() => useKeyboardShortcuts({ '1': action }));
  const target = document.createElement(['INPUT', 'TEXTAREA', 'SELECT'].includes(kind) ? kind : 'div');
  if (kind === 'editable') target.setAttribute('contenteditable', 'true');
  if (kind === 'textbox') target.setAttribute('role', 'textbox');
  if (kind === 'dialog') { target.setAttribute('role', 'dialog'); target.setAttribute('aria-modal', 'true'); }
  document.body.append(target);
  fireEvent.keyDown(target, { key: '1' });
  expect(action).not.toHaveBeenCalled();
});
it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }])('ignores reserved combinations %o', (options) => {
  const action = vi.fn(); renderHook(() => useKeyboardShortcuts({ '1': action }));
  fireEvent.keyDown(document, { key: '1', ...options });
  expect(action).not.toHaveBeenCalled();
});
it('respects defaultPrevented and only cancels a mapped action', () => {
  const action = vi.fn(); renderHook(() => useKeyboardShortcuts({ '1': action }));
  const prevented = new KeyboardEvent('keydown', { key: '1', cancelable: true }); prevented.preventDefault();
  document.dispatchEvent(prevented); expect(action).not.toHaveBeenCalled();
  expect(fireEvent.keyDown(document, { key: 'x' })).toBe(true);
  expect(fireEvent.keyDown(document, { key: '1' })).toBe(false);
  expect(action).toHaveBeenCalledTimes(1);
});
it('preserves opt-out, enabled and fresh handlers', () => {
  const action = vi.fn(); const next = vi.fn();
  const { rerender } = renderHook(({ handler, enabled }) => useKeyboardShortcuts({ '1': handler }, { preventInInputs: false, enabled }), { initialProps: { handler: action, enabled: true } });
  const input = document.createElement('input'); document.body.append(input);
  fireEvent.keyDown(input, { key: '1' }); expect(action).toHaveBeenCalledOnce();
  rerender({ handler: next, enabled: true }); fireEvent.keyDown(document, { key: '1' }); expect(next).toHaveBeenCalledOnce();
  rerender({ handler: next, enabled: false }); fireEvent.keyDown(document, { key: '1' }); expect(next).toHaveBeenCalledOnce();
});
it('does not finalize the exam while Escape is closing a focused nonmodal shortcut popover', () => {
  const finalize = vi.fn(); renderHook(() => useKeyboardShortcuts({ Escape: finalize }));
  const popover = document.createElement('div'); popover.setAttribute('role', 'dialog');
  const child = document.createElement('button'); popover.append(child); document.body.append(popover);
  fireEvent.keyDown(child, { key: 'Escape' }); expect(finalize).not.toHaveBeenCalled();
});
