import React, { useRef, useCallback } from 'react';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { VideoLockBanner } from '../../video/VideoLockBanner';
import { Upload, X, ArrowRight, Wand2, Layers, Type } from 'lucide-react';

// ── Reusable image upload zone ────────────────────────────────────────────────

interface ImageUploadZoneProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  sublabel?: string;
  aspectRatio?: string; // CSS aspect-ratio value e.g. "16/9"
  className?: string;
}

const ImageUploadZone: React.FC<ImageUploadZoneProps> = ({
  value, onChange, label, sublabel, aspectRatio = '16/9', className
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) onChange(e.target.result as string); };
    reader.readAsDataURL(file);
  }, [onChange]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">{label}</span>
          {sublabel && <span className="text-[9px] text-foreground-muted font-mono opacity-60">{sublabel}</span>}
        </div>
      )}

      <div
        style={{ aspectRatio }}
        className={cn(
          'relative w-full overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-pointer group',
          value
            ? 'border-foreground/40 hover:border-foreground/80'
            : 'border-dashed border-border hover:border-foreground/40 bg-surface-elevated'
        )}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => e.preventDefault()}
      >
        {value ? (
          <>
            <img
              src={value}
              alt={label}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* dim overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />
            {/* remove button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            >
              <X size={11} />
            </button>
            {/* replace hint */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 text-white text-[10px] font-medium">
                <Upload size={11} />
                Replace
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-foreground-muted">
            <div className="w-9 h-9 rounded-xl border-2 border-dashed border-current/40 flex items-center justify-center">
              <Upload size={15} />
            </div>
            <div className="text-center">
              <div className="text-[10px] font-medium">Drop image or click</div>
              <div className="text-[9px] opacity-50 mt-0.5">JPG, PNG, WebP</div>
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = ''; } }}
      />
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────

