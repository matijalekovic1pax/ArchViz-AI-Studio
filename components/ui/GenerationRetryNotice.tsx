import React from 'react';
import { AlertCircle } from 'lucide-react';
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
  const { state } = useAppStore();
  const { t } = useTranslation();

  if (!state.isGenerating || state.generationRetryNotice?.reason !== 'unsatisfactory-result') {
    return null;
  }

  return (
    <div className={cn('pointer-events-none z-40', className)} role="status" aria-live="polite">
      <div
        className={cn(
          'flex w-max items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50/95 px-3 py-1.5 text-[10px] font-semibold leading-snug text-amber-950 shadow-elevated backdrop-blur-sm animate-retry-notice-drop',
          compact ? 'max-w-[12rem]' : 'max-w-[15rem]'
        )}
      >
        <AlertCircle size={12} className="shrink-0 text-amber-600" />
        <span className="min-w-0 whitespace-normal">{t('generation.retryNotice.unsatisfactory')}</span>
      </div>
    </div>
  );
};
