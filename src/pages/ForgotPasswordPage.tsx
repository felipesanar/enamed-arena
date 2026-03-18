import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Mail, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

type FlowState = 'idle' | 'sending' | 'sent';

export default function ForgotPasswordPage() {
  const { user, loading, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');

  if (!loading && user) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Informe seu email.'); return; }

    setFlowState('sending');
    try {
      const result = await resetPassword(trimmed);
      if (result.error) {
        setError(result.error);
        setFlowState('idle');
      } else {
        setFlowState('sent');
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
      setFlowState('idle');
    }
  };

  if (flowState === 'sent') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
          <Brand />
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-heading-3 text-foreground">Verifique seu email</h2>
            <p className="text-body-sm text-muted-foreground">
              Se existe uma conta com <strong className="text-foreground">{email}</strong>, enviamos um link para redefinir sua senha.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/50 border border-border">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-caption text-muted-foreground text-left">
                O link é válido por 1 hora. Verifique também a pasta de spam.
              </p>
            </div>
            <Link to="/login" className="inline-block text-body-sm text-primary font-semibold hover:underline mt-2">
              Voltar para login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
        <Brand />
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-heading-3 text-foreground mb-2">Esqueceu sua senha?</h2>
          <p className="text-body-sm text-muted-foreground mb-6">
            Informe o email da sua conta e enviaremos um link para redefinir sua senha.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-body-sm text-destructive font-medium bg-destructive/10 rounded-lg p-3">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={flowState === 'sending'}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {flowState === 'sending'
                ? <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <>Enviar link de redefinição <Mail className="h-4 w-4" /></>}
            </button>
          </form>

          <Link to="/login" className="flex items-center gap-1.5 justify-center mt-4 text-body-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function Brand() {
  return (
    <div className="text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mx-auto mb-4">
        <GraduationCap className="h-7 w-7 text-primary-foreground" />
      </div>
      <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">sanarflix</span>
      <h1 className="text-heading-2 text-foreground mt-0.5">PRO: ENAMED</h1>
    </div>
  );
}
