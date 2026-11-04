import { createHandler } from "./handler.ts";
if (import.meta.main) Deno.serve(createHandler((key) => Deno.env.get(key)));
