import React from 'react';
import { cn } from '../../lib/utils';
import { FrameAnglePad } from './FrameAnglePad';
import { FrameAnglePreview } from './FrameAnglePreview';
import { DEFAULT_FRAME_ANGLE_VALUE, type FrameAngleControllerProps } from './frameAngleTypes';
import { clampFrameAngleValue } from './frameAngleUtils';

export const FrameAngleController: React.FC<FrameAngleControllerProps> = ({
  imageUrl,
  value,
  onChange,
  disabled,
  className,
}) => {
  const next = clampFrameAngleValue(value);
  const handleChange = (candidate: typeof next) => onChange(clampFrameAngleValue(candidate));

  return (
    <div className={cn("space-y-5", className)}>
      <section className="space-y-1">
        <h3 className="text-sm font-bold text-foreground">Frame Angle</h3>
        <p className="text-xs leading-relaxed text-foreground-muted">
          Choose how the generated view should shift from the original image.
        </p>
      </section>
      <FrameAnglePad value={next} onChange={handleChange} disabled={disabled} />
      <FrameAnglePreview imageUrl={imageUrl} value={next} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleChange(DEFAULT_FRAME_ANGLE_VALUE)}
        className={cn(
          "w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground-secondary transition-colors hover:border-foreground/40 hover:text-foreground",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        Reset angle
      </button>
    </div>
  );
};

export type { FrameAngleControllerProps, FrameAngleValue } from './frameAngleTypes';
