import React, { useState } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } from '../../lib/supabaseAuth';

type AuthView = 'sign-in' | 'sign-up' | 'reset-password' | 'check-email';

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

const inputClass =
  'w-full h-11 bg-background border border-border rounded-lg text-sm px-3.5 text-foreground placeholder-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all';

const btnPrimaryClass =
  'w-full h-11 bg-foreground text-background text-sm font-semibold rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-40';

const btnSecondaryClass =
  'w-full flex items-center justify-center gap-2.5 h-11 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface-sunken transition-colors disabled:opacity-40';

/** Reusable form card — used both standalone and inside the LandingPage modal */
export function LoginForm() {
  const [view, setView] = useState<AuthView>('sign-in');
  const [email, setEmail] = useState('matija.lekovic@gmail.com');
  const [password, setPassword] = useState('1234');
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
  const handleEmailSignIn = (e: React.FormEvent) => { e.preventDefault(); handle(() => signInWithEmail(email, password)); };
  const handleEmailSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    handle(async () => { await signUpWithEmail(email, password, name); setView('check-email'); });
  };
  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    handle(async () => { await sendPasswordReset(email); setView('check-email'); });
  };

  /* ── Check email ──────────────────────────────────────── */
  if (view === 'check-email') {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Check your inbox</p>
          <p className="text-xs text-foreground-muted mt-1">We sent a confirmation link to <span className="font-medium text-foreground">{email}</span></p>
        </div>
        <button type="button" onClick={() => setView('sign-in')} className="text-xs text-accent hover:underline">
          Back to sign in
        </button>
      </div>
    );
  }

  /* ── Sign In ──────────────────────────────────────────── */
  if (view === 'sign-in') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-foreground">Welcome back</h2>
          <p className="text-xs text-foreground-muted mt-0.5">Sign in to your ArchViz AI Studio account</p>
        </div>

        <button type="button" onClick={handleGoogleSignIn} disabled={loading} className={btnSecondaryClass}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-foreground-muted uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-secondary">Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground-secondary">Password</label>
              <button type="button" onClick={() => setView('reset-password')} className="text-[11px] text-accent hover:underline">
                Forgot password?
              </button>
            </div>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className={btnPrimaryClass}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-foreground-muted">
          Don't have an account?{' '}
          <button type="button" onClick={() => setView('sign-up')} className="text-accent hover:underline font-medium">
            Create one free
          </button>
        </p>
      </div>
    );
  }

  /* ── Sign Up ──────────────────────────────────────────── */
  if (view === 'sign-up') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-foreground">Create your account</h2>
          <p className="text-xs text-foreground-muted mt-0.5">20 free credits included — no card required</p>
        </div>

        <button type="button" onClick={handleGoogleSignIn} disabled={loading} className={btnSecondaryClass}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-foreground-muted uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleEmailSignUp} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-secondary">Full name</label>
            <input type="text" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-secondary">Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-secondary">Password</label>
            <input type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className={inputClass} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className={btnPrimaryClass}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-foreground-muted">
          Already have an account?{' '}
          <button type="button" onClick={() => setView('sign-in')} className="text-accent hover:underline font-medium">
            Sign in
          </button>
        </p>
      </div>
    );
  }

  /* ── Reset Password ───────────────────────────────────── */
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Reset password</h2>
        <p className="text-xs text-foreground-muted mt-0.5">We'll send you a link to reset your password</p>
      </div>
      <form onSubmit={handlePasswordReset} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground-secondary">Email</label>
          <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className={btnPrimaryClass}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="text-center text-xs text-foreground-muted">
        <button type="button" onClick={() => setView('sign-in')} className="text-accent hover:underline">
          Back to sign in
        </button>
      </p>
    </div>
  );
}

/** Full-page standalone login — shown by AuthGate for ?reset / ?invite / ?login flows */
export function LoginPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left: brand panel */}
      <div
        className="hidden lg:flex lg:w-[480px] xl:w-[540px] shrink-0 flex-col justify-between p-16 relative overflow-hidden"
        style={{ backgroundColor: '#1A1A1A' }}
      >
        {/* Architectural grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="arch-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.75"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#arch-grid)" />
          </svg>
        </div>

        {/* Top wordmark */}
        <div className="relative z-10">
          <span className="text-white text-sm font-bold tracking-tight">ArchViz <span className="font-normal opacity-50">AI Studio</span></span>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-[0.25em] mb-4">Architecture Visualisation AI Studio</p>
            <h2 className="text-white text-4xl font-extrabold tracking-tight leading-[1.1]">
              From sketch<br />to render.<br />
              <span style={{ color: '#16A34A' }}>In seconds.</span>
            </h2>
          </div>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            Transform floor plans, CAD files, and rough sketches into photorealistic architectural visuals with AI.
          </p>

          <div className="flex items-center gap-6 pt-2">
            {[['18', 'generation modes'], ['20', 'free credits'], ['1k+', 'architects']].map(([num, label]) => (
              <div key={label}>
                <p className="text-white text-xl font-extrabold">{num}</p>
                <p className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-white/25 text-[10px]">© {new Date().getFullYear()} ArchViz AI Studio</p>
        </div>
      </div>

      {/* Right: form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile wordmark */}
          <div className="lg:hidden text-center mb-10">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">ArchViz AI Studio</h1>
            <p className="text-foreground-muted text-xs mt-1">Architecture Visualisation AI Studio</p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-[10px] text-foreground-muted">
            By continuing you agree to our{' '}
            <a href="#" className="underline hover:text-foreground transition-colors">Terms</a>
            {' '}and{' '}
            <a href="#" className="underline hover:text-foreground transition-colors">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
