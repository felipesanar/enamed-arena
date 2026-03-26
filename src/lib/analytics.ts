import { logger } from "@/lib/logger";

export type AnalyticsEventName =
  | "lead_captured"
  | "onboarding_completed"
  | "simulado_started"
  | "simulado_completed"
  | "correction_viewed"
  | "ranking_viewed"
  | "ranking_engagement_time"
  | "upsell_clicked";

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsEvent {
  name: AnalyticsEventName;
  payload: AnalyticsPayload;
  timestamp: string;
}

type AnalyticsHandler = (event: AnalyticsEvent) => void | Promise<void>;

const handlers: AnalyticsHandler[] = [];

export function registerAnalyticsHandler(handler: AnalyticsHandler) {
  handlers.push(handler);
}

export function trackEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  const event: AnalyticsEvent = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  };

  logger.log("[analytics]", event.name, event.payload);

  handlers.forEach((handler) => {
    try {
      void handler(event);
    } catch (error) {
      logger.error("[analytics] handler error", error);
    }
  });
}
