import React, { createContext, useContext, useState, useEffect, useCallback, PropsWithChildren } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchAppUser, signOut } from '../../lib/supabaseAuth';
import type { AppUser } from '../../lib/supabaseAuth';
import { LoginPage } from './LoginPage';
import { setOnSessionExpired } from '../../services/apiGateway';

interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthGate');
  return ctx;
}

export function AuthGate({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async (supabaseUserId: string) => {
    const appUser = await fetchAppUser(supabaseUserId);
    setUser(appUser);
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  // Bootstrap: check existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });
  }, [loadUser]);

  // Listen for auth state changes (login / logout / token refresh)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user.id);
      } else {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadUser]);

  // Hook gateway 401 → logout
  useEffect(() => {
    setOnSessionExpired(() => logout());
    return () => setOnSessionExpired(null);
  }, [logout]);

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadUser(session.user.id);
  }, [loadUser]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-foreground-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: true,
      isSuperAdmin: user.role === 'superadmin',
      refreshUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
