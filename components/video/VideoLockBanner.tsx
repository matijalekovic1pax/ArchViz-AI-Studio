import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';

type VideoLockBannerProps = {
  className?: string;
  compact?: boolean;
};

export const VideoLockBanner: React.FC<VideoLockBannerProps> = ({ className, compact = false }) => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (state.workflow.videoState.accessUnlocked) {
    return null;
  }

  const handleUnlock = () => {
    if (password.trim() === '1234') {
      dispatch({ type: 'UPDATE_VIDEO_STATE', payload: { accessUnlocked: true } });
      setPassword('');
      setError('');
      return;
    }
    setError(t('rightPanel.video.lock.error'));
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface-elevated shadow-sm",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-surface-sunken flex items-center justify-center text-foreground">
          <Lock size={16} />
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">
            {t('rightPanel.video.lock.title')}
          </div>
          <div className="text-[11px] text-foreground-secondary">
            {t('rightPanel.video.lock.message')}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">
          {t('rightPanel.video.lock.passwordLabel')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleUnlock();
              }
            }}
            placeholder={t('rightPanel.video.lock.placeholder')}
            className="flex-1 h-9 px-3 text-xs bg-surface-sunken border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={handleUnlock}
            className="h-9 px-3 text-xs font-bold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            {t('rightPanel.video.lock.unlock')}
          </button>
        </div>
        {error && <div className="mt-2 text-[10px] text-red-600">{error}</div>}
        <div className="mt-2 text-[10px] text-foreground-muted">
          {t('rightPanel.video.lock.notice')}
        </div>
      </div>
    </div>
  );
};
