import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Supabase Auth acts as the OAuth 2.1 authorization server for the MCP
 * connection. It redirects the user here to approve/deny a connecting client.
 * The `supabase.auth.oauth` namespace is beta, so we wrap the three methods we
 * use in a locally-typed shim rather than depend on published types.
 */
type AuthorizationDetails = {
  client?: { name?: string };
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

function oauthApi(): OAuthApi | null {
  const api = (supabase.auth as unknown as { oauth?: OAuthApi }).oauth;
  return api ?? null;
}

/** Only allow same-origin relative redirects back into the app. */
function safeNext(): string {
  const path = window.location.pathname + window.location.search;
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const api = oauthApi();
      if (!authorizationId) return setError("Requisição de autorização inválida (sem authorization_id).");
      if (!api) return setError("O servidor de autorização OAuth não está habilitado neste projeto Supabase.");

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = "/login?next=" + encodeURIComponent(safeNext());
        return;
      }

      const { data, error: detErr } = await api.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detErr) {
        logger.error("[OAuthConsent] getAuthorizationDetails:", detErr.message);
        return setError(detErr.message);
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const api = oauthApi();
    if (!api) return;
    setBusy(true);
    const { data, error: decErr } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (decErr) {
      setBusy(false);
      return setError(decErr.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("O servidor de autorização não retornou um redirecionamento.");
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "um aplicativo";

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {error ? (
          <div className="space-y-3 text-center">
            <h1 className="text-heading-3 text-foreground">Não foi possível conectar</h1>
            <p className="text-body-sm text-muted-foreground">{error}</p>
          </div>
        ) : !details ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-9 w-9 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-body-sm text-muted-foreground">Carregando autorização…</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-heading-3 text-foreground">Conectar {clientName}</h1>
              <p className="text-body-sm text-muted-foreground">
                Isso permite que <strong className="text-foreground">{clientName}</strong> acesse a plataforma
                Simulados SanarFlix como você — lendo apenas os seus dados, com as suas permissões.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true)}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-body font-semibold text-primary-foreground transition-all hover:bg-wine-hover disabled:opacity-55"
              >
                Aprovar acesso
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(false)}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-border text-body font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-55"
              >
                Recusar
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}