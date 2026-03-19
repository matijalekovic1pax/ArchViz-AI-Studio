import React, { useState } from 'react';
import { CreditCard, Zap, ArrowUpRight, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '../auth/AuthGate';
import { createPortalSession, purchaseCredits } from '../../services/apiGateway';
import { useAppStore } from '../../store';
import { PLAN_LABELS, PLAN_CREDITS } from '../../lib/stripePrices';
import { cn } from '../../lib/utils';

export function BillingPage() {
  const { user } = useAuth();
  const { dispatch } = useAppStore();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const plan = user.org?.plan ?? user.plan;
  const planLabel = PLAN_LABELS[plan] ?? 'Free Trial';
  const credits = user.org?.credits ?? user.credits;
  const planCredits = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] ?? 20;
  const creditPct = Math.min(100, Math.round((credits / planCredits) * 100));

  const openPortal = async () => {
    setLoadingPortal(true);
    setError(null);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'Failed to open billing portal.');
      setLoadingPortal(false);
    }
  };

  const buyCredits = async (packId: 'credits-500' | 'credits-2000') => {
    setLoadingCredits(packId);
    setError(null);
    try {
      const { url } = await purchaseCredits(packId);
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'Failed to start credit purchase.');
      setLoadingCredits(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-10 px-4 space-y-6">
      <h1 className="text-xl font-bold text-foreground">Billing & Credits</h1>

      {/* Current Plan */}
      <div className="bg-surface-elevated border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground-muted uppercase tracking-widest font-semibold">Current Plan</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{planLabel}</p>
          </div>
          {plan !== 'unsubscribed' && (
            <button
              onClick={openPortal}
              disabled={loadingPortal}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-foreground border border-border rounded-lg hover:bg-surface-sunken transition-colors disabled:opacity-50"
            >
              {loadingPortal ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              Manage subscription
            </button>
          )}
          {plan === 'unsubscribed' && (
            <button
              onClick={() => dispatch({ type: 'SHOW_UPGRADE_MODAL', payload: true })}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Zap size={12} />
              Upgrade
            </button>
          )}
        </div>

        {/* Credits bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-foreground-muted">Credits remaining</span>
            <span className="text-xs font-semibold text-foreground">{credits.toLocaleString()} / {planCredits.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-surface-sunken rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                creditPct > 30 ? 'bg-accent' : creditPct > 10 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${creditPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Buy extra credits */}
      {plan !== 'unsubscribed' && (
        <div className="bg-surface-elevated border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Buy extra credits</p>
          <p className="text-xs text-foreground-muted">Top-up credits anytime. They stack with your monthly allowance and never expire.</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'credits-500' as const, credits: 500, price: 25 },
              { id: 'credits-2000' as const, credits: 2000, price: 90 },
            ].map((pack) => (
              <button
                key={pack.id}
                onClick={() => buyCredits(pack.id)}
                disabled={!!loadingCredits}
                className="flex flex-col items-start p-4 border border-border rounded-xl hover:border-accent/60 hover:bg-surface-sunken transition-colors disabled:opacity-50"
              >
                {loadingCredits === pack.id ? (
                  <Loader2 size={16} className="animate-spin text-accent mb-1" />
                ) : (
                  <Zap size={16} className="text-accent mb-1" />
                )}
                <p className="text-sm font-bold text-foreground">{pack.credits.toLocaleString()} credits</p>
                <p className="text-xs text-foreground-muted">${pack.price}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {plan === 'unsubscribed' && (
        <p className="text-xs text-foreground-muted text-center">
          You have {user.signup_bonus_remaining} free credits remaining.{' '}
          <button
            onClick={() => dispatch({ type: 'SHOW_UPGRADE_MODAL', payload: true })}
            className="text-accent hover:underline"
          >
            Upgrade to get more.
          </button>
        </p>
      )}
    </div>
  );
}
