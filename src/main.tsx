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

setSuperProperties({
  session_id: getSessionId(),
  platform: "web",
  app_version: import.meta.env.VITE_APP_VERSION ?? "unknown",
});

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
