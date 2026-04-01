import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { BrandIcon } from '@/components/brand/BrandMark';
import { motion } from 'framer-motion';

type CallbackState = 'verifying' | 'success' | 'error';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function handleCallback() {
      console.log('[AuthCallback] Processing callback, URL hash:', window.location.hash ? '(present)' : '(none)');

      try {
        // Supabase JS client automatically picks up the token from the URL hash/query
        // We just need to check the session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[AuthCallback] Session error:', error.message);
          setState('error');
          setErrorMessage(translateCallbackError(error.message));
          return;
        }

        if (data.session) {
          console.log('[AuthCallback] Session established for user:', data.session.user.id);
          setState('success');
          // Short delay for visual feedback, then redirect
          setTimeout(() => navigate('/', { replace: true }), 600);
        } else {
          // Try to extract and verify token from URL
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const queryParams = new URLSearchParams(window.location.search);

          const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
          const errorParam = hashParams.get('error') || queryParams.get('error');
          const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');

          if (errorParam) {
            console.error('[AuthCallback] Auth error from URL:', errorParam, errorDescription);
            setState('error');
            setErrorMessage(translateCallbackError(errorDescription || errorParam));
            return;
          }

          if (accessToken && refreshToken) {
            console.log('[AuthCallback] Setting session from URL tokens');
            const { error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setError) {
              console.error('[AuthCallback] setSession error:', setError.message);
              setState('error');
              setErrorMessage(translateCallbackError(setError.message));
              return;
            }

            setState('success');
            setTimeout(() => navigate('/', { replace: true }), 600);
          } else {
            // No session and no tokens — likely expired or invalid link
            console.warn('[AuthCallback] No session or tokens found');
            setState('error');
            setErrorMessage('Link de acesso expirado ou inválido. Solicite um novo link.');
          }
        }
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setState('error');
        setErrorMessage('Erro inesperado ao verificar o link. Tente novamente.');
      }
    }

    handleCallback();
  }, [navigate]);

  function translateCallbackError(msg: string): string {
    if (msg.includes('expired') || msg.includes('Token has expired')) {
      return 'Link de acesso expirado. Solicite um novo link de acesso.';
    }
    if (msg.includes('invalid') || msg.includes('Invalid')) {
      return 'Link de acesso inválido. Solicite um novo link.';
    }
    if (msg.includes('already used') || msg.includes('already been used')) {
      return 'Este link já foi utilizado. Solicite um novo link de acesso.';
    }
    return msg;
  }

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
            sanarflix
          </span>
          <h1 className="text-heading-2 text-foreground mt-0.5">PRO: ENAMED</h1>
        </div>

        {/* State content */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {state === 'verifying' && (
            <div className="space-y-4">
              <div className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-body text-foreground font-medium">Verificando seu acesso...</p>
              <p className="text-body-sm text-muted-foreground">Estamos confirmando seu link de autenticação.</p>
            </div>
          )}

          {state === 'success' && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-4"
            >
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-body text-foreground font-medium">Acesso confirmado!</p>
              <p className="text-body-sm text-muted-foreground">Redirecionando para a plataforma...</p>
            </motion.div>
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
              <p className="text-body text-foreground font-medium">Não foi possível confirmar</p>
              <p className="text-body-sm text-muted-foreground">{errorMessage}</p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors mt-2"
              >
                <RefreshCw className="h-4 w-4" />
                Voltar para o login
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
