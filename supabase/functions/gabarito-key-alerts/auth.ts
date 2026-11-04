// Pure HTTP gate: no Deno, network, environment access or privileged client.
// Same comparison pattern as novu-email: no early exit on character mismatch.
function constantTimeEqual(provided: string, configured: string): boolean {
  if (provided.length !== configured.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ configured.charCodeAt(i);
  }
  return diff === 0;
}

// null is the only result that allows the handler to process data.
export function authorizeRequest(req: Request, configuredSecret?: string | null): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  if (!configuredSecret || !configuredSecret.trim()) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provided = req.headers.get("x-internal-secret") ?? "";
  if (!provided || !constantTimeEqual(provided, configuredSecret)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
