import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Lock, Mail, RefreshCw, ShieldCheck, Stethoscope, Trophy, User } from "lucide-react";
import { BrandIcon, BrandLogo } from "@/components/brand/BrandMark";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { TextField } from "@/components/auth/TextField";
import { PasswordField } from "@/components/auth/PasswordField";
import { FormFeedback } from "@/components/auth/FormFeedback";
import { RankingClimbWidget } from "@/components/auth/RankingClimbWidget";
import { cn } from "@/lib/utils";
import { HubSpotFormModal } from "@/components/auth/HubSpotFormModal";

type AuthMode = "login" | "signup";
type LoginMethod = "password" | "magic-link";
type FlowState = "idle" | "sending" | "sent";

function translateError(msg: string): string {
  const lower = msg.toLowerCase();
  const map: Array<[string, string]> = [
    ["invalid login credentials", "Email ou senha incorretos. Verifique e tente novamente."],
    ["email not confirmed", "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada (inclusive spam)."],
    ["user already registered", "Este e-mail já está cadastrado. Tente fazer login."],
    ["password should be at least 6 characters", "A senha deve ter pelo menos 6 caracteres."],
    ["email rate limit exceeded", "Você tentou criar a conta várias vezes seguidas. Aguarde 2–3 minutos antes de tentar novamente."],
    ["rate limit exceeded", "Muitas tentativas seguidas. Aguarde 2–3 minutos e tente novamente."],
    ["over_email_send_rate_limit", "Limite de envio de e-mails atingido. Aguarde alguns minutos antes de tentar novamente."],
    ["for security purposes, you can only request this after", "Por segurança, aguarde alguns segundos antes de tentar novamente."],
    ["too many requests", "Muitas tentativas seguidas. Aguarde 2–3 minutos e tente novamente."],
    ["network", "Erro de conexão. Verifique sua internet e tente novamente."],
    ["fetch", "Erro de conexão. Verifique sua internet e tente novamente."],
  ];
  for (const [key, value] of map) {
    if (lower.includes(key)) return value;
  }
  return "Ocorreu um erro inesperado. Tente novamente em alguns instantes.";
}

