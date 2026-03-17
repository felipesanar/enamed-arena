import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Mail, User, ArrowRight, CheckCircle2, Clock, RefreshCw } from 'lucide-react';

type AuthMode = 'login' | 'signup';
type FlowState = 'idle' | 'sending' | 'sent';


export default function LoginPage() {
  const { user, loading, sendLoginLink, sendSignUpLink } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [cooldown, setCooldown] = useState(false);
  const [resending, setResending] = useState(false);

  // Already logged in → redirect
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

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Informe seu email.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setError('Informe seu nome completo.');
      return;
    }

    setFlowState('sending');

    try {
      let result: { error: string | null };

      if (mode === 'login') {
        result = await sendLoginLink(trimmedEmail);
      } else {
        result = await sendSignUpLink(trimmedEmail, fullName.trim());
      }

      if (result.error) {
        setError(translateError(result.error));
        setFlowState('idle');
      } else {
        console.log('[LoginPage] Magic link sent successfully to:', trimmedEmail);
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
    setFlowState('sending');

    try {
      const trimmedEmail = email.trim().toLowerCase();
      let result: { error: string | null };

      if (mode === 'login') {
        result = await sendLoginLink(trimmedEmail);
      } else {
        result = await sendSignUpLink(trimmedEmail, fullName.trim());
      }

      if (result.error) {
        setError(translateError(result.error));
        setFlowState('sent'); // Stay on sent screen
      } else {
        console.log('[LoginPage] Magic link resent to:', trimmedEmail);
        setFlowState('sent');
      }
    } catch {
      setError('Erro ao reenviar. Tente novamente.');
      setFlowState('sent');
    }

    // Cooldown for 30 seconds
    setTimeout(() => setCooldown(false), 30000);
  };

  const handleBackToForm = () => {
    setFlowState('idle');
    setError('');
    setCooldown(false);
  };

  function translateError(msg: string): string {
    if (msg.includes('Signups not allowed for otp')) {
      return 'Nenhuma conta encontrada com este email. Se você é um novo usuário, crie sua conta na aba "Experimentar grátis".';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Confirme seu email antes de fazer login.';
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
  }

  // ─── Sent State ───
  if (flowState === 'sent') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md space-y-6"
        >
          {/* Brand */}
          <div className="text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mx-auto mb-4">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">sanarflix</span>
            <h1 className="text-heading-2 text-foreground mt-0.5">PRO: ENAMED</h1>
          </div>

          {/* Sent card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <h2 className="text-heading-3 text-foreground">Verifique seu email</h2>
              <p className="text-body-sm text-muted-foreground">
                Enviamos um link de acesso para <strong className="text-foreground">{email}</strong>.
                Clique no link do email para {mode === 'login' ? 'entrar na' : 'ativar sua conta na'} plataforma.
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
                <button
                  onClick={handleResend}
                  disabled={cooldown || flowState === 'sending'}
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-body-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-4 w-4 ${flowState === 'sending' ? 'animate-spin' : ''}`} />
                  {cooldown ? 'Aguarde para reenviar' : flowState === 'sending' ? 'Reenviando...' : 'Reenviar link'}
                </button>
                <button
                  onClick={handleBackToForm}
                  className="text-body-sm text-primary font-semibold hover:underline"
                >
                  Usar outro email
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Form State (idle / sending) ───
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Brand */}
        <div className="text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mx-auto mb-4">
            <GraduationCap className="h-7 w-7 text-primary-foreground" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
            sanarflix
          </span>
          <h1 className="text-heading-2 text-foreground mt-0.5">PRO: ENAMED</h1>
          <p className="text-body-sm text-muted-foreground mt-2">
            Plataforma premium de simulados para residência médica
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {/* Tabs */}
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
                {m === 'login' ? 'Entrar' : 'Experimentar grátis'}
              </button>
            ))}
          </div>

          {/* Context info */}
          {mode === 'login' ? (
            <div className="mb-4 p-3 rounded-xl bg-accent/50 border border-border">
              <p className="text-body-sm text-muted-foreground">
                Alunos SanarFlix e PRO: ENAMED, entrem com o email da sua conta.
                Não alunos que já têm conta também entram por aqui.
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-accent/50 border border-border">
              <p className="text-body-sm text-muted-foreground">
                Crie sua conta gratuita para acessar simulados como não aluno. Já é aluno SanarFlix?{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-primary font-semibold hover:underline"
                >
                  Entre com sua conta
                </button>
              </p>
            </div>
          )}

          <form onSubmit={handleSendLink} className="space-y-4">
            {mode === 'signup' && (
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
            )}

            <div>
              <label className="text-body-sm font-medium text-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                  required
                />
              </div>
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

            <button
              type="submit"
              disabled={flowState === 'sending'}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {flowState === 'sending' ? (
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Enviar link de acesso' : 'Criar conta gratuita'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-caption text-muted-foreground">
          {mode === 'login'
            ? 'Enviaremos um link seguro para o seu email. Sem necessidade de senha.'
            : 'Ao criar conta, você acessará como não aluno. Alunos SanarFlix entram por login.'}
        </p>
      </motion.div>
    </div>
  );
}
