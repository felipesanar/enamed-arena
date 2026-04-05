import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAnalyticsHandler, setSuperProperties } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";

function getSessionId(): string {
  const key = "_ea_sid";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
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
  platform: 'web',
  app_version: import.meta.env.VITE_APP_VERSION ?? 'unknown',
  ...storedUtm,
})

if (import.meta.env.DEV) {
  registerAnalyticsHandler((event) => {
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c[analytics] ${event.name}`, "color:#8e1f3d;font-weight:bold");
    // eslint-disable-next-line no-console
    console.table(event.payload);
    // eslint-disable-next-line no-console
    console.groupEnd();
  });
}

registerAnalyticsHandler((event) => {
  supabase.rpc('log_analytics_event', {
    p_event_name: event.name,
    p_payload: event.payload,
  });
});

createRoot(document.getElementById("root")!).render(<App />);
