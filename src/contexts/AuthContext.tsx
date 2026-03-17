import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Sign in with email + password (existing users only). */
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign up with email + password (creates guest account). */
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  /** Send magic link for LOGIN only (existing users). Will not create new accounts. */
  sendLoginLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getRedirectUrl(): string {
  const origin = window.location.origin;
  return `${origin}/auth/callback`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        const newUserId = currentSession?.user?.id ?? null;

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

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      userIdRef.current = existingSession?.user?.id ?? null;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[AuthContext] Signing in with password:', normalizedEmail);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      console.log('[AuthContext] Password sign-in error:', error.message);
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, fullName: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[AuthContext] Signing up with password:', normalizedEmail);

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getRedirectUrl(),
        data: { full_name: fullName },
      },
    });

    if (error) {
      console.log('[AuthContext] Password sign-up error:', error.message);
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const sendLoginLink = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[AuthContext] Sending login magic link to:', normalizedEmail);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getRedirectUrl(),
        shouldCreateUser: false,
      },
    });

    if (error) {
      console.log('[AuthContext] Login link error:', error.message);
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    console.log('[AuthContext] Signing out');
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithPassword, signUpWithPassword, sendLoginLink, signOut }}>
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
