import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

type FlowState = 'idle' | 'saving' | 'done' | 'error';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase handles the token exchange from the URL hash automatically
    // We just need to check if a session exists after the recovery flow
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Also check immediately in case event already fired
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }

    setFlowState('saving');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setFlowState('idle');
      } else {
        setFlowState('done');
        setTimeout(() => navigate('/', { replace: true }), 2500);
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
      setFlowState('idle');
    }
  };

  if (flowState === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
          <Brand />
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-heading-3 text-foreground">Senha atualizada!</h2>
            <p className="text-body-sm text-muted-foreground">
              Sua senha foi redefinida com sucesso. Redirecionando...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-6">
          <Brand />
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center space-y-4">
            <div className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-body-sm text-muted-foreground">Verificando link de redefinição...</p>
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
          <h2 className="text-heading-3 text-foreground mb-2">Nova senha</h2>
          <p className="text-body-sm text-muted-foreground mb-6">Defina uma nova senha para sua conta.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField label="Nova senha" placeholder="Mínimo 6 caracteres" value={password} onChange={setPassword} show={show} onToggle={() => setShow(!show)} />
            <PasswordField label="Confirmar senha" placeholder="Repita a senha" value={confirm} onChange={(v) => setConfirm(v)} show={show} onToggle={() => setShow(!show)} />

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-body-sm text-destructive font-medium bg-destructive/10 rounded-lg p-3">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={flowState === 'saving'}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {flowState === 'saving'
                ? <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : 'Salvar nova senha'}
            </button>
          </form>
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

function PasswordField({ label, placeholder, value, onChange, show, onToggle }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
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
        <button type="button" onClick={onToggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
