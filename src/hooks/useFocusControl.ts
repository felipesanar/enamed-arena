/**
 * Focus control — ported from SanarFlix Academy's useFocusControl.
 * Cross-browser fullscreen detection + tab visibility tracking.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { logger } from '@/lib/logger';

interface UseFocusControlProps {
  onTabExit: () => void;
  onTabReturn: () => void;
  onFullscreenExit?: () => void;
  isEscapeAllowed?: () => boolean;
}

export function useFocusControl({ onTabExit, onTabReturn, onFullscreenExit, isEscapeAllowed }: UseFocusControlProps) {
  const [isTabAway, setIsTabAway] = useState(false);
  const [isFullscreenLost, setIsFullscreenLost] = useState(false);
  const [canInteract, setCanInteract] = useState(true);
  const wasInFullscreenRef = useRef(false);
  const escapeUntil = useRef(-1);
  const intentionalUntil = useRef(-1);
  const acceptedExit = useRef(false);
  const escapeAllowedRef = useRef(isEscapeAllowed);
  escapeAllowedRef.current = isEscapeAllowed;
  const callbacksRef = useRef({ onTabExit, onTabReturn, onFullscreenExit });
  callbacksRef.current = { onTabExit, onTabReturn, onFullscreenExit };

  useEffect(() => {
    wasInFullscreenRef.current = !!document.fullscreenElement;
  }, []);

  const handleVisibility = useCallback(() => {
    if (document.hidden) {
      setIsTabAway(true);
      callbacksRef.current.onTabExit();
      setCanInteract(false);
    } else {
      setIsTabAway(false);
      callbacksRef.current.onTabReturn();
      // Re-enable interaction ONLY if the integrity contract is satisfied:
      // i.e. the user is back in fullscreen. Otherwise we keep interaction
      // disabled until they re-enter fullscreen (the integrity overlay UI
      // shows the prompt for that).
      setCanInteract(!!document.fullscreenElement || acceptedExit.current);
    }
  }, []);

  const handleFullscreenChange = useCallback(() => {
    const isFs = !!document.fullscreenElement;
    const wasFs = wasInFullscreenRef.current;
    wasInFullscreenRef.current = isFs;

    if (wasFs && !isFs) {
      const now = performance.now();
      acceptedExit.current = now <= escapeUntil.current || now <= intentionalUntil.current;
      escapeUntil.current = -1;
      intentionalUntil.current = -1;
    } else if (isFs) {
      acceptedExit.current = false;
    }
    setIsFullscreenLost(!isFs && !acceptedExit.current);
    setCanInteract(!document.hidden && (isFs || acceptedExit.current));

    if (wasFs && !isFs && !acceptedExit.current && callbacksRef.current.onFullscreenExit) {
      logger.log('[FocusControl] Fullscreen exit detected');
      callbacksRef.current.onFullscreenExit();
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreenLost(false);
    } catch (e) {
      logger.error('[FocusControl] Fullscreen request failed:', e);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        intentionalUntil.current = performance.now() + 500;
        await document.exitFullscreen();
      }
    } catch {}
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== 'Escape' || !event.isTrusted || event.repeat || !document.fullscreenElement ||
        escapeAllowedRef.current?.() === false || target?.closest?.('input, textarea, [contenteditable="true"], [contenteditable=""]')) return;
      escapeUntil.current = performance.now() + 500;
    };
    const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'];
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('visibilitychange', handleVisibility);
    fsEvents.forEach(e => document.addEventListener(e, handleFullscreenChange));

    return () => {
      escapeUntil.current = -1;
      intentionalUntil.current = -1;
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('visibilitychange', handleVisibility);
      fsEvents.forEach(e => document.removeEventListener(e, handleFullscreenChange));
    };
  }, [handleVisibility, handleFullscreenChange]);

  return { isTabAway, isFullscreenLost, canInteract, enterFullscreen, exitFullscreen };
}
