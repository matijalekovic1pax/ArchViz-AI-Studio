import React, { useState } from 'react';
import { X, Zap, Check, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { useAuth } from '../auth/AuthGate';
import { createCheckoutSession } from '../../services/apiGateway';
import { PLAN_PRICES_USD, PLAN_CREDITS, PLAN_LABELS, STRIPE_PRICES } from '../../lib/stripePrices';
import { cn } from '../../lib/utils';

const PLANS = [
  {
    id: 'starter' as const,
    label: PLAN_LABELS.starter,
    price: PLAN_PRICES_USD.starter,
    credits: PLAN_CREDITS.starter,
    features: [
      `${PLAN_CREDITS.starter} credits / month`,
      'All core render modes',
      'Headshot generator',
      'Video (pay-per-gen)',
    ],
    highlight: false,
  },
  {
    id: 'professional' as const,
    label: PLAN_LABELS.professional,
    price: PLAN_PRICES_USD.professional,
    credits: PLAN_CREDITS.professional,
    features: [
      `${PLAN_CREDITS.professional} credits / month`,
      'Everything in Starter',
      'img-to-CAD & img-to-3D',
      'Document translate',
      'Material validation',
      'PDF compression',
      '50% credit rollover',
    ],
    highlight: true,
  },
  {
    id: 'studio' as const,
    label: PLAN_LABELS.studio,
    price: 199,
    credits: PLAN_CREDITS.studio,
    features: [
      `${PLAN_CREDITS.studio} credits / month`,
      'Everything in Professional',
      'Up to 5 team seats',
      'Shared credit pool',
      '50% credit rollover',
    ],
    highlight: false,
  },
] as const;

export function UpgradeModal() {
  const { state, dispatch } = useAppStore();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!state.showUpgradeModal) return null;

  const close = () => dispatch({ type: 'SHOW_UPGRADE_MODAL', payload: false });

  const handleUpgrade = async (planId: 'starter' | 'professional' | 'studio') => {
    const priceId = STRIPE_PRICES[planId];
    if (!priceId) {
      setError('Stripe price not configured. Please contact support.');
      return;
    }
    setLoading(planId);
    setError(null);
    try {
      const { url } = await createCheckoutSession(priceId);
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'Failed to start checkout. Please try again.');
      setLoading(null);
    }
  };

  const currentPlan = user?.org?.plan ?? user?.plan ?? 'unsubscribed';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-2xl bg-surface-elevated rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Zap size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Upgrade your plan</h2>
              <p className="text-xs text-foreground-muted">
                {currentPlan === 'unsubscribed'
                  ? 'Start a subscription to unlock all features'
                  : 'Upgrade to access more credits and features'}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Plans */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isLoading = loading === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  'rounded-xl border p-4 flex flex-col gap-3 relative',
                  plan.highlight
                    ? 'border-accent bg-accent/5 shadow-sm'
                    : 'border-border bg-surface-sunken'
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-accent text-accent-foreground px-2.5 py-0.5 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">{plan.label}</p>
                  <p className="text-2xl font-extrabold text-foreground mt-0.5">
                    ${plan.price}
                    <span className="text-xs font-normal text-foreground-muted">/mo</span>
                  </p>
                </div>

                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-foreground-secondary">
                      <Check size={12} className="mt-0.5 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrentPlan || !!loading}
                  onClick={() => handleUpgrade(plan.id)}
                  className={cn(
                    'w-full py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5',
                    isCurrentPlan
                      ? 'bg-surface-elevated text-foreground-muted border border-border cursor-default'
                      : plan.highlight
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                      : 'bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50'
                  )}
                >
                  {isLoading && <Loader2 size={12} className="animate-spin" />}
                  {isCurrentPlan ? 'Current plan' : `Get ${plan.label}`}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="px-6 pb-4 text-xs text-red-500 text-center">{error}</p>
        )}

        <p className="text-center text-[10px] text-foreground-muted pb-5">
          Billed monthly · Cancel anytime · All prices in USD
        </p>
      </div>
    </div>
  );
}
