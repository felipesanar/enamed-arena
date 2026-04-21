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
}

export function useFocusControl({ onTabExit, onTabReturn, onFullscreenExit }: UseFocusControlProps) {
  const [isTabAway, setIsTabAway] = useState(false);
  const [isFullscreenLost, setIsFullscreenLost] = useState(false);
  const [canInteract, setCanInteract] = useState(true);
  const wasInFullscreenRef = useRef(false);

  useEffect(() => {
    wasInFullscreenRef.current = !!document.fullscreenElement;
  }, []);

  const handleVisibility = useCallback(() => {
    if (document.hidden) {
      setIsTabAway(true);
      onTabExit();
      setCanInteract(false);
    } else {
      setIsTabAway(false);
      onTabReturn();
      // Only re-enable interaction if fullscreen is active (or not required)
      setCanInteract(true);
    }
  }, [onTabExit, onTabReturn]);

  const handleFullscreenChange = useCallback(() => {
    const isFs = !!document.fullscreenElement;
    const wasFs = wasInFullscreenRef.current;
    wasInFullscreenRef.current = isFs;

    setIsFullscreenLost(!isFs);

    if (wasFs && !isFs && onFullscreenExit) {
      logger.log('[FocusControl] Fullscreen exit detected');
      onFullscreenExit();
    }
  }, [onFullscreenExit]);

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
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  }, []);

  useEffect(() => {
    const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'];
    document.addEventListener('visibilitychange', handleVisibility);
    fsEvents.forEach(e => document.addEventListener(e, handleFullscreenChange));

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      fsEvents.forEach(e => document.removeEventListener(e, handleFullscreenChange));
    };
  }, [handleVisibility, handleFullscreenChange]);

  return { isTabAway, isFullscreenLost, canInteract, enterFullscreen, exitFullscreen };
}
