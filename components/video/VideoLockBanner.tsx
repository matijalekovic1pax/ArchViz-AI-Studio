import React, { useState } from 'react';
import { Video, Loader2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { useAuth } from '../auth/AuthGate';
import { createVideoCheckout } from '../../services/apiGateway';
import { VIDEO_PRICES_CENTS } from '../../lib/stripePrices';
import { cn } from '../../lib/utils';

type VideoLockBannerProps = {
  className?: string;
  compact?: boolean;
};

/**
 * Resolves the price key for the current video settings.
 * Key format: `{provider}-{quality}-{duration}s`
 */
function getPriceKey(model: string, duration: number): string {
  const provider = model === 'veo-2' ? 'veo' : 'kling';
  const quality  = model === 'veo-2'
    ? (duration <= 5 ? 'fast' : 'standard')
    : (duration <= 5 ? 'standard' : duration <= 10 ? 'standard' : 'pro');
  return `${provider}-${quality}-${duration}s`;
}

export const VideoLockBanner: React.FC<VideoLockBannerProps> = ({ className, compact = false }) => {
  const { state, dispatch } = useAppStore();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const video = state.workflow.videoState;

  if (video.accessUnlocked) return null;

  const model    = video.model    ?? 'kling-2.6';
  const duration = video.duration ?? 5;
  const orgId    = user?.org?.id ?? undefined;

  // Determine display price
  const priceKey     = getPriceKey(model, duration);
  const amountCents  = VIDEO_PRICES_CENTS[priceKey] ?? VIDEO_PRICES_CENTS['veo-standard-8s'] ?? 399;
  const amountDollars = (amountCents / 100).toFixed(2);

  const providerLabel = model === 'veo-2' ? 'Veo 3.1' : 'Kling 2.6';

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const { url } = await createVideoCheckout({ model, durationSeconds: duration, orgId });
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-elevated shadow-sm',
        compact ? 'p-3' : 'p-5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-surface-sunken flex items-center justify-center text-foreground shrink-0">
          <Video size={16} />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">Pay per video generation</p>
          <p className="text-[11px] text-foreground-secondary mt-0.5">
            Video is billed separately — not from your credit balance.
          </p>
        </div>
      </div>

      {/* Price summary */}
      <div className="bg-surface-sunken rounded-lg p-3 mb-4 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground-muted">Provider</span>
          <span className="font-semibold text-foreground">{providerLabel}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground-muted">Duration</span>
          <span className="font-semibold text-foreground">{duration}s</span>
        </div>
        <div className="h-px bg-border-subtle my-1" />
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-foreground">Total</span>
          <span className="font-extrabold text-foreground">${amountDollars}</span>
        </div>
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full py-2.5 bg-foreground text-background text-xs font-bold rounded-xl hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Zap size={14} />
        )}
        {loading ? 'Redirecting to payment…' : `Pay $${amountDollars} & Generate`}
      </button>

      {error && (
        <p className="mt-2 text-[11px] text-red-500 text-center">{error}</p>
      )}

      <p className="mt-3 text-[10px] text-foreground-muted text-center">
        Secure payment via Stripe · No subscription required
      </p>
    </div>
  );
};
