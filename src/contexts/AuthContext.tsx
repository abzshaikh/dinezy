import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase';
import { ensureUserProfile, fetchUserProfile } from '../services/authService';
import type { UserProfile } from '../types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(user: FirebaseUser) {
    // Right after registration, authService.registerUser() is CONCURRENTLY
    // writing this same profile doc with the real name the user typed.
    // onAuthStateChanged can fire before that write lands (it fires as soon
    // as the auth account exists, not after registerUser's later steps
    // finish), so if we self-healed immediately here we'd race ahead of it
    // and permanently lock in a guessed "New User" doc — ensureUserProfile
    // is idempotent, so whichever write lands first wins forever. Retry
    // briefly before assuming the doc is genuinely missing.
    let userProfile = await fetchUserProfile(user.uid);
    for (let attempt = 0; !userProfile && attempt < 8; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      userProfile = await fetchUserProfile(user.uid);
    }
    if (!userProfile) {
      // Still nothing after ~2.4s — genuinely missing (e.g. a dropped
      // connection right after auth succeeded, not a registration race).
      // Self-heal with the best data available.
      const [firstName, ...rest] = (user.displayName ?? '').split(' ');
      userProfile = await ensureUserProfile({
        userId: user.uid,
        firstName: firstName || 'New',
        lastName: rest.join(' ') || 'User',
        email: user.email ?? '',
      });
    }
    setProfile(userProfile);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadProfile(user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      refreshProfile: async () => {
        if (firebaseUser) await loadProfile(firebaseUser);
      },
    }),
    [firebaseUser, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
