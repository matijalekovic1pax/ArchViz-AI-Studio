import React, { useCallback } from 'react';
import { Camera, RotateCcw, RotateCw, ScanEye } from 'lucide-react';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';
import type { WorkflowSettings } from '../../../types';

type AngleDirection = WorkflowSettings['angleChangeDirection'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const DIRECTION_PRESETS: Array<{
  id: AngleDirection;
  label: string;
  degrees: number;
  icon: React.ElementType;
  description: string;
}> = [
  {
    id: 'left-90',
    label: 'Left 90',
    degrees: -90,
    icon: RotateCcw,
    description: 'Move the camera to the image-left side.',
  },
  {
    id: 'right-90',
    label: 'Right 90',
    degrees: 90,
    icon: RotateCw,
    description: 'Move the camera to the image-right side.',
  },
  {
    id: 'turn-around',
    label: 'Turn Around',
    degrees: 180,
    icon: ScanEye,
    description: 'View the opposite side of the same space.',
  },
  {
    id: 'custom',
    label: 'Custom',
    degrees: 45,
    icon: Camera,
    description: 'Set the camera orbit manually.',
  },
];

const formatRotation = (degrees: number) => {
  if (degrees === 0) return '0°';
  if (Math.abs(degrees) === 180) return '180°';
  return `${Math.abs(degrees)}° ${degrees < 0 ? 'left' : 'right'}`;
};

const formatTilt = (degrees: number) => {
  if (degrees === 0) return 'level';
  return `${Math.abs(degrees)}° ${degrees > 0 ? 'up' : 'down'}`;
};

const AngleOrbitPreview: React.FC<{
  rotation: number;
  pitch: number;
  onAngleChange: (rotation: number, pitch: number) => void;
}> = ({ rotation, pitch, onAngleChange }) => {
  const sphereId = React.useId().replace(/:/g, '');
  const size = 168;
  const center = size / 2;
  const radius = 60;
  const orbitY = radius * 0.58;
  const yaw = (clamp(rotation, -180, 180) * Math.PI) / 180;
  const tilt = (clamp(pitch, -30, 30) * Math.PI) / 180;
  const source = {
    x: center,
    y: center + orbitY,
  };
  const target = {
    x: center + radius * Math.sin(yaw) * Math.cos(tilt),
    y: center + orbitY * Math.cos(yaw) * Math.cos(tilt) - radius * 0.46 * Math.sin(tilt),
  };
  const depth = Math.cos(yaw) * Math.cos(tilt);
  const targetSize = depth >= 0 ? 7 : 5.5;
  const targetOpacity = depth >= 0 ? 1 : 0.72;
  const control = {
    x: center + (target.x - center) * 0.28,
    y: Math.max(center - radius * 0.78, Math.min(center + orbitY + 8, center + orbitY * 0.92 - radius * 0.2 * Math.sin(tilt))),
  };
  const path = `M ${source.x} ${source.y} Q ${control.x} ${control.y} ${target.x} ${target.y}`;

  const updateFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotationRatio = clamp((x - rect.width / 2) / (rect.width * 0.38), -1, 1);
    const pitchRatio = clamp((rect.height / 2 - y) / (rect.height * 0.36), -1, 1);
    const nextRotation = Math.round((rotationRatio * 180) / 5) * 5;
    const nextPitch = Math.round(pitchRatio * 30);
    onAngleChange(nextRotation, nextPitch);
  };

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground-muted">Camera shift</span>
        <span className="font-mono text-foreground-secondary">{formatRotation(rotation)}</span>
      </div>

      <div className="mt-3 flex flex-col items-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="cursor-crosshair touch-none text-foreground-muted"
          role="img"
          aria-label={`Camera sphere preview, source at bottom, target ${formatRotation(rotation)} and ${formatTilt(pitch)}`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) updateFromPointer(event);
          }}
        >
          <defs>
            <radialGradient id={`${sphereId}-fill`} cx="38%" cy="28%" r="72%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="58%" stopColor="currentColor" stopOpacity="0.07" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.16" />
            </radialGradient>
            <linearGradient id={`${sphereId}-stroke`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="48%" stopColor="currentColor" stopOpacity="0.42" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.16" />
            </linearGradient>
            <clipPath id={`${sphereId}-clip`}>
              <circle cx={center} cy={center} r={radius} />
            </clipPath>
          </defs>
          <ellipse cx={center} cy={center + radius + 13} rx={radius * 0.78} ry="8" fill="currentColor" opacity="0.08" />
          <circle cx={center} cy={center} r={radius} fill={`url(#${sphereId}-fill)`} stroke={`url(#${sphereId}-stroke)`} strokeWidth="1.5" />
          <g clipPath={`url(#${sphereId}-clip)`} fill="none" stroke="currentColor" strokeLinecap="round">
            <ellipse cx={center} cy={center} rx={radius * 0.96} ry={orbitY} strokeOpacity="0.26" strokeWidth="1.4" />
            <ellipse cx={center} cy={center - radius * 0.22} rx={radius * 0.74} ry={orbitY * 0.34} strokeOpacity="0.14" strokeWidth="1" />
            <ellipse cx={center} cy={center + radius * 0.22} rx={radius * 0.74} ry={orbitY * 0.34} strokeOpacity="0.22" strokeWidth="1" />
            <ellipse cx={center} cy={center} rx={radius * 0.34} ry={radius * 0.96} strokeOpacity="0.16" strokeWidth="1" />
            <ellipse cx={center} cy={center} rx={radius * 0.58} ry={radius * 0.96} strokeOpacity="0.12" strokeWidth="1" transform={`rotate(34 ${center} ${center})`} />
            <ellipse cx={center} cy={center} rx={radius * 0.58} ry={radius * 0.96} strokeOpacity="0.12" strokeWidth="1" transform={`rotate(-34 ${center} ${center})`} />
          </g>
          <ellipse cx={center} cy={center} rx={radius * 0.96} ry={orbitY} fill="none" stroke="currentColor" strokeOpacity="0.34" strokeWidth="1.6" strokeDasharray="2 5" />
          <line x1={center} y1={center - radius * 0.8} x2={center} y2={center + radius * 0.8} stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" strokeLinecap="round" />
          <path d={path} fill="none" stroke="currentColor" strokeOpacity="0.62" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx={source.x} cy={source.y} r="6" fill="currentColor" opacity="0.42" />
          <circle cx={source.x} cy={source.y} r="10" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
          <circle cx={target.x} cy={target.y} r={targetSize} fill="currentColor" opacity={targetOpacity} />
          <circle cx={target.x} cy={target.y} r={targetSize + 4} fill="none" stroke="currentColor" strokeOpacity={0.24 + Math.max(depth, 0) * 0.12} strokeWidth="1.4" />
          <text x={source.x} y={source.y + 20} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.58">source</text>
          <text x={target.x} y={target.y - 12} textAnchor="middle" fontSize="9" fill="currentColor" opacity={targetOpacity}>new</text>
        </svg>
        <div className="mt-3 grid w-full grid-cols-2 gap-2">
          <div className="rounded-md bg-surface-sunken px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Rotation</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{formatRotation(rotation)}</div>
          </div>
          <div className="rounded-md bg-surface-sunken px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Tilt</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{formatTilt(pitch)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AngleChangePanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const updateWf = useCallback(
    (payload: Partial<WorkflowSettings>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch]
  );

  const handlePreset = (preset: typeof DIRECTION_PRESETS[number]) => {
    updateWf({
      angleChangeDirection: preset.id,
      angleChangeDegrees: preset.id === 'custom' ? wf.angleChangeDegrees : preset.degrees,
    });
  };

  const handleRotationChange = (value: number) => {
    const next = clamp(Math.round(value), -180, 180);
    const matchingPreset = DIRECTION_PRESETS.find(
      (preset) => preset.id !== 'custom' && preset.degrees === next
    );
    updateWf({
      angleChangeDegrees: next,
      angleChangeDirection: matchingPreset?.id ?? 'custom',
    });
  };

  const handleAngleChange = (rotation: number, pitch: number) => {
    const nextRotation = clamp(Math.round(rotation), -180, 180);
    const nextPitch = clamp(Math.round(pitch), -30, 30);
    const matchingPreset = DIRECTION_PRESETS.find(
      (preset) => preset.id !== 'custom' && preset.degrees === nextRotation
    );
    updateWf({
      angleChangeDegrees: nextRotation,
      angleChangePitch: nextPitch,
      angleChangeDirection: matchingPreset?.id ?? 'custom',
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-xs text-foreground-muted block font-bold uppercase tracking-wider">Point of View</label>
        <div className="grid grid-cols-2 gap-2">
          {DIRECTION_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const selected = wf.angleChangeDirection === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePreset(preset)}
                title={preset.description}
                className={cn(
                  "min-h-[72px] rounded-lg border px-3 py-2 text-left transition-all",
                  selected
                    ? "border-foreground bg-foreground text-background shadow-subtle"
                    : "border-border bg-surface-elevated text-foreground-secondary hover:border-foreground/40 hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon size={16} strokeWidth={1.7} />
                  <span className={cn("text-[10px] font-mono", selected ? "text-background/70" : "text-foreground-muted")}>
                    {preset.id === 'custom' ? formatRotation(wf.angleChangeDegrees) : `${Math.abs(preset.degrees)}°`}
                  </span>
                </div>
                <div className="mt-2 text-xs font-semibold">{preset.label}</div>
                <div className={cn("mt-1 text-[10px] leading-snug", selected ? "text-background/70" : "text-foreground-muted")}>
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
        <AngleOrbitPreview
          rotation={wf.angleChangeDegrees}
          pitch={wf.angleChangePitch}
          onAngleChange={handleAngleChange}
        />
      </div>

      <div className="space-y-3">
        <label className="text-xs text-foreground-muted block font-bold uppercase tracking-wider">Angle</label>
        <Slider
          label="Rotation"
          min={-180}
          max={180}
          step={5}
          value={wf.angleChangeDegrees}
          onChange={handleRotationChange}
        />
        <Slider
          label="Tilt"
          min={-30}
          max={30}
          step={1}
          value={wf.angleChangePitch}
          onChange={(value) => updateWf({ angleChangePitch: clamp(Math.round(value), -30, 30) })}
        />
      </div>
    </div>
  );
};
