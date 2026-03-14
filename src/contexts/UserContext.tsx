import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserProfile, OnboardingProfile, UserSegment, OnboardingStatus } from '@/types';

interface UserContextValue {
  // Profile state
  profile: UserProfile | null;
  onboarding: OnboardingProfile | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;

  // Actions
  setSegment: (segment: UserSegment) => void;
  saveOnboarding: (data: { specialty: string; targetInstitutions: string[] }) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => void;
  resetOnboarding: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

const STORAGE_KEY_PROFILE = 'sanarflix_profile';
const STORAGE_KEY_ONBOARDING = 'sanarflix_onboarding';

function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('[UserContext] Failed to save to storage:', e);
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    console.log('[UserContext] Loading user state from storage');
    const storedProfile = loadFromStorage<UserProfile>(STORAGE_KEY_PROFILE);
    const storedOnboarding = loadFromStorage<OnboardingProfile>(STORAGE_KEY_ONBOARDING);

    if (storedProfile) {
      setProfile(storedProfile);
    } else {
      // Default profile for demo/dev
      const defaultProfile: UserProfile = {
        id: 'demo-user',
        name: '',
        email: '',
        segment: 'guest',
      };
      setProfile(defaultProfile);
      saveToStorage(STORAGE_KEY_PROFILE, defaultProfile);
    }

    if (storedOnboarding) {
      setOnboarding(storedOnboarding);
    }

    setIsLoading(false);
  }, []);

  const isOnboardingComplete = onboarding?.status === 'completed';

  const setSegment = useCallback((segment: UserSegment) => {
    console.log('[UserContext] Setting segment:', segment);
    setProfile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, segment };
      saveToStorage(STORAGE_KEY_PROFILE, updated);
      return updated;
    });
  }, []);

  const saveOnboarding = useCallback(async (data: { specialty: string; targetInstitutions: string[] }) => {
    console.log('[UserContext] Saving onboarding:', data);
    const onboardingData: OnboardingProfile = {
      userId: profile?.id ?? 'demo-user',
      specialty: data.specialty,
      targetInstitutions: data.targetInstitutions,
      status: 'completed' as OnboardingStatus,
      completedAt: new Date().toISOString(),
    };
    setOnboarding(onboardingData);
    saveToStorage(STORAGE_KEY_ONBOARDING, onboardingData);

    // TODO: When auth is ready, persist to Supabase:
    // await supabase.from('onboarding_profiles').upsert({ ... })
  }, [profile?.id]);

  const updateProfile = useCallback((data: Partial<UserProfile>) => {
    console.log('[UserContext] Updating profile:', data);
    setProfile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      saveToStorage(STORAGE_KEY_PROFILE, updated);
      return updated;
    });
  }, []);

  const resetOnboarding = useCallback(() => {
    console.log('[UserContext] Resetting onboarding');
    setOnboarding(null);
    localStorage.removeItem(STORAGE_KEY_ONBOARDING);
  }, []);

  return (
    <UserContext.Provider value={{
      profile,
      onboarding,
      isLoading,
      isOnboardingComplete,
      setSegment,
      saveOnboarding,
      updateProfile,
      resetOnboarding,
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

export function useSegment() {
  const { profile } = useUser();
  return profile?.segment ?? 'guest';
}

export function useHasAccess(feature: keyof typeof import('@/types').SEGMENT_ACCESS['guest']) {
  const segment = useSegment();
  const { SEGMENT_ACCESS } = require('@/types');
  return SEGMENT_ACCESS[segment]?.[feature] ?? false;
}
