import React, { createContext, useContext, useState, useEffect, useCallback, useRef, PropsWithChildren } from 'react';
import { AuthUser, loadAuthSession, clearAuthSession } from '../../lib/googleAuth';
import { clearGatewayToken, getTokenExpiresAt, setOnSessionExpired } from '../../services/apiGateway';
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

  const logout = useCallback(() => {
    if (logoutCalledRef.current) return;
    logoutCalledRef.current = true;
    clearGatewayToken();
    clearAuthSession();
    setUser(null);
  }, []);

  // Instant logout when a 401 is received from the gateway
  useEffect(() => {
    setOnSessionExpired(logout);
    return () => setOnSessionExpired(null);
  }, [logout]);

  // Timer-based auto-logout when the JWT expires naturally
  useEffect(() => {
    if (!user) return;

    const expiresAt = getTokenExpiresAt();
    if (expiresAt <= 0) return; // no token yet (session restored from storage)

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      logout();
      return;
    }

    const timer = setTimeout(logout, remaining);
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
