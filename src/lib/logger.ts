/**
 * Conditional logger — suppresses logs in production to avoid leaking PII.
 * Risk 10: Logs com dados de usuário em produção.
 */

const isDev = import.meta.env.DEV;

/* eslint-disable no-console */
export const logger = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  /** Errors are always logged (but avoid including PII in messages). */
  error: (...args: unknown[]) => { console.error(...args); },
  info: (...args: unknown[]) => { if (isDev) console.info(...args); },
};
