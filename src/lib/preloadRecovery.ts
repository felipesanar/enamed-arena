export const RECOVERY_KEY = 'enamed.preloadRecovery.at';
const COOLDOWN_MS = 60_000;
const noticeEvent = 'enamed:preload-recovery';
const stateKey = Symbol.for('enamed.preloadRecovery');
interface RecoveryState { visible: boolean; cleanup?: () => void }
function state(): RecoveryState {
  const host = window as Window & { [stateKey]?: RecoveryState };
  return host[stateKey] ?? (host[stateKey] = { visible: false });
}
export const getRecoveryNotice = () => state().visible;
export function subscribeRecoveryNotice(listener: () => void) {
  window.addEventListener(noticeEvent, listener);
  return () => window.removeEventListener(noticeEvent, listener);
}

export function hasPendingExamCache(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Offline/presencial editors may have pending state even away from the route.
      // Unknown offline formats fail closed, without importing draft helpers.
      if (key?.startsWith('enamed_offline_')) return true;
      if (!key?.startsWith('enamed_exam_') || key.startsWith('enamed_exam_active_v1:')) continue;
      if (!key.startsWith('enamed_exam_v1:')) return true;
      const cache = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (!cache || !Array.isArray(cache.dirtyQuestionIds) || cache.dirtyQuestionIds.length) return true;
    }
    return false;
  } catch { return true; }
}

interface RecoveryOptions { reload?: () => void; notify?: () => void }
export function installPreloadRecovery({ reload = () => window.location.reload(), notify }: RecoveryOptions = {}) {
  const current = state();
  current.cleanup?.();
  let handled = false;
  const handler = (event: Event) => {
    event.preventDefault();
    if (handled) return;
    handled = true;
    let automatic = false;
    try {
      const pathname = decodeURI(window.location.pathname);
      if (!/^\/simulados\/[^/]+\/(?:prova|gabarito)(?:\/|$)/i.test(pathname) && !hasPendingExamCache()) {
        const raw = sessionStorage.getItem(RECOVERY_KEY);
        const last = Number(raw);
        const now = Date.now();
        if (raw === null || (Number.isFinite(last) && now - last > COOLDOWN_MS)) {
          // Persist before reloading; blocked storage must never cause a reload loop.
          sessionStorage.setItem(RECOVERY_KEY, String(now));
          automatic = true;
        }
      }
      if (automatic) { reload(); return; }
    } catch { /* Storage or reload failed: use the manual recovery path. */ }
    current.visible = true;
    window.dispatchEvent(new Event(noticeEvent));
    try { notify?.(); } catch { /* Recovery must never interfere with the exam. */ }
  };
  window.addEventListener('vite:preloadError', handler);
  const cleanup = () => {
    window.removeEventListener('vite:preloadError', handler);
    if (current.cleanup === cleanup) delete current.cleanup;
  };
  current.cleanup = cleanup;
  return cleanup;
}
