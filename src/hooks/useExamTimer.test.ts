import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useExamTimer } from '@/hooks/useExamTimer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('waits for a valid clock and fires once per attempt even after deadline corrections', () => {
  const onTimeUp = vi.fn();
  const now = () => 10000;
  const { rerender } = renderHook(props => useExamTimer({ ...props, now, onTimeUp }), {
    initialProps: { deadline: new Date(9000).toISOString(), clockReady: false, attemptKey: 'a' },
  });
  expect(onTimeUp).not.toHaveBeenCalled();
  rerender({ deadline: new Date(9000).toISOString(), clockReady: true, attemptKey: 'a' });
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  rerender({ deadline: new Date(8000).toISOString(), clockReady: true, attemptKey: 'a' });
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  rerender({ deadline: new Date(8000).toISOString(), clockReady: true, attemptKey: 'b' });
  expect(onTimeUp).toHaveBeenCalledTimes(2);
});

it('does not expire from an invalid clock or deadline', () => {
  const onTimeUp = vi.fn();
  renderHook(() => useExamTimer({ deadline: 'invalid', now: () => NaN, onTimeUp }));
  act(() => vi.advanceTimersByTime(3000));
  expect(onTimeUp).not.toHaveBeenCalled();
});

it('fires once per deadline and resets after changing from expired A to future B', () => {
  const onTimeUp = vi.fn();
  const a = new Date(Date.now() + 1000).toISOString();
  const b = new Date(Date.now() + 5000).toISOString();
  const { result, rerender } = renderHook(props => useExamTimer({ ...props, onTimeUp }), {
    initialProps: { deadline: a, paused: false },
  });
  act(() => vi.advanceTimersByTime(1000));
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  rerender({ deadline: a, paused: true });
  rerender({ deadline: a, paused: false });
  act(() => vi.advanceTimersByTime(1000));
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  rerender({ deadline: b, paused: false });
  expect(result.current).toBe(3);
  act(() => vi.advanceTimersByTime(3000));
  expect(onTimeUp).toHaveBeenCalledTimes(2);
  rerender({ deadline: b, paused: false });
  rerender({ deadline: b, paused: true });
  rerender({ deadline: b, paused: false });
  act(() => vi.advanceTimersByTime(5000));
  expect(onTimeUp).toHaveBeenCalledTimes(2);
});

it('updates a changed deadline while paused, but only fires after resuming', () => {
  const onTimeUp = vi.fn();
  const { result, rerender } = renderHook(props => useExamTimer({ ...props, onTimeUp }), {
    initialProps: { deadline: new Date(Date.now()-1000).toISOString(), paused: false },
  });
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  rerender({ deadline: new Date(Date.now()+5000).toISOString(), paused: true });
  expect(result.current).toBe(5);
  act(() => vi.advanceTimersByTime(6000));
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  const deadline = new Date(Date.now()-1000).toISOString();
  rerender({ deadline, paused: false });
  expect(onTimeUp).toHaveBeenCalledTimes(2);
});
