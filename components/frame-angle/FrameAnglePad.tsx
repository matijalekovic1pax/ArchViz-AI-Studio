import React from 'react';
import {
  ANGLE_MAX,
  ANGLE_MIN,
  STEP,
  TILT_MAX,
  TILT_MIN,
  type FrameAngleValue,
} from './frameAngleTypes';
import { clamp, clampFrameAngleValue, describeFrameAngle, roundToStep } from './frameAngleUtils';

type FrameAnglePadProps = {
  value: FrameAngleValue;
  onChange: (value: FrameAngleValue) => void;
  disabled?: boolean;
};

export const FrameAnglePad: React.FC<FrameAnglePadProps> = ({ value, onChange, disabled }) => {
  const next = clampFrameAngleValue(value);
  const leftPercent = ((next.angleDeg - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN)) * 100;
  const topPercent = ((TILT_MAX - next.tiltDeg) / (TILT_MAX - TILT_MIN)) * 100;

  const emit = (candidate: FrameAngleValue) => {
    if (disabled) return;
    onChange(clampFrameAngleValue(candidate));
  };

  const updateFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    emit({
      angleDeg: roundToStep(ANGLE_MIN + x * (ANGLE_MAX - ANGLE_MIN), STEP),
      tiltDeg: roundToStep(TILT_MAX - y * (TILT_MAX - TILT_MIN), STEP),
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const delta = event.shiftKey ? 5 : 1;
    let candidate: FrameAngleValue | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        candidate = { ...next, angleDeg: next.angleDeg - delta };
        break;
      case 'ArrowRight':
        candidate = { ...next, angleDeg: next.angleDeg + delta };
        break;
      case 'ArrowUp':
        candidate = { ...next, tiltDeg: next.tiltDeg + delta };
        break;
      case 'ArrowDown':
        candidate = { ...next, tiltDeg: next.tiltDeg - delta };
        break;
      case 'Home':
        candidate = { angleDeg: 0, tiltDeg: 0 };
        break;
      default:
        break;
    }

    if (candidate) {
      event.preventDefault();
      emit(candidate);
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Angle / Tilt Pad</h3>
      <div className="flex justify-center">
        <div
          tabIndex={disabled ? -1 : 0}
          role="application"
          aria-label="Frame angle and tilt control"
          aria-valuetext={describeFrameAngle(next)}
          onPointerDown={(event) => {
            if (disabled) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (disabled || (event.pointerType === 'mouse' && event.buttons !== 1)) return;
            updateFromPointer(event);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onKeyDown={handleKeyDown}
          className="relative aspect-square w-full max-w-[280px] touch-none rounded-lg border border-border bg-surface-elevated outline-none transition-colors focus:border-foreground/60 focus:ring-2 focus:ring-foreground/10"
        >
          <div className="pointer-events-none absolute inset-4 rounded-full border border-border-subtle" />
          <div className="pointer-events-none absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-border-strong" />
          <div className="pointer-events-none absolute bottom-4 top-4 left-1/2 w-px -translate-x-1/2 bg-border-strong" />
          <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-wider text-foreground-muted">Angle Left</div>
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-wider text-foreground-muted">Angle Right</div>
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wider text-foreground-muted">Tilt Up</div>
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wider text-foreground-muted">Tilt Down</div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/30" />
          <div
            className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-elevated bg-foreground shadow-subtle"
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
            }}
          />
        </div>
      </div>
      <p className="text-center text-xs text-foreground-secondary">{describeFrameAngle(next)}</p>
      <p className="text-center text-[10px] text-foreground-muted">Drag the dot to set the new view angle.</p>
    </section>
  );
};
