import React, { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } from '../../lib/supabaseAuth';
import { cn } from '../../lib/utils';

type AuthView = 'sign-in' | 'sign-up' | 'reset-password' | 'check-email';

export function LoginPage() {
  const [view, setView] = useState<AuthView>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => handle(signInWithGoogle);

  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    handle(() => signInWithEmail(email, password));
  };

  const handleEmailSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    handle(async () => {
      await signUpWithEmail(email, password, name);
      setView('check-email');
    });
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    handle(async () => {
      await sendPasswordReset(email);
      setView('check-email');
    });
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">AVAS</h1>
          <p className="text-foreground-muted text-sm mt-1">Architecture Visualization AI Studio</p>
        </div>

        <div className="bg-surface-elevated border border-border rounded-xl p-6 shadow-subtle">

          {/* Check email state */}
          {view === 'check-email' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-foreground">Check your email for a confirmation link.</p>
              <button
                type="button"
                onClick={() => setView('sign-in')}
                className="text-xs text-accent hover:underline"
              >
                Back to sign in
              </button>
            </div>
          )}

          {/* Sign In */}
          {view === 'sign-in' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground text-center">Sign in to your account</h2>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 h-10 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface-sunken transition-colors disabled:opacity-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-foreground-muted uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div className="flex items-center justify-between text-xs text-foreground-muted">
                <button type="button" onClick={() => setView('reset-password')} className="hover:text-foreground transition-colors">
                  Forgot password?
                </button>
                <button type="button" onClick={() => setView('sign-up')} className="hover:text-foreground transition-colors">
                  Create account
                </button>
              </div>
            </div>
          )}

          {/* Sign Up */}
          {view === 'sign-up' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground text-center">Create your account</h2>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 h-10 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface-sunken transition-colors disabled:opacity-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-foreground-muted uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
                />
                <input
                  type="password"
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p className="text-[10px] text-foreground-muted text-center">
                You'll receive 20 free credits to get started.
              </p>

              <button type="button" onClick={() => setView('sign-in')} className="w-full text-xs text-foreground-muted hover:text-foreground transition-colors text-center">
                Already have an account? Sign in
              </button>
            </div>
          )}

          {/* Reset Password */}
          {view === 'reset-password' && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground text-center">Reset your password</h2>
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full h-9 bg-surface-sunken border border-border rounded-md text-sm px-3 text-foreground placeholder-foreground-muted/60 focus:outline-none focus:border-accent"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <button type="button" onClick={() => setView('sign-in')} className="w-full text-xs text-foreground-muted hover:text-foreground transition-colors text-center">
                Back to sign in
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-foreground-muted text-[10px] mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
