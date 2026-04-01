import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { TextField } from "@/components/auth/TextField";
import { FormFeedback } from "@/components/auth/FormFeedback";

type FlowState = "idle" | "sending" | "sent";

export default function ForgotPasswordPage() {
  const { user, loading, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [flowState, setFlowState] = useState<FlowState>("idle");

  if (!loading && user) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-auth-base">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Informe seu email.");
      return;
    }

    setFlowState("sending");
    try {
      const result = await resetPassword(trimmed);
      if (result.error) {
        setError(result.error);
        setFlowState("idle");
        return;
      }
      setFlowState("sent");
    } catch {
      setError("Erro inesperado. Tente novamente.");
      setFlowState("idle");
    }
  };

  return (
    <AuthShell
      heroEyebrow="Recuperacao segura"
      heroTitle="Recupere sua senha sem perder o ritmo de estudo."
      heroSubtitle="Envie um link para redefinicao e volte para a plataforma em poucos minutos."
    >
      <div className="space-y-1 text-center">
        <h1 className="text-heading-2 text-auth-text-primary">Redefinir senha</h1>
        <p className="text-body-sm text-auth-text-muted">Fluxo rapido, seguro e orientado para resolucao.</p>
      </div>

      {flowState === "sent" ? (
        <div className="mt-6 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-heading-3 text-auth-text-primary">Verifique seu email</h2>
            <p className="text-body-sm text-auth-text-muted">
              Se existir uma conta com <strong className="text-auth-text-primary">{email}</strong>, enviamos um link para redefinir sua senha.
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-auth-border-subtle bg-auth-surface-soft p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-auth-text-muted" />
            <p className="text-caption text-auth-text-muted">O link e valido por 1 hora. Verifique spam e promocoes.</p>
          </div>
          <Link to="/login" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-auth-border-subtle bg-auth-surface-soft text-body-sm font-semibold text-auth-text-primary transition-all hover:border-auth-border-strong">
            Voltar para login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <TextField
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            hint="Enviaremos instrucoes para recuperar o acesso."
          />

          {error && <FormFeedback tone="error" message={error} />}

          <button
            type="submit"
            disabled={flowState === "sending"}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-body font-semibold text-primary-foreground transition-all hover:bg-wine-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {flowState === "sending" ? <Spinner /> : <>Enviar link de redefinicao <Mail className="h-4 w-4" /></>}
          </button>

          <Link to="/login" className="inline-flex h-10 w-full items-center justify-center text-body-sm text-auth-text-muted transition-colors hover:text-auth-text-primary">
            Voltar para login
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

function Spinner() {
  return <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground animate-spin" />;
}
