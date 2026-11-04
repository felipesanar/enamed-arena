import { handlerFor } from "../calendar-notifications/index.ts";
if (import.meta.main) Deno.serve(handlerFor("ops"));
