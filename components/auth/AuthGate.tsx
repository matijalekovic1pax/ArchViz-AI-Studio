import React, { createContext, useContext, useState, useEffect, useCallback, useRef, PropsWithChildren } from 'react';
import { AuthUser, loadAuthSession, clearAuthSession } from '../../lib/googleAuth';
import { clearGatewayToken, isGatewayAuthenticated, setOnSessionExpired } from '../../services/apiGateway';
import { LoginPage } from './LoginPage';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TEST_AUTH_USER: AuthUser = {
  email: 'archwiz-test@local',
  name: 'ArchWiz Test MCP',
  picture: '',
  domain: 'local',
};

const isArchwizTestAuthBypassEnabled = () => {
  const env = (import.meta as any).env;
  const bypassAllowed = Boolean(env?.DEV) || env?.VITE_ARCHWIZ_TEST_AUTH_BYPASS === '1';
  if (!bypassAllowed || typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.has('archwizTest')) return true;
  try {
    return window.localStorage.getItem('archwiz:test') === '1';
  } catch {
    return false;
  }
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthGate');
  }
  return context;
}

export function AuthGate({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const logoutCalledRef = useRef(false);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = loadAuthSession();
    if (savedUser) {
      setUser(savedUser);
    } else if (isArchwizTestAuthBypassEnabled()) {
      setUser(TEST_AUTH_USER);
    }
    setIsLoading(false);
  }, []);

  const login = (newUser: AuthUser) => {
    logoutCalledRef.current = false;
    setUser(newUser);
  };

  const logout = useCallback((reload = false) => {
    if (logoutCalledRef.current) return;
    logoutCalledRef.current = true;
    clearGatewayToken();
    clearAuthSession();
    setUser(null);
    if (reload) {
      window.location.reload();
    }
  }, []);

  // Instant logout + reload when a 401 is received from the gateway
  useEffect(() => {
    setOnSessionExpired(() => logout(true));
    return () => setOnSessionExpired(null);
  }, [logout]);

  // Force logout if user profile is present but the JWT is missing or expired
  useEffect(() => {
    if (!user) return;
    if (isArchwizTestAuthBypassEnabled()) return;
    if (!isGatewayAuthenticated()) {
      logout(true);
    }
  }, [user, logout]);

  const contextValue: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
  };

  // Show loading state briefly while checking session
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-foreground-muted">Loading...</div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return (
      <AuthContext.Provider value={contextValue}>
        <LoginPage onLogin={login} />
      </AuthContext.Provider>
    );
  }

  // Show app if authenticated
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
