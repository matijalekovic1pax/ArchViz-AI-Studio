import React from 'react';
import {
  ANGLE_MAX,
  ANGLE_MIN,
  DEFAULT_FRAME_ANGLE_VALUE,
  TILT_MAX,
  TILT_MIN,
  type FrameAngleValue,
} from './frameAngleTypes';
import { clamp, clampFrameAngleValue, describeFrameAngle, formatSignedDegrees, roundToStep } from './frameAngleUtils';

type FrameAnglePadProps = {
  value: FrameAngleValue;
  onChange: (value: FrameAngleValue) => void;
  disabled?: boolean;
};

export const FrameAnglePad: React.FC<FrameAnglePadProps> = ({ value, onChange, disabled }) => {
  const next = clampFrameAngleValue(value);
  const dialSize = 164;
  const center = dialSize / 2;
  const radius = 58;
  const angleRad = (next.angleDeg * Math.PI) / 180;
  const angleDot = {
    x: center + Math.sin(angleRad) * radius,
    y: center + Math.cos(angleRad) * radius,
  };
  const tiltPercent = ((TILT_MAX - next.tiltDeg) / (TILT_MAX - TILT_MIN)) * 100;

  const emit = (candidate: FrameAngleValue) => {
    if (disabled) return;
    onChange(clampFrameAngleValue(candidate));
  };

  const updateAngleFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const angleDeg = clamp(roundToStep((Math.atan2(x, y) * 180) / Math.PI, 1), ANGLE_MIN, ANGLE_MAX);
    emit({ ...next, angleDeg });
  };

  const updateTiltFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const tiltDeg = roundToStep(TILT_MAX - y * (TILT_MAX - TILT_MIN), 1);
    emit({ ...next, tiltDeg });
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
        candidate = DEFAULT_FRAME_ANGLE_VALUE;
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
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Angle + Tilt</h3>
      <div className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-4">
        <div
          tabIndex={disabled ? -1 : 0}
          role="application"
          aria-label="Frame angle and tilt control"
          aria-valuetext={describeFrameAngle(next)}
          onKeyDown={handleKeyDown}
          className="relative flex aspect-square w-full items-center justify-center touch-none rounded-lg border border-border bg-surface-elevated outline-none transition-colors focus:border-foreground/60 focus:ring-2 focus:ring-foreground/10"
        >
          <svg
            width={dialSize}
            height={dialSize}
            viewBox={`0 0 ${dialSize} ${dialSize}`}
            className="touch-none text-foreground-muted"
            aria-hidden="true"
            onPointerDown={(event) => {
              if (disabled) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              updateAngleFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (disabled || (event.pointerType === 'mouse' && event.buttons !== 1)) return;
              updateAngleFromPointer(event);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
          >
            <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
            <path
              d={`M ${center - radius * 0.7} ${center + radius * 0.7} A ${radius} ${radius} 0 0 1 ${center + radius * 0.7} ${center + radius * 0.7}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.34"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line x1={center} y1={center} x2={center} y2={center + radius} stroke="currentColor" strokeOpacity="0.26" strokeWidth="1.5" strokeLinecap="round" />
            <line x1={center} y1={center} x2={angleDot.x} y2={angleDot.y} stroke="currentColor" strokeOpacity="0.58" strokeWidth="2" strokeLinecap="round" />
            <circle cx={center} cy={center} r="4" className="fill-foreground" opacity="0.32" />
            <circle cx={angleDot.x} cy={angleDot.y} r="8" className="fill-foreground" />
            <circle cx={angleDot.x} cy={angleDot.y} r="12" fill="none" className="stroke-foreground" strokeOpacity="0.16" strokeWidth="2" />
            <text x={center} y={center + radius + 20} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">0° original</text>
            <text x={center - radius - 10} y={center + radius * 0.52} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.55">Left</text>
            <text x={center + radius + 10} y={center + radius * 0.52} textAnchor="start" fontSize="9" fill="currentColor" opacity="0.55">Right</text>
          </svg>
          <div className="pointer-events-none absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Angle</div>
          <div className="pointer-events-none absolute top-3 right-3 font-mono text-[10px] text-foreground-muted">{formatSignedDegrees(next.angleDeg)}</div>
        </div>
        <div className="flex h-full min-h-[190px] flex-col items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 py-4">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-foreground-muted">Tilt Up</span>
          <div
            className="relative h-32 w-7 touch-none rounded-full bg-surface-sunken"
            onPointerDown={(event) => {
              if (disabled) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              updateTiltFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (disabled || (event.pointerType === 'mouse' && event.buttons !== 1)) return;
              updateTiltFromPointer(event);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
          >
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border-strong" />
            <div className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 bg-border-strong" />
            <div
              className="absolute left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-elevated bg-foreground shadow-subtle"
              style={{ top: `${tiltPercent}%` }}
            />
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-foreground-muted">Tilt Down</span>
          <span className="font-mono text-[10px] text-foreground-muted">{formatSignedDegrees(next.tiltDeg)}</span>
        </div>
      </div>
      <p className="text-center text-xs text-foreground-secondary">{describeFrameAngle(next)}</p>
      <p className="text-center text-[10px] text-foreground-muted">Drag the circle for angle. Drag the vertical slider for tilt.</p>
    </section>
  );
};