export default function LoginPage() {
  const { user, loading, signInWithPassword, signUpWithPassword, sendLoginLink } = useAuth();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(() =>
    searchParams.get("mode") === "signup" ? "signup" : "login",
  );
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [cooldown, setCooldown] = useState(false);
  const [resending, setResending] = useState(false);
  const [hubspotModalOpen, setHubspotModalOpen] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-auth-base">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Informe seu email.");
      return;
    }
    if (!password) {
      setError("Informe sua senha.");
      return;
    }

    if (mode === "signup") {
      if (!fullName.trim()) {
        setError("Informe seu nome completo.");
        return;
      }
      if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
    }

    setFlowState("sending");

    try {
      const result =
        mode === "login"
          ? await signInWithPassword(trimmedEmail, password)
          : await signUpWithPassword(trimmedEmail, password, fullName.trim());

      if (result.error) {
        setError(translateError(result.error));
        setFlowState("idle");
        return;
      }

      if (mode === "signup") {
        setHubspotModalOpen(true);
      }
    } catch {
      setError("Erro inesperado. Tente novamente.");
      setFlowState("idle");
    }
  };

  const handleMagicLinkSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Informe seu email.");
      return;
    }

    setFlowState("sending");

    try {
      const result = await sendLoginLink(trimmedEmail);
      if (result.error) {
        setError(translateError(result.error));
        setFlowState("idle");
        return;
      }
      setFlowState("sent");
    } catch {
      setError("Erro inesperado. Tente novamente.");
      setFlowState("idle");
    }
  };

  const handleResend = async () => {
    if (cooldown) return;
    setCooldown(true);
    setError("");
    setResending(true);

    try {
      const result = await sendLoginLink(email.trim().toLowerCase());
      if (result.error) setError(translateError(result.error));
    } catch {
      setError("Erro ao reenviar. Tente novamente.");
    } finally {
      setResending(false);
    }

    setTimeout(() => setCooldown(false), 30000);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setFlowState("idle");
    setCooldown(false);
    if (nextMode === "signup") setLoginMethod("password");
  };

  if (flowState === "sent") {
    return (
      <AuthShell
        heroEyebrow="Confirmação de acesso"
        heroTitle="Tudo pronto. Falta só confirmar no e-mail."
        heroSubtitle="Seu acesso continua seguro e sem fricção. Assim que confirmar, você entra direto na plataforma."
        mobileHero={<MobileHeaderAndHero compact />}
      >
        <LogoPro />
        <div className="mt-6 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-heading-3 text-auth-text-primary">Verifique seu e-mail</h2>
            <p className="text-body-sm text-auth-text-muted">
              Enviamos {loginMethod === "magic-link" ? "um link de acesso" : "um e-mail de confirmação"} para{" "}
              <strong className="text-auth-text-primary">{email}</strong>.
              {loginMethod === "magic-link"
                ? " Clique no link recebido para entrar imediatamente."
                : " Confirme sua conta para ativar o primeiro acesso."}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-auth-border-subtle bg-auth-surface-soft p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-auth-text-muted" />
            <p className="text-caption text-auth-text-muted">
              O link é válido por 1 hora. Caso não encontre, revise spam e promoções.
            </p>
          </div>

          {error && <FormFeedback tone="error" message={error} />}

          <div className="space-y-2 pt-1">
            {loginMethod === "magic-link" && (
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown || resending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-auth-border-subtle bg-auth-surface-soft text-body-sm font-medium text-auth-text-primary transition-all hover:border-auth-border-strong hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <RefreshCw className={cn("h-4 w-4", resending ? "animate-spin" : "")} />
                {cooldown ? "Aguarde para reenviar" : resending ? "Reenviando..." : "Reenviar link"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setFlowState("idle");
                setError("");
                setCooldown(false);
              }}
              className="flex h-11 w-full items-center justify-center rounded-xl text-body-sm font-semibold text-primary transition-colors hover:text-primary/85"
            >
              Voltar
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heroEyebrow="PRO ENAMED"
      heroTitle="Simulados para o ENAMED, com direção"
      heroSubtitle="Entre, realize os simulados e compare seu desempenho no ranking nacional."
      mobileHero={<MobileHeaderAndHero />}
      mobileFooter={<MobileTrustFooter />}
    >
      <div className="hidden md:block">
        <LogoPro />
      </div>

      <div className="mt-1.5 flex rounded-lg border border-auth-border-subtle bg-auth-surface-soft p-0.5 lg:mt-2.5">
        {(["login", "signup"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => switchMode(tab)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-body-sm transition-all duration-200 ease-out lg:rounded-[6px] lg:px-2.5 lg:py-1 lg:text-[12px]",
              mode === tab
                ? "relative z-[1] font-semibold bg-auth-input text-auth-text-primary shadow-[0_2px_14px_-4px_rgba(0,0,0,0.55),inset_0_1px_0_hsl(var(--auth-text-primary)/0.16)] ring-1 ring-inset ring-primary/40"
                : "relative z-0 font-medium text-[hsl(var(--auth-text-primary)/0.52)] hover:bg-white/[0.045] hover:text-[hsl(var(--auth-text-primary)/0.88)]"
            )}
          >
            {tab === "login" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <p className="mt-3 text-body-sm text-auth-hero-support md:hidden">
        {mode === "login"
          ? "Entre e continue de onde parou."
          : "Crie sua conta e comece hoje."}
      </p>

      <div className="mt-3 lg:mt-2.5">
        <p className="text-auth-form-micro text-center">
          Acesse com e-mail
        </p>
      </div>

      <AnimatePresence mode="wait">
        {mode === "login" && loginMethod === "password" && (
          <motion.form
            key="login-password"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handlePasswordSubmit}
            className="mt-3 space-y-3"
          >
            <TextField
              label="Seu e-mail"
              icon={Mail}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@exemplo.com.br"
              labelClassName="text-auth-form-label"
            />
            <PasswordField
              label="Sua senha"
              value={password}
              onChange={setPassword}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((state) => !state)}
              labelClassName="text-auth-form-label"
            />

            {error && <FormFeedback tone="error" message={error} />}

            <button
              type="submit"
              disabled={flowState === "sending"}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-body font-semibold uppercase tracking-[0.02em] text-primary-foreground transition-all hover:bg-wine-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-55 lg:h-9 lg:rounded-md lg:gap-1.5 lg:text-[12px]"
            >
              {flowState === "sending" ? <Spinner /> : <>Entrar na plataforma <ArrowRight className="h-4 w-4" /></>}
            </button>

            <div className="flex items-center justify-between text-[12px] pt-2">
              <Link to="/forgot-password" className="text-auth-link-subtle hover:underline">
                Esqueceu sua senha?
              </Link>
              <button
                type="button"
                onClick={() => {
                  setLoginMethod("magic-link");
                  setError("");
                }}
                className="text-auth-link-accent font-semibold hover:underline"
              >
                Usar magic link
              </button>
            </div>
          </motion.form>
        )}

        {mode === "login" && loginMethod === "magic-link" && (
          <motion.form
            key="login-magic"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleMagicLinkSubmit}
            className="mt-3 space-y-3"
          >
            <TextField
              label="Seu e-mail"
              icon={Mail}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@exemplo.com.br"
              hint="Enviamos um link seguro para seu e-mail."
              labelClassName="text-auth-form-label"
            />

            {error && <FormFeedback tone="error" message={error} />}

            <button
              type="submit"
              disabled={flowState === "sending"}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-body font-semibold uppercase tracking-[0.02em] text-primary-foreground transition-all hover:bg-wine-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-55 lg:h-9 lg:rounded-md lg:gap-1.5 lg:text-[12px]"
            >
              {flowState === "sending" ? <Spinner /> : <>Receber link de acesso <Mail className="h-4 w-4" /></>}
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginMethod("password");
                setError("");
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-auth-border-subtle bg-auth-surface-soft text-body-sm font-semibold text-auth-text-primary transition-all hover:border-auth-border-strong hover:bg-auth-surface-soft/90 lg:h-9 lg:rounded-md lg:gap-1.5 lg:text-[12px]"
            >
              <Lock className="h-4 w-4" />
              Entrar com senha
            </button>
          </motion.form>
        )}

        {mode === "signup" && (
          <motion.form
            key="signup"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handlePasswordSubmit}
            className="mt-3 space-y-3"
          >
            <TextField
              label="Como você gosta de ser chamado(a)"
              icon={User}
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Seu nome"
              labelClassName="text-auth-form-label"
            />
            <TextField
              label="Seu e-mail"
              icon={Mail}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@exemplo.com.br"
              labelClassName="text-auth-form-label"
            />
            <PasswordField
              label="Crie uma senha"
              value={password}
              onChange={setPassword}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((state) => !state)}
              placeholder="Mínimo de 6 caracteres"
              labelClassName="text-auth-form-label"
            />

            {error && <FormFeedback tone="error" message={error} />}

            <button
              type="submit"
              disabled={flowState === "sending"}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-body font-semibold uppercase tracking-[0.02em] text-primary-foreground transition-all hover:bg-wine-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-55 lg:h-9 lg:rounded-md lg:gap-1.5 lg:text-[12px]"
            >
              {flowState === "sending" ? <Spinner /> : <>Criar minha conta <ArrowRight className="h-4 w-4" /></>}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-4 hidden md:block text-center text-[11px] text-auth-text-muted/90">
        <p className="mx-auto max-w-[34ch] leading-snug text-auth-text-primary">
          Ao continuar, você concorda com nossos termos e política de privacidade.
        </p>
      </div>

      <HubSpotFormModal
        open={hubspotModalOpen}
        onOpenChange={(open) => {
          setHubspotModalOpen(open);
          if (!open && mode === "signup") {
            setFlowState("sent");
          }
        }}
        prefillEmail={email}
        prefillName={fullName}
      />
    </AuthShell>
  );
}

