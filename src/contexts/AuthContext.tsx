import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Send magic link for LOGIN only (existing users). Will not create new accounts. */
  sendLoginLink: (email: string) => Promise<{ error: string | null }>;
  /** Send magic link for SIGNUP (creates guest account if email doesn't exist). */
  sendSignUpLink: (email: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getRedirectUrl(): string {
  const origin = window.location.origin;
  // Always redirect to /auth/callback for token verification
  return `${origin}/auth/callback`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Set up auth state listener FIRST (per Supabase best practices)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        const newUserId = currentSession?.user?.id ?? null;

        // TOKEN_REFRESHED with same user → update session silently, no state churn
        if (event === 'TOKEN_REFRESHED' && newUserId === userIdRef.current) {
          console.log('[AuthContext] Token refreshed silently (same user)');
          setSession(currentSession);
          return;
        }

        console.log('[AuthContext] Auth state changed:', event);
        userIdRef.current = newUserId;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    // 2. Then check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      userIdRef.current = existingSession?.user?.id ?? null;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendLoginLink = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[AuthContext] Sending login magic link to:', normalizedEmail);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getRedirectUrl(),
        shouldCreateUser: false, // LOGIN ONLY — do not create new accounts
      },
    });

    if (error) {
      console.log('[AuthContext] Login link error:', error.message);
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const sendSignUpLink = useCallback(async (email: string, fullName: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[AuthContext] Sending signup magic link to:', normalizedEmail);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getRedirectUrl(),
        shouldCreateUser: true, // SIGNUP — allows creating new guest accounts
        data: { full_name: fullName },
      },
    });

    if (error) {
      console.log('[AuthContext] Signup link error:', error.message);
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    console.log('[AuthContext] Signing out');
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, sendLoginLink, sendSignUpLink, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
