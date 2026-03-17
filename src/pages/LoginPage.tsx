import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Mail, User, Lock, ArrowRight, CheckCircle2, Clock, RefreshCw, Wand2, Eye, EyeOff } from 'lucide-react';

type AuthMode = 'login' | 'signup';
type LoginMethod = 'password' | 'magic-link';
type FlowState = 'idle' | 'sending' | 'sent';

export default function LoginPage() {
  const { user, loading, signInWithPassword, signUpWithPassword, sendLoginLink } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [cooldown, setCooldown] = useState(false);
  const [resending, setResending] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Handlers ───

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError('Informe seu email.'); return; }
    if (!password) { setError('Informe sua senha.'); return; }

    if (mode === 'signup') {
      if (!fullName.trim()) { setError('Informe seu nome completo.'); return; }
      if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    }

    setFlowState('sending');

    try {
      let result: { error: string | null };

      if (mode === 'login') {
        result = await signInWithPassword(trimmedEmail, password);
      } else {
        result = await signUpWithPassword(trimmedEmail, password, fullName.trim());
      }

      if (result.error) {
        setError(translateError(result.error));
        setFlowState('idle');
      } else {
        console.log('[LoginPage] Password auth successful for:', trimmedEmail);
        if (mode === 'signup') {
          // Supabase may require email confirmation
          setFlowState('sent');
        }
        // For login, auth state change will redirect automatically
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
      setFlowState('idle');
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError('Informe seu email.'); return; }

    setFlowState('sending');

    try {
      const result = await sendLoginLink(trimmedEmail);

      if (result.error) {
        setError(translateError(result.error));
        setFlowState('idle');
      } else {
        console.log('[LoginPage] Magic link sent to:', trimmedEmail);
        setFlowState('sent');
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
      setFlowState('idle');
    }
  };

  const handleResend = async () => {
    if (cooldown) return;
    setCooldown(true);
    setError('');
    setResending(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const result = await sendLoginLink(trimmedEmail);

      if (result.error) {
        setError(translateError(result.error));
      } else {
        console.log('[LoginPage] Magic link resent to:', trimmedEmail);
      }
    } catch {
      setError('Erro ao reenviar. Tente novamente.');
    } finally {
      setResending(false);
    }

    setTimeout(() => setCooldown(false), 30000);
  };

  const handleBackToForm = () => {
    setFlowState('idle');
    setError('');
    setCooldown(false);
  };

  function translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) {
      return 'Email ou senha incorretos. Verifique suas credenciais.';
    }
    if (msg.includes('Signups not allowed for otp')) {
      return 'Nenhuma conta encontrada com este email. Verifique o endereço ou crie uma conta.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Confirme seu email antes de fazer login. Verifique sua caixa de entrada.';
    }
    if (msg.includes('User already registered')) {
      return 'Este email já está cadastrado. Use a aba "Entrar" para acessar sua conta.';
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
    }
    if (msg.includes('invalid') || msg.includes('Invalid')) {
      return 'Email inválido. Verifique o endereço informado.';
    }
    return msg;
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError('');
    setFlowState('idle');
    setCooldown(false);
    if (newMode === 'signup') {
      setLoginMethod('password');
    }
  }

  // ─── Sent State (magic link or signup confirmation) ───
  if (flowState === 'sent') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md space-y-6"
        >
          <Brand />

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <h2 className="text-heading-3 text-foreground">Verifique seu email</h2>
              <p className="text-body-sm text-muted-foreground">
                Enviamos {loginMethod === 'magic-link' ? 'um link de acesso' : 'um email de confirmação'} para{' '}
                <strong className="text-foreground">{email}</strong>.
                {loginMethod === 'magic-link'
                  ? ' Clique no link do email para entrar na plataforma.'
                  : ' Confirme seu email para ativar sua conta.'}
              </p>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/50 border border-border">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-caption text-muted-foreground text-left">
                  O link é válido por 1 hora. Verifique também a pasta de spam.
                </p>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-body-sm text-destructive font-medium bg-destructive/10 rounded-lg p-3"
                >
                  {error}
                </motion.p>
              )}

              <div className="flex flex-col gap-3 pt-2">
                {loginMethod === 'magic-link' && (
                  <button
                    onClick={handleResend}
                    disabled={cooldown || resending}
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-body-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
                    {cooldown ? 'Aguarde para reenviar' : resending ? 'Reenviando...' : 'Reenviar link'}
                  </button>
                )}
                <button
                  onClick={handleBackToForm}
                  className="text-body-sm text-primary font-semibold hover:underline"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Main Form ───
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-6"
      >
        <Brand />

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {/* Mode tabs */}
          <div className="flex mb-6 bg-muted rounded-xl p-1">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-body-sm font-semibold transition-all ${
                  mode === m
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {/* Context info */}
          {mode === 'login' ? (
            <div className="mb-4 p-3 rounded-xl bg-accent/50 border border-border">
              <p className="text-body-sm text-muted-foreground">
                Alunos SanarFlix e PRO: ENAMED, entrem com o email e senha da sua conta.
                Não alunos que já têm conta também entram por aqui.
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-accent/50 border border-border">
              <p className="text-body-sm text-muted-foreground">
                Crie sua conta para acessar simulados como não aluno. Já é aluno SanarFlix?{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-primary font-semibold hover:underline"
                >
                  Entre com sua conta
                </button>
              </p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {mode === 'login' && loginMethod === 'password' && (
              <motion.form
                key="login-password"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-4"
              >
                <FieldEmail value={email} onChange={setEmail} />
                <FieldPassword value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} />

                <ErrorMessage error={error} />

                <button
                  type="submit"
                  disabled={flowState === 'sending'}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {flowState === 'sending' ? <Spinner /> : <>Entrar <ArrowRight className="h-4 w-4" /></>}
                </button>

              </motion.form>
            )}

            {mode === 'login' && loginMethod === 'magic-link' && (
              <motion.form
                key="login-magic"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleMagicLinkSubmit}
                className="space-y-4"
              >
                <FieldEmail value={email} onChange={setEmail} />

                <ErrorMessage error={error} />

                <button
                  type="submit"
                  disabled={flowState === 'sending'}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {flowState === 'sending' ? <Spinner /> : <>Enviar link de acesso <Mail className="h-4 w-4" /></>}
                </button>

                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-caption text-muted-foreground">ou</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  type="button"
                  onClick={() => { setLoginMethod('password'); setError(''); }}
                  className="w-full h-11 rounded-xl border border-border text-body-sm font-semibold text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Entrar com email e senha
                </button>
              </motion.form>
            )}

            {mode === 'signup' && (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-4"
              >
                <div>
                  <label className="text-body-sm font-medium text-foreground mb-1.5 block">Nome completo</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <FieldEmail value={email} onChange={setEmail} />
                <FieldPassword value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} label="Criar senha" placeholder="Mínimo 6 caracteres" />

                <ErrorMessage error={error} />

                <button
                  type="submit"
                  disabled={flowState === 'sending'}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {flowState === 'sending' ? <Spinner /> : <>Criar conta gratuita <ArrowRight className="h-4 w-4" /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-caption text-muted-foreground">
          {mode === 'login'
            ? 'Use suas credenciais para acessar a plataforma.'
            : 'Ao criar conta, você acessará como não aluno. Alunos SanarFlix entram por login.'}
        </p>
      </motion.div>
    </div>
  );
}

// ─── Reusable sub-components ───

function Brand() {
  return (
    <div className="text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mx-auto mb-4">
        <GraduationCap className="h-7 w-7 text-primary-foreground" />
      </div>
      <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">sanarflix</span>
      <h1 className="text-heading-2 text-foreground mt-0.5">PRO: ENAMED</h1>
      <p className="text-body-sm text-muted-foreground mt-2">
        Plataforma premium de simulados para residência médica
      </p>
    </div>
  );
}

function FieldEmail({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-body-sm font-medium text-foreground mb-1.5 block">Email</label>
      <div className="relative">
        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="email"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="seu@email.com"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
          required
        />
      </div>
    </div>
  );
}

function FieldPassword({ value, onChange, show, onToggle, label = 'Senha', placeholder = 'Sua senha' }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; label?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-body-sm font-medium text-foreground mb-1.5 block">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-11 pl-10 pr-11 rounded-xl border border-border bg-background text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function ErrorMessage({ error }: { error: string }) {
  if (!error) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-body-sm text-destructive font-medium bg-destructive/10 rounded-lg p-3"
    >
      {error}
    </motion.p>
  );
}

function Spinner() {
  return <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />;
}
