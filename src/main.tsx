import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAnalyticsHandler, setSuperProperties } from "@/lib/analytics";
import { initAnalyticsQueue, enqueueAnalyticsEvent } from "@/lib/analyticsQueue";
import type { QueueItem } from "@/lib/analyticsQueue";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { mountDevTools, pushToDevBuffer } from "@/lib/analyticsDevTools";

// Force light mode globally — dark theme temporarily disabled.
document.documentElement.classList.remove("dark");

// Cache buster do Prof. Sanor: quando o usuário recarrega a página (F5 / Ctrl+R
// / Ctrl+Shift+R), limpamos todas as análises cacheadas em sessionStorage com
// prefixo "sanor:". O cache continua funcionando enquanto a aba existir sem
// reload (trocar de aba do navegador não dispara isso), mas qualquer recarga
// força regeneração — comportamento esperado de "atualizar".
try {
  const nav = performance.getEntriesByType?.('navigation') as PerformanceNavigationTiming[] | undefined;
  const isReload = nav?.[0]?.type === 'reload';
  if (isReload && typeof sessionStorage !== 'undefined') {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('sanor:')) toRemove.push(k);
    }
    toRemove.forEach(k => sessionStorage.removeItem(k));
  }
} catch {
  // ignora ambientes sem performance API ou sem sessionStorage
}

// ---------------------------------------------------------------------------
// Identity (Fase 2, passos 3-5)
// ---------------------------------------------------------------------------

function getSessionId(): string {
  const key = '_ea_sid';
  const tsKey = '_ea_sid_ts';
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  let sid = sessionStorage.getItem(key);
  const ts = Number(sessionStorage.getItem(tsKey) ?? '0');
  if (!sid || Date.now() - ts > SESSION_TIMEOUT_MS) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
    sessionStorage.setItem(tsKey, String(Date.now()));
  }
  return sid;
}

function getAnonymousId(): string {
  const key = '_ea_aid';
  let aid = localStorage.getItem(key);
  if (!aid) {
    aid = crypto.randomUUID();
    localStorage.setItem(key, aid);
  }
  return aid;
}

function readStoredUtm(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem('_ea_utm') ?? '{}')
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const urlParams = new URLSearchParams(window.location.search)
const utmFromUrl: Record<string, string> = {}
for (const k of UTM_KEYS) {
  const v = urlParams.get(k)
  if (v) utmFromUrl[k] = v
}
try {
  if (Object.keys(utmFromUrl).length > 0) {
    localStorage.setItem('_ea_utm', JSON.stringify(utmFromUrl))
  }
} catch {
  // Storage unavailable or full — skip UTM persistence silently
}
const storedUtm = readStoredUtm()

setSuperProperties({
  session_id: getSessionId(),
  anonymous_id: getAnonymousId(),
  platform: 'web',
  app_version: import.meta.env.VITE_APP_VERSION ?? 'unknown',
  ...storedUtm,
})

// ---------------------------------------------------------------------------
// Relinkagem anon→usuário: quando o usuário faz login, registra a associação
// entre anonymous_id e user_id para resolução de identidade em queries admin.
// ---------------------------------------------------------------------------
let _prevUserId: string | null = null;
supabase.auth.onAuthStateChange((_evt, session) => {
  const uid = session?.user?.id ?? null;
  if (uid && !_prevUserId) {
    // Primeira vez que vemos um user_id nesta sessão → relinkagem
    setSuperProperties({ user_id: uid });
  }
  _prevUserId = uid;
});

// ---------------------------------------------------------------------------
// Resiliência (Fase 2, passo 4): fila com retry e beacon no page unload
// ---------------------------------------------------------------------------

const _supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://lljnbysgcwvkhlnaqxtt.supabase.co';
const _anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsam5ieXNnY3d2a2hsbmFxeHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDgyMjQsImV4cCI6MjA4OTAyNDIyNH0.sCYdAHzP9SMizifcxmTb9wO11gbXiR4a7lDknf4cuNM';
const _batchRpcUrl = `${_supabaseUrl}/rest/v1/rpc/log_analytics_events`;

let _authToken: string | null = null;
supabase.auth.onAuthStateChange((_evt, session) => {
  _authToken = session?.access_token ?? null;
});

function _toRpcEvents(batch: QueueItem[]) {
  return batch.map(e => ({
    event_name: e.event_name,
    payload: e.payload,
    event_id: e.event_id,
    client_timestamp: e.client_timestamp,
    route: e.route,
  }));
}

initAnalyticsQueue(
  async (batch) => {
    const { error } = await supabase.rpc('log_analytics_events', { events: _toRpcEvents(batch) as unknown as Json });
    if (error) throw error;
  },
  (batch) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': _anonKey,
    };
    if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
    fetch(_batchRpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: _toRpcEvents(batch) }),
      keepalive: true,
    }).catch(() => {});
  },
);

// ---------------------------------------------------------------------------
// Handler DEV — console agrupado + buffer inspecionável em window.__ea_events
// ---------------------------------------------------------------------------
if (import.meta.env.DEV) {
  mountDevTools();
  registerAnalyticsHandler((event) => {
    pushToDevBuffer({
      name: event.name,
      event_id: event.event_id,
      payload: event.payload as Record<string, unknown>,
      timestamp: event.timestamp,
    });
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c[analytics] ${event.name}`, 'color:#8e1f3d;font-weight:bold');
    // eslint-disable-next-line no-console
    console.table(event.payload);
    // eslint-disable-next-line no-console
    console.groupEnd();
  });
}

// Handler de produção — enfileira para batch/retry/beacon.
registerAnalyticsHandler((event) => {
  enqueueAnalyticsEvent({
    event_name: event.name,
    event_id: event.event_id,
    payload: event.payload as Record<string, unknown>,
    client_timestamp: event.timestamp,
    route: window.location.pathname,
  });
});

createRoot(document.getElementById('root')!).render(<App />);
