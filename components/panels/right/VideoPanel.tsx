import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { Download, Play, RotateCcw, Lock, Unlock } from 'lucide-react';
import { VideoLockBanner } from '../../video/VideoLockBanner';
import { downloadFile } from '../../../lib/download';

// ── Small pill-button group ───────────────────────────────────────────────────
interface PillGroupProps<T extends string | number> {
  label: string;
  options: { value: T; label: string; disabled?: boolean; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}
function PillGroup<T extends string | number>({ label, options, value, onChange }: PillGroupProps<T>) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">{label}</p>
      <div className={cn('grid gap-1.5', {
        'grid-cols-2': options.length === 2,
        'grid-cols-3': options.length === 3,
        'grid-cols-4': options.length === 4,
      })}>
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => !opt.disabled && onChange(opt.value)}
            disabled={opt.disabled}
            title={opt.hint}
            className={cn(
              'py-2 text-[11px] font-bold rounded-lg border transition-all',
              value === opt.value
                ? 'bg-foreground text-background border-foreground'
                : opt.disabled
                  ? 'bg-surface-sunken text-foreground-muted border-transparent opacity-40 cursor-not-allowed'
                  : 'bg-surface-elevated border-border hover:border-foreground-muted text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────
interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}
function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface-elevated border border-border hover:border-foreground/30 transition-colors"
    >
      <span className="text-[11px] font-medium text-foreground">{label}</span>
      {/* Toggle pill */}
      <span
        className={cn(
          'flex-shrink-0 inline-flex items-center w-10 h-[22px] rounded-full border transition-colors duration-200',
          value ? 'bg-foreground border-foreground' : 'bg-surface-sunken border-border'
        )}
      >
        <span
          className={cn(
            'w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200',
            value ? 'translate-x-[21px]' : 'translate-x-[1px]'
          )}
        />
      </span>
    </button>
  );
}

// ── Video player ──────────────────────────────────────────────────────────────
interface VideoPlayerProps {
  src: string;
  onDownload: () => void;
}
const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, onDownload }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reload when src changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.load();
  }, [src]);

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-black">
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        preload="metadata"
        className="w-full max-h-64 object-contain"
        style={{ display: 'block' }}
      />
      <div className="px-3 py-2.5 bg-surface-elevated border-t border-border flex items-center gap-2">
        <button
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <Download size={13} />
          Download MP4
        </button>
      </div>
    </div>
  );
};

// ── History thumbnail ─────────────────────────────────────────────────────────
interface HistoryItemProps {
  url: string;
  timestamp: number;
  onClick: () => void;
}
const HistoryItem: React.FC<HistoryItemProps> = ({ url, timestamp, onClick }) => (
  <button
    onClick={onClick}
    className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border hover:border-foreground-muted transition-colors group"
    title={new Date(timestamp).toLocaleTimeString()}
  >
    <video src={url} className="w-full h-full object-cover opacity-80" muted />
    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
      <Play size={16} className="text-white" fill="white" />
    </div>
  </button>
);

