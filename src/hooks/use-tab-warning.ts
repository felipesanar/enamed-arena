import { useEffect, useCallback, useRef } from 'react';

interface UseTabWarningOptions {
  enabled: boolean;
  onTabSwitch: () => void;
}

export function useTabWarning({ enabled, onTabSwitch }: UseTabWarningOptions) {
  const callbackRef = useRef(onTabSwitch);
  callbackRef.current = onTabSwitch;

  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) {
        console.log('[useTabWarning] Tab lost focus');
        callbackRef.current();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);
}
