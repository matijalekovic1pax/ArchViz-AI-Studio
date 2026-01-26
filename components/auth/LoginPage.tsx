import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthUser, initializeGoogleSignIn, getAllowedDomain } from '../../lib/googleAuth';

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const allowedDomain = getAllowedDomain();

  useEffect(() => {
    if (buttonRef.current && !isInitialized) {
      initializeGoogleSignIn(
        buttonRef.current,
        (user) => {
          setError(null);
          onLogin(user);
        },
        (errorMsg) => {
          setError(errorMsg);
        }
      );
      setIsInitialized(true);
    }
  }, [onLogin, isInitialized]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md px-8">
        {/* Logo/Title */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {t('app.title')}
          </h1>
          <p className="text-foreground-muted text-sm">
            {t('auth.signInMessage')}
          </p>
        </div>

        {/* Sign-in Card */}
        <div className="bg-surface-elevated border border-border rounded-xl p-8 shadow-subtle">
          <div className="text-center mb-6">
            <p className="text-foreground-secondary text-sm">
              This application is restricted to
            </p>
            <p className="text-foreground font-medium mt-1">
              {allowedDomain || 'your organization'}
            </p>
          </div>

          {/* Google Sign-In Button Container */}
          <div className="flex justify-center mb-4">
            <div ref={buttonRef} className="min-h-[44px]" />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-foreground-subtle text-xs mt-8">
          {t('auth.signInWithGoogle')}
        </p>
      </div>
    </div>
  );
}
