import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { BrandIcon } from '@/components/brand/BrandMark';
import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';

type SSOState = 'loading' | 'redirecting' | 'error';

export default function AuthSSOPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<SSOState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const calledRef = useRef(false);

  const email = searchParams.get('email')?.trim().toLowerCase() || '';
  const name = searchParams.get('name')?.trim() || '';
  const segment = searchParams.get('segment') || '';

  // noindex
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!email) {
      logger.log('[AuthSSO] No email param, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    async function handleSSO() {
      // Check if already logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        logger.log('[AuthSSO] User already logged in, redirecting to home');
        navigate('/', { replace: true });
        return;
      }

      logger.log('[AuthSSO] Requesting magic link for:', email);

      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/sso-magic-link`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
            },
            body: JSON.stringify({ email, name, segment }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          logger.error('[AuthSSO] Error response:', res.status, data);
          setState('error');
          setErrorMessage(data.error || 'Erro ao gerar link de acesso.');
          return;
        }

        if (data.url) {
          logger.log('[AuthSSO] Redirecting to magic link');
          setState('redirecting');
          window.location.href = data.url;
        } else {
          setState('error');
          setErrorMessage('Resposta inesperada do servidor.');
        }
      } catch (err) {
        logger.error('[AuthSSO] Fetch error:', err);
        setState('error');
        setErrorMessage('Erro de conexão. Verifique sua internet e tente novamente.');
      }
    }

    handleSSO();
  }, [email, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center space-y-6"
      >
        {/* Brand */}
        <div>
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/25 mx-auto mb-4">
            <BrandIcon size="lg" className="h-10 w-10" alt="" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
            SanarFlix
          </span>
          <h1 className="text-heading-2 text-foreground mt-0.5">PRO: ENAMED</h1>
        </div>

        {/* State content */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {(state === 'loading' || state === 'redirecting') && (
            <div className="space-y-4">
              <div className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-body text-foreground font-medium">
                {state === 'loading' ? 'Entrando na sua conta...' : 'Redirecionando...'}
              </p>
              <p className="text-body-sm text-muted-foreground">
                Aguarde enquanto preparamos seu acesso.
              </p>
            </div>
          )}

          {state === 'error' && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-4"
            >
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-body text-foreground font-medium">Não foi possível entrar</p>
              <p className="text-body-sm text-muted-foreground">{errorMessage}</p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors mt-2"
              >
                <RefreshCw className="h-4 w-4" />
                Ir para o login
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
