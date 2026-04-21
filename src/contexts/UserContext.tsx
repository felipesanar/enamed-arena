import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { UserProfile, OnboardingProfile, UserSegment, OnboardingStatus } from '@/types';
import { SEGMENT_ACCESS } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';

interface UserContextValue {
  profile: UserProfile | null;
  onboarding: OnboardingProfile | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  profileError: string | null;
  dataSource: 'supabase' | 'loading' | 'unauthenticated';
  onboardingEditLocked: boolean;
  onboardingEditReason: string | null;
  onboardingNextEditableAt: string | null;

  saveOnboarding: (data: { specialty: string; targetInstitutions: string[] }) => Promise<void>;
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'avatarUrl'>>) => void;
  resetOnboarding: () => void;
  refreshProfile: () => Promise<void>;
  refreshOnboardingEditGuard: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'supabase' | 'loading' | 'unauthenticated'>('loading');
  const [onboardingEditLocked, setOnboardingEditLocked] = useState(false);
  const [onboardingEditReason, setOnboardingEditReason] = useState<string | null>(null);
  const [onboardingNextEditableAt, setOnboardingNextEditableAt] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseRpc = (name: string, params?: Record<string, unknown>) => (supabase.rpc as any)(name, params);

  const fetchOnboardingEditGuard = useCallback(async () => {
    if (!authUser) return;
    const { data, error } = await supabaseRpc('get_onboarding_edit_guard_state');
    if (error) {
      logger.error('[UserContext] Onboarding edit guard fetch error:', error);
      setOnboardingEditLocked(false);
      setOnboardingEditReason(null);
      setOnboardingNextEditableAt(null);
      return;
    }
    const row = Array.isArray(data) ? data[0] : null;
    setOnboardingEditLocked(!(row?.can_edit ?? true));
    setOnboardingEditReason(row?.reason ?? null);
    setOnboardingNextEditableAt(row?.next_edit_available_at ?? null);
  }, [authUser]);

  const fetchUserData = useCallback(async (userId: string, silent = false) => {
    logger.log('[UserContext] Fetching user data from Supabase', silent ? '(silent)' : '');
    if (!silent) {
      setIsLoading(true);
      setDataSource('loading');
    }
    setProfileError(null);

    try {
      const [profileResult, onboardingResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('onboarding_profiles').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileResult.error) {
        logger.error('[UserContext] Profile fetch error:', profileResult.error);
        setProfileError('Erro ao carregar perfil. Tente recarregar a página.');
      }

      if (profileResult.data) {
        const p = profileResult.data;
        const userProfile: UserProfile = {
          id: p.id,
          name: p.full_name || '',
          email: p.email || '',
          segment: (p.segment as UserSegment) || 'guest',
          avatarUrl: p.avatar_url || undefined,
        };
        setProfile(userProfile);
        logger.log('[UserContext] Profile loaded — segment:', userProfile.segment);
      } else {
        const fallback: UserProfile = {
          id: userId,
          name: '',
          email: '',
          segment: 'guest',
        };
        setProfile(fallback);
        logger.log('[UserContext] No profile found, using guest fallback');
      }

      if (onboardingResult.data) {
        const o = onboardingResult.data;
        const onb: OnboardingProfile = {
          id: o.id,
          userId: o.user_id,
          specialty: o.specialty,
          targetInstitutions: o.target_institutions || [],
          status: o.status as OnboardingStatus,
          completedAt: o.completed_at || undefined,
        };
        setOnboarding(onb);
        logger.log('[UserContext] Onboarding loaded:', { status: onb.status });
      } else {
        setOnboarding(null);
      }

      setDataSource('supabase');
      await fetchOnboardingEditGuard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar perfil';
      logger.error('[UserContext] Unexpected error fetching user data:', message);
      setProfileError(message);
      trackEvent('auth_profile_load_failed', {
        error_message: message,
        fallback_segment: 'guest',
      });
      toast({
        title: 'Erro ao carregar perfil',
        description: 'Não foi possível carregar seus dados. Tente recarregar.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchOnboardingEditGuard]);

  const lastFetchedUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      if (!profile) {
        setIsLoading(true);
        setDataSource('loading');
      }
      return;
    }

    if (!authUser) {
      lastFetchedUserIdRef.current = null;
      setProfile(null);
      setOnboarding(null);
      setIsLoading(false);
      setDataSource('unauthenticated');
      setProfileError(null);
      return;
    }

    if (lastFetchedUserIdRef.current === authUser.id && profile) {
      logger.log('[UserContext] Same user, skipping refetch');
      return;
    }

    lastFetchedUserIdRef.current = authUser.id;
    fetchUserData(authUser.id);
  }, [authUser?.id, authLoading, fetchUserData]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnboardingComplete = onboarding?.status === 'completed';

  const saveOnboarding = useCallback(async (data: { specialty: string; targetInstitutions: string[] }) => {
    if (!authUser) throw new Error('Not authenticated');
    const { data: savedRow, error } = await supabaseRpc('save_onboarding_guarded', {
      p_specialty: data.specialty,
      p_target_institutions: data.targetInstitutions,
    });
    if (error) throw error;

    const row = Array.isArray(savedRow) ? savedRow[0] : savedRow;
    const onboardingData: OnboardingProfile = {
      id: (row as any)?.id,
      userId: (row as any)?.user_id ?? authUser.id,
      specialty: (row as any)?.specialty ?? data.specialty,
      targetInstitutions: (row as any)?.target_institutions ?? data.targetInstitutions,
      status: ((row as any)?.status as OnboardingStatus) ?? 'completed',
      completedAt: (row as any)?.completed_at ?? undefined,
    };
    setOnboarding(onboardingData);
    await fetchOnboardingEditGuard();
    logger.log('[UserContext] Onboarding saved to Supabase');
  }, [authUser, fetchOnboardingEditGuard]);

  const updateProfile = useCallback(async (data: Partial<Pick<UserProfile, 'name' | 'avatarUrl'>>) => {
    if (!authUser) return;

    // Capture previous state for rollback on error
    let previousProfile: UserProfile | null = null;
    setProfile(prev => {
      previousProfile = prev;
      return prev ? { ...prev, ...data } : prev;
    });

    const updates: Record<string, string | undefined> = {};
    if (data.name !== undefined) updates.full_name = data.name;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', authUser.id);

      if (error) {
        logger.error('[UserContext] Profile update error:', error);
        // Rollback optimistic update
        if (previousProfile) setProfile(previousProfile);
      }
    }
  }, [authUser]);

  const resetOnboarding = useCallback(async () => {
    setOnboarding(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (authUser) await fetchUserData(authUser.id, true);
  }, [authUser, fetchUserData]);

  const contextValue = useMemo<UserContextValue>(() => ({
    profile,
    onboarding,
    isLoading,
    isOnboardingComplete,
    profileError,
    dataSource,
    onboardingEditLocked,
    onboardingEditReason,
    onboardingNextEditableAt,
    saveOnboarding,
    updateProfile,
    resetOnboarding,
    refreshProfile,
    refreshOnboardingEditGuard: fetchOnboardingEditGuard,
  }), [
    profile,
    onboarding,
    isLoading,
    isOnboardingComplete,
    profileError,
    dataSource,
    onboardingEditLocked,
    onboardingEditReason,
    onboardingNextEditableAt,
    saveOnboarding,
    updateProfile,
    resetOnboarding,
    refreshProfile,
    fetchOnboardingEditGuard,
  ]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export function useSegment(): UserSegment {
  const { profile } = useUser();
  return profile?.segment ?? 'guest';
}

export function useHasAccess(feature: keyof typeof SEGMENT_ACCESS['guest']): boolean {
  const segment = useSegment();
  return SEGMENT_ACCESS[segment]?.[feature] ?? false;
}
