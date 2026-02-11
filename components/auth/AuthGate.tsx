import React, { createContext, useContext, useState, useEffect, useCallback, useRef, PropsWithChildren } from 'react';
import { AuthUser, loadAuthSession, clearAuthSession } from '../../lib/googleAuth';
import { clearGatewayToken, getTokenExpiresAt, isGatewayAuthenticated, setOnSessionExpired } from '../../services/apiGateway';
import { LoginPage } from './LoginPage';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

  // Timer-based auto-logout when the JWT expires naturally
  useEffect(() => {
    if (!user) return;

    // If user profile exists in sessionStorage but JWT is gone (e.g. page refresh
    // after expiry, or token cleared), force logout immediately
    if (!isGatewayAuthenticated()) {
      logout(true);
      return;
    }

    const expiresAt = getTokenExpiresAt();
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      logout(true);
      return;
    }

    const timer = setTimeout(() => logout(true), remaining);
    return () => clearTimeout(timer);
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
