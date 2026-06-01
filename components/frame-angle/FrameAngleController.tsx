import React from 'react';
import { cn } from '../../lib/utils';
import { FrameAnglePad } from './FrameAnglePad';
import { FrameAnglePresets } from './FrameAnglePresets';
import { FrameAnglePreview } from './FrameAnglePreview';
import { FrameAngleSliders } from './FrameAngleSliders';
import type { FrameAngleControllerProps } from './frameAngleTypes';
import { clampFrameAngleValue } from './frameAngleUtils';

export const FrameAngleController: React.FC<FrameAngleControllerProps> = ({
  imageUrl,
  value,
  onChange,
  onGenerate,
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
      <FrameAnglePreview imageUrl={imageUrl} value={next} />
      <FrameAnglePad value={next} onChange={handleChange} disabled={disabled} />
      <FrameAngleSliders value={next} onChange={handleChange} disabled={disabled} />
      <FrameAnglePresets value={next} onChange={handleChange} onGenerate={onGenerate} disabled={disabled} />
    </div>
  );
};

export type { FrameAngleControllerProps, FrameAngleValue } from './frameAngleTypes';
