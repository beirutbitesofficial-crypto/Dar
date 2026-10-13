import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthTokens, Me } from '@dar/shared';
import { api, clearTokens, get, loadTokens, post, saveTokens, setSignedOutHandler } from './api';
import { registerForPush, unregisterPush } from './push';

interface AuthValue {
  user: Me | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { fullName: string; email: string; password: string; phone: string; acceptedTermsVersion: string; locale: 'ar' | 'en' }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** Navigates to sign-in when needed; returns true if already signed in. */
  requireAuth: () => boolean;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  const refreshMe = useCallback(async () => {
    try {
      setUser(await get<Me>('/v1/auth/me'));
    } catch (e: any) {
      if (e?.status === 401) setUser(null);
    }
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      if (await loadTokens()) await refreshMe();
      setReady(true);
    })();
  }, [refreshMe]);

  const afterLogin = useCallback(
    async (t: AuthTokens) => {
      await saveTokens(t);
      await refreshMe();
      qc.invalidateQueries();
      registerForPush().catch(() => undefined); // optional; failure never blocks sign-in
    },
    [qc, refreshMe],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      signIn: async (email, password) => afterLogin(await post<AuthTokens>('/v1/auth/login', { email, password, device: 'mobile' })),
      register: async (input) => afterLogin(await post<AuthTokens>('/v1/auth/register', input)),
      signOut: async () => {
        await unregisterPush().catch(() => undefined);
        await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
        await clearTokens();
        setUser(null);
        qc.clear();
      },
      refreshMe,
      requireAuth: () => {
        if (user) return true;
        router.push('/auth/login');
        return false;
      },
    }),
    [user, ready, afterLogin, refreshMe, qc],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
