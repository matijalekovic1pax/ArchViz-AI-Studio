import React from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';

type GenerationRetryNoticeProps = {
  className?: string;
  compact?: boolean;
};

export const GenerationRetryNotice: React.FC<GenerationRetryNoticeProps> = ({
  className,
  compact = false,
}) => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const notice = state.generationRetryNotice;
  const isFallbackNotice = notice?.reason === 'verification-fallback';

  React.useEffect(() => {
    if (!isFallbackNotice) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'SET_GENERATION_RETRY_NOTICE', payload: null });
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [dispatch, isFallbackNotice, notice?.attempts]);

  if (!notice || (!state.isGenerating && !isFallbackNotice)) {
    return null;
  }

  const message = isFallbackNotice
    ? t('generation.retryNotice.fallback')
    : t('generation.retryNotice.unsatisfactory');
  const Icon = isFallbackNotice ? Info : AlertCircle;

  return (
    <div className={cn('pointer-events-none z-[90]', className)} role="status" aria-live="polite">
      <div
        className={cn(
          'flex w-max items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50/95 px-3 py-1.5 text-[10px] font-semibold leading-snug text-amber-950 shadow-elevated backdrop-blur-sm animate-retry-notice-drop',
          compact ? 'max-w-[12rem]' : 'max-w-[15rem]'
        )}
      >
        <Icon size={12} className="shrink-0 text-amber-600" />
        <span className="min-w-0 whitespace-normal text-center">{message}</span>
      </div>
    </div>
  );
};
