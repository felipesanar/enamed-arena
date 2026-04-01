import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { FormFeedback } from "@/components/auth/FormFeedback";

type FlowState = "idle" | "saving" | "done" | "error";

function getRecoveryParam(key: string) {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return searchParams.get(key) || hashParams.get(key);
}

function clearRecoveryParams() {
  window.history.replaceState({}, document.title, "/reset-password");
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const failRecovery = (message: string) => {
      if (!mounted) return;
      setError(message);
      setFlowState("error");
      setReady(false);
    };

    const prepareRecoverySession = async () => {
      const accessToken = getRecoveryParam("access_token");
      const refreshToken = getRecoveryParam("refresh_token");
      const tokenHash = getRecoveryParam("token_hash") || getRecoveryParam("token");
      const recoveryType = getRecoveryParam("type");
      const providerError = getRecoveryParam("error_description") || getRecoveryParam("error");

      if (providerError) {
        failRecovery(decodeURIComponent(providerError).replace(/\+/g, " "));
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          failRecovery("Link invalido ou expirado. Solicite um novo email.");
          return;
        }

        clearRecoveryParams();
        if (mounted) {
          setReady(true);
          setFlowState("idle");
        }
        return;
      }

      if (tokenHash && recoveryType === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (verifyError) {
          failRecovery("Link invalido ou expirado. Solicite um novo email.");
          return;
        }

        clearRecoveryParams();
        if (mounted) {
          setReady(true);
          setFlowState("idle");
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (mounted) {
          setReady(true);
          setFlowState("idle");
        }
        return;
      }

      failRecovery("Link invalido ou expirado. Solicite um novo email.");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setFlowState("idle");
      }
    });

    void prepareRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas nao coincidem.");
      return;
    }

    setFlowState("saving");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setFlowState("idle");
        return;
      }

      setFlowState("done");
      setTimeout(() => navigate("/", { replace: true }), 2500);
    } catch {
      setError("Erro inesperado. Tente novamente.");
      setFlowState("idle");
    }
  };

  return (
    <AuthShell
      heroEyebrow="Recuperacao premium"
      heroTitle="Defina uma nova senha com seguranca total."
      heroSubtitle="Quando o link estiver valido, a troca da senha leva apenas alguns segundos."
    >
      <div className="space-y-1 text-center">
        <h1 className="text-heading-2 text-auth-text-primary">Nova senha</h1>
        <p className="text-body-sm text-auth-text-muted">Fluxo protegido para recuperar o acesso da sua conta.</p>
      </div>

      {flowState === "done" && (
        <div className="mt-6 space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-heading-3 text-auth-text-primary">Senha atualizada</h2>
          <p className="text-body-sm text-auth-text-muted">Sua senha foi redefinida com sucesso. Redirecionando...</p>
        </div>
      )}

      {flowState === "error" && (
        <div className="mt-6 space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-heading-3 text-auth-text-primary">Nao foi possivel validar o link</h2>
          <p className="text-body-sm text-auth-text-muted">{error}</p>
          <Link to="/forgot-password" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-auth-border-subtle bg-auth-surface-soft text-body-sm font-semibold text-auth-text-primary transition-all hover:border-auth-border-strong">
            Solicitar novo email
          </Link>
        </div>
      )}

      {flowState !== "done" && flowState !== "error" && !ready && (
        <div className="mt-6 space-y-4 text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-body-sm text-auth-text-muted">Verificando link de redefinicao...</p>
          <Link to="/login" className="inline-block text-body-sm font-semibold text-primary hover:text-primary/80">
            Voltar para login
          </Link>
        </div>
      )}

      {flowState !== "done" && flowState !== "error" && ready && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <PasswordField
            label="Nova senha"
            value={password}
            onChange={setPassword}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
            placeholder="Minimo 6 caracteres"
          />
          <PasswordField
            label="Confirmar senha"
            value={confirm}
            onChange={setConfirm}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
            placeholder="Repita a senha"
          />

          {error && <FormFeedback tone="error" message={error} />}

          <button
            type="submit"
            disabled={flowState === "saving"}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-body font-semibold text-primary-foreground transition-all hover:bg-wine-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {flowState === "saving" ? <Spinner /> : "Salvar nova senha"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function Spinner() {
  return <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground animate-spin" />;
}
