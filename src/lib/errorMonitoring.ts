type ErrorSource = 'boundary' | 'window' | 'rejection';
export interface ErrorReport {
  source: ErrorSource;
  name: string;
  code: 'render_failure' | 'runtime_failure' | 'unhandled_rejection';
  route: string;
  release?: string;
}
interface MonitoringConfig {
  enabled?: boolean;
  transport?: (report: ErrorReport) => void | Promise<void>;
  release?: string;
}
let config: MonitoringConfig = { enabled: false };
let busy = false;
let windowStart = 0;
let count = 0;
const seen = new Set<string>();
const routeSegments = new Set(['login', 'landing', 'onboarding', 'simulados', 'prova', 'start', 'resultado', 'resultados', 'ranking', 'comparativo', 'caderno-erros', 'perfil', 'admin', 'edicoes']);
const errorNames = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AbortError']);
export function configureErrorMonitoring(next: MonitoringConfig) {
  config = { enabled: false, ...next };
  clearErrorMonitoringSession();
}
export function clearErrorMonitoringSession() {
  busy = false;
  seen.clear(); count = 0; windowStart = 0;
}
export function resetErrorMonitoring() {
  configureErrorMonitoring({ enabled: false });
}

// Never read message, stack, cause, rejection strings or user/session objects.
export function reportError(source: ErrorSource, error: unknown) {
  if (!config.enabled || !config.transport || busy) return;
  busy = true;
  try {
    const now = Date.now();
    if (!windowStart || now - windowStart >= 60_000) { windowStart = now; count = 0; seen.clear(); }
    if (count >= 10) return;
    let name = 'Error';
    try {
      const candidate = error && typeof error === 'object' ? (error as { name?: unknown }).name : null;
      if (typeof candidate === 'string' && errorNames.has(candidate)) name = candidate;
    } catch { /* Untrusted getters must not break the application. */ }
    const route = '/' + window.location.pathname.split('/').filter(Boolean).map(p => routeSegments.has(p) ? p : ':id').join('/');
    const codes = { boundary: 'render_failure', window: 'runtime_failure', rejection: 'unhandled_rejection' } as const;
    const report: ErrorReport = { source, name, code: codes[source], route };
    if (config.release && /^[a-zA-Z0-9._-]{1,64}$/.test(config.release)) report.release = config.release;
    const key = JSON.stringify(report);
    if (seen.has(key)) return;
    seen.add(key); count++;
    const result = config.transport(report);
    if (result && typeof result.then === 'function') {
      void Promise.resolve(result).catch(() => {});
    }
  } catch {
    // Deliberately no logging/reporting of transport failures (recursion/PII).
  } finally {
    // Guard synchronous reentrancy only; an unresolved transport must not stall reporting.
    busy = false;
  }
}

const listenerKey = Symbol.for('enamed.errorMonitoring.cleanup');
export function installErrorMonitoring(): () => void {
  const host = window as Window & { [listenerKey]?: () => void };
  host[listenerKey]?.();
  const onError = (event: ErrorEvent) => reportError('window', event.error);
  const onRejection = (event: PromiseRejectionEvent) => reportError('rejection', event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const cleanup = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    if (host[listenerKey] === cleanup) delete host[listenerKey];
  };
  host[listenerKey] = cleanup;
  return cleanup;
}
