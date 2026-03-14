import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  // Already logged in → redirect
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (result.error) {
          setError(translateError(result.error));
        }
        // onAuthStateChange handles redirect
      } else {
        if (!fullName.trim()) {
          setError('Informe seu nome completo.');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('A senha deve ter ao menos 6 caracteres.');
          setSubmitting(false);
          return;
        }
        const result = await signUp(email, password, fullName);
        if (result.error) {
          setError(translateError(result.error));
        } else {
          setSignUpSuccess(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  function translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email ou senha inválidos. Verifique suas credenciais.';
    if (msg.includes('Email not confirmed')) return 'Confirme seu email antes de fazer login.';
    if (msg.includes('User already registered')) return 'Este email já está cadastrado. Faça login.';
    if (msg.includes('Password should be')) return 'A senha deve ter ao menos 6 caracteres.';
    return msg;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

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
          {signUpSuccess ? (
            <div className="text-center py-4 space-y-3">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <Mail className="h-6 w-6 text-success" />
              </div>
              <h2 className="text-heading-3 text-foreground">Verifique seu email</h2>
              <p className="text-body-sm text-muted-foreground">
                Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link para ativar sua conta.
              </p>
              <button
                onClick={() => { setMode('login'); setSignUpSuccess(false); }}
                className="text-body-sm text-primary font-semibold hover:underline mt-2"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex mb-6 bg-muted rounded-xl p-1">
                {(['login', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(''); }}
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

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div>
                  <label className="text-body-sm font-medium text-foreground mb-1.5 block">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-12 rounded-xl border border-border bg-background text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === 'login' ? 'Entrar' : 'Criar conta'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-caption text-muted-foreground">
          Plataforma exclusiva para candidatos à residência médica
        </p>
      </motion.div>
    </div>
  );
}
