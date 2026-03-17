import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserProfile, OnboardingProfile, UserSegment, OnboardingStatus } from '@/types';
import { SEGMENT_ACCESS } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserContextValue {
  profile: UserProfile | null;
  onboarding: OnboardingProfile | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  dataSource: 'supabase' | 'loading' | 'unauthenticated';

  saveOnboarding: (data: { specialty: string; targetInstitutions: string[] }) => Promise<void>;
  updateProfile: (data: Partial<Pick<UserProfile, 'name' | 'avatarUrl'>>) => void;
  resetOnboarding: () => void;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'supabase' | 'loading' | 'unauthenticated'>('loading');

  const fetchUserData = useCallback(async (userId: string, silent = false) => {
    console.log('[UserContext] Fetching user data from Supabase for:', userId, silent ? '(silent)' : '');
    // Only show loading spinner on initial load, not on refetch
    if (!silent) {
      setIsLoading(true);
      setDataSource('loading');
    }

    try {
      const [profileResult, onboardingResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('onboarding_profiles').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileResult.error) {
        console.error('[UserContext] Profile fetch error:', profileResult.error);
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
        console.log('[UserContext] Profile loaded — segment from DB:', userProfile.segment);
      } else {
        // Profile should be auto-created by trigger, set fallback
        const fallback: UserProfile = {
          id: userId,
          name: '',
          email: '',
          segment: 'guest',
        };
        setProfile(fallback);
        console.log('[UserContext] No profile found, using guest fallback');
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
        console.log('[UserContext] Onboarding loaded:', { status: onb.status });
      } else {
        setOnboarding(null);
      }

      setDataSource('supabase');
    } catch (err) {
      console.error('[UserContext] Unexpected error fetching user data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Track the user ID to avoid re-fetching on same-user auth events
  const lastFetchedUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      // Only show loading if we haven't loaded data yet
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
      return;
    }

    // Skip refetch if same user — data is already loaded
    if (lastFetchedUserIdRef.current === authUser.id && profile) {
      console.log('[UserContext] Same user, skipping refetch');
      return;
    }

    lastFetchedUserIdRef.current = authUser.id;
    fetchUserData(authUser.id);
  }, [authUser?.id, authLoading, fetchUserData]); // depend on authUser.id, not authUser object

  const isOnboardingComplete = onboarding?.status === 'completed';

  const saveOnboarding = useCallback(async (data: { specialty: string; targetInstitutions: string[] }) => {
    if (!authUser) throw new Error('Not authenticated');

    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('onboarding_profiles')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('onboarding_profiles')
        .update({
          specialty: data.specialty,
          target_institutions: data.targetInstitutions,
          status: 'completed' as const,
          completed_at: now,
        })
        .eq('user_id', authUser.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('onboarding_profiles')
        .insert({
          user_id: authUser.id,
          specialty: data.specialty,
          target_institutions: data.targetInstitutions,
          status: 'completed' as const,
          completed_at: now,
        });

      if (error) throw error;
    }

    const onboardingData: OnboardingProfile = {
      userId: authUser.id,
      specialty: data.specialty,
      targetInstitutions: data.targetInstitutions,
      status: 'completed',
      completedAt: now,
    };
    setOnboarding(onboardingData);
    console.log('[UserContext] Onboarding saved to Supabase');
  }, [authUser]);

  const updateProfile = useCallback(async (data: Partial<Pick<UserProfile, 'name' | 'avatarUrl'>>) => {
    if (!authUser) return;

    // Only allow updating name and avatar — segment is read-only
    setProfile(prev => prev ? { ...prev, ...data } : prev);

    const updates: Record<string, any> = {};
    if (data.name !== undefined) updates.full_name = data.name;
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', authUser.id);

      if (error) console.error('[UserContext] Profile update error:', error);
    }
  }, [authUser]);

  const resetOnboarding = useCallback(async () => {
    setOnboarding(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (authUser) await fetchUserData(authUser.id, true);
  }, [authUser, fetchUserData]);

  return (
    <UserContext.Provider value={{
      profile,
      onboarding,
      isLoading,
      isOnboardingComplete,
      dataSource,
      saveOnboarding,
      updateProfile,
      resetOnboarding,
      refreshProfile,
    }}>
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