function LogoPro() {
  return (
    <div className="text-center">
      <BrandLogo
        variant="md"
        tone="onDark"
        className="mx-auto max-h-8 w-auto object-center sm:max-h-9"
      />
    </div>
  );
}

function MobileHeaderAndHero({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-auth-border-subtle bg-auth-surface-soft px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <BrandIcon size="sm" className="h-6 w-6" alt="" />
            </div>
            <span className="text-body font-semibold text-auth-hero-headline">SANARFLIX PRO</span>
          </div>
          <span className="rounded-full border border-primary/35 bg-primary/15 px-3 py-1 text-caption font-semibold uppercase tracking-[0.08em] text-primary-foreground">
            ENAMED
          </span>
        </div>
      </div>

      {!compact && (
        <div className="rounded-2xl border border-auth-border-subtle bg-auth-hero-surface px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <h2 className="max-w-[14ch] text-heading-1 leading-[1.02] tracking-tight text-auth-hero-headline">
                Simulados para o ENAMED, com direção
              </h2>
              <p className="text-body text-auth-hero-subtitle">Compare seu desempenho no ranking nacional.</p>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-1 inline-flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 text-caption font-semibold text-primary-foreground"
            >
              +94.2%
            </motion.div>
          </div>

          <div className="mt-4">
            <RankingClimbWidget compact />
          </div>
        </div>
      )}
    </div>
  );
}

function MobileTrustFooter() {
  return (
    <div className="space-y-3 text-center">
      <p className="text-auth-form-micro text-[11px] tracking-[0.12em]">Ambiente de alta performance</p>
      <div className="flex items-center justify-center gap-5 text-auth-text-muted/90">
        <ShieldCheck className="h-4 w-4" />
        <Stethoscope className="h-4 w-4" />
        <Trophy className="h-4 w-4" />
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground animate-spin" />;
}
