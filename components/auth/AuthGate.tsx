import React, { createContext, useContext, useState, useEffect, PropsWithChildren } from 'react';
import { AuthUser, loadAuthSession, clearAuthSession } from '../../lib/googleAuth';
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

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = loadAuthSession();
    if (savedUser) {
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const login = (newUser: AuthUser) => {
    setUser(newUser);
  };

  const logout = () => {
    clearAuthSession();
    setUser(null);
  };

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