export const LeftVideoPanel = () => {
  const { state, dispatch } = useAppStore();
  const video = state.workflow.videoState;
  const isLocked = !video.accessUnlocked;

  const updateVideo = (payload: Partial<typeof video>) =>
    dispatch({ type: 'UPDATE_VIDEO_STATE', payload });

  if (isLocked) return <VideoLockBanner compact />;

  const isOmni = video.model === 'gemini-omni-1.1-flash';
  const followUp = isOmni && video.omniInteractionId ? (video.omniFollowUp ?? 'none') : 'none';
  const isFollowUp = followUp !== 'none';
  const isAnimate = video.inputMode === 'image-animate' && !isFollowUp;
  const isInterpolate = video.inputMode === 'image-morph' && !isFollowUp;
  const isTextToVideo = video.inputMode === 'text-to-video' && !isFollowUp;
  const modelName = isOmni ? 'Omni Flash' : 'Veo';

  // The Prompt tab compiles this brief into the full instruction. A manual edit
  // down there becomes an override, and then this box no longer reaches the model.
  const promptOverridden = Boolean(state.prompt?.trim());

  const briefCopy = isFollowUp
    ? followUp === 'extend'
      ? {
          label: 'Continuation',
          placeholder: 'e.g. the camera keeps pushing toward the far window as the concourse empties',
          hint: 'Describe what should happen next in the clip you just generated.',
        }
      : {
          label: 'Edit Instruction',
          placeholder: 'e.g. warmer evening light, remove the people on the left',
          hint: 'Describe the change to apply to the clip you just generated.',
        }
    : isTextToVideo
      ? {
          label: 'Prompt',
          placeholder: 'e.g. slow dolly through a sunlit concrete atrium, travellers crossing the frame, soft ambient noise',
          hint: 'Subject, setting, camera move, light and length — Omni takes its pacing from the wording.',
        }
      : {
          label: 'Motion Prompt',
          placeholder: 'e.g. slow push-in, people walking, gentle light shift',
          hint: 'Describe the motion you want. Feeds the full prompt in the Prompt tab.',
        };

  // Omni generates straight from a prompt but cannot interpolate between two
  // frames; Veo is the opposite.
  const modes = isOmni
    ? ([
        { id: 'image-animate',  icon: Wand2, label: 'Animate Image', sub: 'Image → Video' },
        { id: 'text-to-video',  icon: Type,  label: 'Text → Video',  sub: 'Prompt only' },
      ] as const)
    : ([
        { id: 'image-animate', icon: Wand2,  label: 'Animate Image',      sub: 'Image → Video' },
        { id: 'image-morph',   icon: Layers, label: 'Interpolate Frames', sub: 'Start → End' },
      ] as const);

  return (
    <div className="space-y-5">

      {/* ── Mode selector ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">Mode</p>
        <div className="grid grid-cols-2 gap-2">
          {modes.map(({ id, icon: Icon, label, sub }) => (
            <button
              key={id}
              // Choosing an input mode means starting fresh, so drop any
              // pending edit/extend rather than leaving a dead end.
              onClick={() => updateVideo({ inputMode: id, omniFollowUp: 'none' })}
              className={cn(
                'flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all',
                video.inputMode === id
                  ? 'bg-surface-elevated border-foreground shadow-sm'
                  : 'bg-background-tertiary border-transparent hover:bg-surface-elevated hover:border-border'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                video.inputMode === id ? 'bg-foreground text-background' : 'bg-surface-sunken text-foreground-muted'
              )}>
                <Icon size={14} />
              </div>
              <div>
                <div className="text-[11px] font-bold leading-tight">{label}</div>
                <div className="text-[9px] text-foreground-muted mt-0.5">{sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Image Animate: single upload ── */}
      {isAnimate && (
        <div>
          <ImageUploadZone
            label="Input Image"
            sublabel="reference"
            value={video.videoInputImage}
            onChange={(url) => updateVideo({ videoInputImage: url })}
            aspectRatio="16/9"
          />
          {!video.videoInputImage && (
            <p className="mt-2 text-[10px] text-foreground-muted text-center opacity-70">
              Upload an image — {modelName} will animate it
            </p>
          )}
        </div>
      )}

      {/* ── Text → Video: no input image, the prompt carries the whole scene ── */}
      {isTextToVideo && (
        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border text-[10px] text-foreground-muted leading-relaxed">
          {modelName} will generate the video from your prompt alone. Describe the
          subject, the camera move, the light and the length you want — Omni takes
          its pacing and its audio from the wording.
        </div>
      )}

      {/* ── Follow-up turn: the model already holds the clip, so no inputs ── */}
      {isFollowUp && (
        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border text-[10px] text-foreground-muted leading-relaxed">
          {followUp === 'extend' ? 'Extending' : 'Editing'} the clip you just generated —
          no input image needed. Switch <strong className="text-foreground">Next Generation</strong> back
          to <strong className="text-foreground">New</strong> in the right panel to start from scratch.
        </div>
      )}

      {/* ── Frame Interpolation: start + end ── */}
      {isInterpolate && (
        <div className="space-y-3">
          {/* Info */}
          <div className="p-2.5 rounded-lg bg-surface-elevated border border-border text-[10px] text-foreground-muted leading-relaxed">
            {modelName} will generate a smooth video that morphs from the <strong className="text-foreground">start frame</strong> to the <strong className="text-foreground">end frame</strong>.
          </div>

          {/* Start frame */}
          <ImageUploadZone
            label="Start Frame"
            sublabel="frame 1"
            value={video.startFrame}
            onChange={(url) => updateVideo({ startFrame: url })}
            aspectRatio="16/9"
          />

          {/* Arrow */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <div className="flex items-center gap-1 text-[9px] text-foreground-muted font-medium">
              <ArrowRight size={12} />
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* End frame */}
          <ImageUploadZone
            label="End Frame"
            sublabel="last frame"
            value={video.endFrame}
            onChange={(url) => updateVideo({ endFrame: url })}
            aspectRatio="16/9"
          />

          {/* Status */}
          {(!video.startFrame || !video.endFrame) ? (
            <p className="text-[10px] text-foreground-muted text-center bg-surface-sunken rounded-lg p-2">
              {!video.startFrame && !video.endFrame
                ? 'Upload both frames to enable interpolation'
                : !video.startFrame ? 'Add a start frame' : 'Add an end frame'}
            </p>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-foreground bg-surface-elevated rounded-lg p-2 border border-border">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="font-medium">Both frames ready</span>
            </div>
          )}
        </div>
      )}

      {/* ── Brief ── the raw instruction, compiled into the Prompt tab below ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
            {briefCopy.label}
          </span>
          {video.scenario?.trim() && (
            <button
              type="button"
              onClick={() => updateVideo({ scenario: '' })}
              className="text-[9px] text-foreground-muted hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          value={video.scenario}
          onChange={(e) => updateVideo({ scenario: e.target.value })}
          placeholder={briefCopy.placeholder}
          rows={4}
          className="w-full resize-none rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-[11px] leading-relaxed text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-foreground/40 transition-colors"
        />
        <p className="mt-1.5 text-[9px] text-foreground-muted leading-relaxed opacity-70">
          {briefCopy.hint}
        </p>
        {promptOverridden && (
          <div className="mt-2 flex items-start gap-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
            <p className="flex-1 text-[9px] leading-relaxed text-foreground-muted">
              The <strong className="text-foreground">Prompt</strong> tab has a hand-edited
              prompt, which overrides this box.
            </p>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_PROMPT', payload: '' })}
              className="shrink-0 text-[9px] font-bold text-foreground hover:opacity-70 transition-opacity"
            >
              Use this
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
