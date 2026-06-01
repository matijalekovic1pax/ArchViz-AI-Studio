import React from 'react';
import { FRAME_ANGLE_PRESETS } from './frameAnglePresetData';
import type { FrameAngleValue } from './frameAngleTypes';
import { clampFrameAngleValue } from './frameAngleUtils';
import { cn } from '../../lib/utils';

type FrameAnglePresetsProps = {
  value: FrameAngleValue;
  onChange: (value: FrameAngleValue) => void;
  disabled?: boolean;
};

export const FrameAnglePresets: React.FC<FrameAnglePresetsProps> = ({ value, onChange, disabled }) => {
  const next = clampFrameAngleValue(value);

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Presets</h3>
      <div className="grid grid-cols-2 gap-2">
        {FRAME_ANGLE_PRESETS.map((preset) => {
          const presetValue = clampFrameAngleValue(preset.value);
          const selected = presetValue.angleDeg === next.angleDeg && presetValue.tiltDeg === next.tiltDeg;
          return (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(presetValue)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface-elevated text-foreground-secondary hover:border-foreground/40 hover:text-foreground",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </section>
  );
};
