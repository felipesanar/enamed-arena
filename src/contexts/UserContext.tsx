import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserProfile, OnboardingProfile, UserSegment, OnboardingStatus } from '@/types';
import { SEGMENT_ACCESS } from '@/types';

interface UserContextValue {
  profile: UserProfile | null;
  onboarding: OnboardingProfile | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;

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
    console.error('[UserContext] Storage save failed:', e);
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedProfile = loadFromStorage<UserProfile>(STORAGE_KEY_PROFILE);
    const storedOnboarding = loadFromStorage<OnboardingProfile>(STORAGE_KEY_ONBOARDING);

    if (storedProfile) {
      setProfile(storedProfile);
    } else {
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
    setProfile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, segment };
      saveToStorage(STORAGE_KEY_PROFILE, updated);
      return updated;
    });
  }, []);

  const saveOnboarding = useCallback(async (data: { specialty: string; targetInstitutions: string[] }) => {
    const onboardingData: OnboardingProfile = {
      userId: profile?.id ?? 'demo-user',
      specialty: data.specialty,
      targetInstitutions: data.targetInstitutions,
      status: 'completed' as OnboardingStatus,
      completedAt: new Date().toISOString(),
    };
    setOnboarding(onboardingData);
    saveToStorage(STORAGE_KEY_ONBOARDING, onboardingData);
  }, [profile?.id]);

  const updateProfile = useCallback((data: Partial<UserProfile>) => {
    setProfile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      saveToStorage(STORAGE_KEY_PROFILE, updated);
      return updated;
    });
  }, []);

  const resetOnboarding = useCallback(() => {
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

export function useSegment(): UserSegment {
  const { profile } = useUser();
  return profile?.segment ?? 'guest';
}

export function useHasAccess(feature: keyof typeof SEGMENT_ACCESS['guest']): boolean {
  const segment = useSegment();
  return SEGMENT_ACCESS[segment]?.[feature] ?? false;
}