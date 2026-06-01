import React from 'react';
import {
  ANGLE_MAX,
  ANGLE_MIN,
  STEP,
  TILT_MAX,
  TILT_MIN,
  type FrameAngleValue,
} from './frameAngleTypes';
import { clampFrameAngleValue, formatSignedDegrees } from './frameAngleUtils';

type FrameAngleSlidersProps = {
  value: FrameAngleValue;
  onChange: (value: FrameAngleValue) => void;
  disabled?: boolean;
};

export const FrameAngleSliders: React.FC<FrameAngleSlidersProps> = ({ value, onChange, disabled }) => {
  const next = clampFrameAngleValue(value);

  return (
    <section className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Precision Sliders</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="frame-angle-slider" className="font-medium text-foreground-secondary">Angle</label>
          <span className="font-mono text-foreground-muted">{formatSignedDegrees(next.angleDeg)}</span>
        </div>
        <input
          id="frame-angle-slider"
          type="range"
          min={ANGLE_MIN}
          max={ANGLE_MAX}
          step={STEP}
          value={next.angleDeg}
          disabled={disabled}
          aria-label="Angle"
          onChange={(event) => onChange(clampFrameAngleValue({ ...next, angleDeg: Number(event.target.value) }))}
          className="w-full accent-foreground"
        />
        <div className="flex justify-between text-[10px] text-foreground-muted">
          <span>Left</span>
          <span>Right</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="frame-tilt-slider" className="font-medium text-foreground-secondary">Tilt</label>
          <span className="font-mono text-foreground-muted">{formatSignedDegrees(next.tiltDeg)}</span>
        </div>
        <input
          id="frame-tilt-slider"
          type="range"
          min={TILT_MIN}
          max={TILT_MAX}
          step={STEP}
          value={next.tiltDeg}
          disabled={disabled}
          aria-label="Tilt"
          onChange={(event) => onChange(clampFrameAngleValue({ ...next, tiltDeg: Number(event.target.value) }))}
          className="w-full accent-foreground"
        />
        <div className="flex justify-between text-[10px] text-foreground-muted">
          <span>Down / More floor</span>
          <span>Up / More ceiling</span>
        </div>
      </div>
    </section>
  );
};