// ── Main panel ────────────────────────────────────────────────────────────────
export const VideoPanel = () => {
  const { state, dispatch } = useAppStore();
  const video = state.workflow.videoState;
  const isLocked = !video.accessUnlocked;
  const isGenerating = state.isGenerating;
  const progress = video.generationProgress;

  if (isLocked) return <VideoLockBanner compact />;

  const updateVideo = (payload: Partial<typeof video>) =>
    dispatch({ type: 'UPDATE_VIDEO_STATE', payload });

  // ── Veo constraints ──
  const is4kLocked = video.resolution === '4k' && video.duration < 8;

  return (
    <div className="space-y-5">

      {/* Header badge */}
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-elevated border border-border">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[10px] font-bold tracking-wide text-foreground">Veo 3.1 Preview</span>
        </div>
        <span className="text-[9px] text-foreground-muted">Google DeepMind</span>
      </div>

      {/* ── Duration ── */}
      <PillGroup
        label="Duration"
        value={video.duration}
        onChange={(v) => updateVideo({ duration: v })}
        options={[
          { value: 4, label: '4s' },
          { value: 6, label: '6s' },
          { value: 8, label: '8s', hint: 'Required for 4K' },
        ]}
      />

      {/* ── Aspect Ratio ── */}
      <PillGroup
        label="Aspect Ratio"
        value={video.aspectRatio}
        onChange={(v) => updateVideo({ aspectRatio: v as typeof video.aspectRatio })}
        options={[
          { value: '16:9', label: '16:9' },
          { value: '9:16', label: '9:16' },
        ]}
      />

      {/* ── Resolution ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">Resolution</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(['720p', '1080p', '4k'] as const).map((res) => {
            const needs8s = res === '4k' && video.duration < 8;
            const isActive = video.resolution === res;
            return (
              <button
                key={res}
                onClick={() => {
                  if (needs8s) updateVideo({ resolution: res, duration: 8 });
                  else updateVideo({ resolution: res });
                }}
                title={needs8s ? 'Will set duration to 8s' : undefined}
                className={cn(
                  'py-2 text-[11px] font-bold rounded-lg border transition-all',
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : needs8s
                      ? 'bg-surface-elevated border-border text-foreground-muted hover:border-foreground-muted'
                      : 'bg-surface-elevated border-border hover:border-foreground-muted text-foreground'
                )}
              >
                {res === '4k' ? '4K' : res.toUpperCase()}
                {needs8s && <span className="block text-[8px] font-normal opacity-60 mt-0.5">needs 8s</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Toggles ── */}
      <div className="space-y-2">
        <ToggleRow
          label="Generate Audio"
          value={!!video.generateAudio}
          onChange={(v) => updateVideo({ generateAudio: v })}
        />
      </div>

      {/* ── Person Generation ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">People in Scene</p>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { value: 'dont_allow',  label: 'Off',              sub: 'no people' },
            { value: 'allow_adult', label: 'Animate',          sub: 'existing' },
            { value: 'allow_all',   label: 'Add new',          sub: 'people' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateVideo({ personGeneration: opt.value })}
              className={cn(
                'py-2 px-1 text-[11px] font-bold rounded-lg border transition-all flex flex-col items-center gap-0.5',
                (video.personGeneration ?? 'allow_adult') === opt.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-surface-elevated border-border hover:border-foreground-muted text-foreground'
              )}
            >
              <span>{opt.label}</span>
              <span className="text-[9px] font-normal opacity-60">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Seed ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">Seed</p>
        <div className="flex gap-2">
          <input
            type="number"
            value={video.seed}
            onChange={(e) => updateVideo({ seed: parseInt(e.target.value) || 0 })}
            disabled={!video.seedLocked}
            className="flex-1 h-9 px-3 text-xs bg-surface-elevated border border-border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
          />
          <button
            onClick={() => updateVideo({ seedLocked: !video.seedLocked })}
            title={video.seedLocked ? 'Unlock seed (random)' : 'Lock seed (reproducible)'}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg border transition-all',
              video.seedLocked
                ? 'bg-foreground text-background border-foreground'
                : 'bg-surface-elevated border-border text-foreground-muted hover:border-foreground-muted'
            )}
          >
            {video.seedLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
        </div>
        {!video.seedLocked && (
          <p className="text-[9px] text-foreground-muted mt-1.5 opacity-60">Random seed each generation</p>
        )}
      </div>

      {/* ── Generation Progress ── */}
      {isGenerating && progress && (
        <div className="p-3.5 bg-surface-elevated rounded-xl border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground truncate pr-2">
              {progress.message || 'Generating…'}
            </span>
            <span className="text-[10px] text-foreground-muted font-mono flex-shrink-0">
              {Math.round(progress.progress)}%
            </span>
          </div>
          <div className="w-full bg-surface-sunken rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-foreground h-full rounded-full transition-all duration-500"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          {progress.estimatedTimeRemaining != null && progress.estimatedTimeRemaining > 0 && (
            <p className="text-[9px] text-foreground-muted">
              ~{Math.ceil(progress.estimatedTimeRemaining)}s remaining
            </p>
          )}
        </div>
      )}

      {/* ── Generated Video Output ── */}
      {video.generatedVideoUrl && !isGenerating && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Output</p>
          <VideoPlayer
            src={video.generatedVideoUrl}
            onDownload={() => downloadFile(video.generatedVideoUrl!, `veo-${Date.now()}.mp4`)}
          />
          <button
            onClick={() => updateVideo({ generatedVideoUrl: null, generationProgress: null })}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] text-foreground-muted hover:text-foreground transition-colors"
          >
            <RotateCcw size={11} />
            Clear & generate again
          </button>
        </div>
      )}

      {/* ── Generation History ── */}
      {video.generationHistory.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">
            History
          </p>
          <div className="grid grid-cols-2 gap-2">
            {video.generationHistory.slice(-6).reverse().map((item) => (
              <HistoryItem
                key={item.id}
                url={item.url}
                timestamp={item.timestamp}
                onClick={() => updateVideo({ generatedVideoUrl: item.url })}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
