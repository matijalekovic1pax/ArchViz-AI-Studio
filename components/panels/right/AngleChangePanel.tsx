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

const formatAngleSummary = (rotation: number, pitch: number) => {
  if (pitch === 0) return formatRotation(rotation);
  return `${formatRotation(rotation)} / ${formatTilt(pitch)}`;
};

const AngleOrbitPreview: React.FC<{
  rotation: number;
  pitch: number;
  onAngleChange: (rotation: number, pitch: number) => void;
}> = ({ rotation, pitch, onAngleChange }) => {
  const size = 168;
  const center = size / 2;
  const axisHalf = 58;
  const rotationRatio = clamp(rotation / 180, -1, 1);
  const pitchRatio = clamp(pitch / 30, -1, 1);
  const frameRotation = rotationRatio * 42;
  const frameRotationRad = (frameRotation * Math.PI) / 180;
  const horizontalBow = -pitchRatio * 30;
  const verticalBow = rotationRatio * 45;
  const secondaryAxisOpacity = Math.min(0.18, (Math.abs(rotationRatio) + Math.abs(pitchRatio)) * 0.14);
  const targetOffset = {
    x: rotationRatio * axisHalf,
    y: -pitchRatio * axisHalf,
  };
  const target = {
    x: center + targetOffset.x * Math.cos(frameRotationRad) - targetOffset.y * Math.sin(frameRotationRad),
    y: center + targetOffset.x * Math.sin(frameRotationRad) + targetOffset.y * Math.cos(frameRotationRad),
  };
  const hasTargetOffset = Math.abs(rotation) > 0 || Math.abs(pitch) > 0;
  const neutralLabelY = center + 19;
  const horizontalAxisPath = `M ${center - axisHalf} ${center} Q ${center} ${center + horizontalBow} ${center + axisHalf} ${center}`;
  const verticalAxisPath = `M ${center} ${center - axisHalf} Q ${center + verticalBow} ${center} ${center} ${center + axisHalf}`;
  const horizontalBackPath = `M ${center - axisHalf} ${center} Q ${center} ${center - horizontalBow * 0.55} ${center + axisHalf} ${center}`;
  const verticalBackPath = `M ${center} ${center - axisHalf} Q ${center - verticalBow * 0.55} ${center} ${center} ${center + axisHalf}`;

  const updateFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nextRotationRatio = clamp((x - rect.width / 2) / (rect.width * 0.34), -1, 1);
    const nextPitchRatio = clamp((rect.height / 2 - y) / (rect.height * 0.34), -1, 1);
    const nextRotation = Math.round((nextRotationRatio * 180) / 5) * 5;
    const nextPitch = Math.round(nextPitchRatio * 30);
    onAngleChange(nextRotation, nextPitch);
  };

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground-muted">Camera shift</span>
        <span className="font-mono text-foreground-secondary">{formatAngleSummary(rotation, pitch)}</span>
      </div>

      <div className="mt-3 flex flex-col items-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="cursor-crosshair touch-none text-foreground-muted"
          role="img"
          aria-label={`Camera axis preview, current view at zero zero, target ${formatRotation(rotation)} and ${formatTilt(pitch)}`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) updateFromPointer(event);
          }}
        >
          <rect x="0" y="0" width={size} height={size} rx="12" fill="transparent" />
          <g stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" strokeLinecap="round">
            <line x1={center - axisHalf} y1={center} x2={center + axisHalf} y2={center} />
            <line x1={center} y1={center - axisHalf} x2={center} y2={center + axisHalf} />
          </g>
          <g transform={`rotate(${frameRotation} ${center} ${center})`} fill="none" stroke="currentColor" strokeLinecap="round">
            {secondaryAxisOpacity > 0 && (
              <>
                <path d={horizontalBackPath} strokeOpacity={secondaryAxisOpacity} strokeWidth="1.2" strokeDasharray="2 5" />
                <path d={verticalBackPath} strokeOpacity={secondaryAxisOpacity * 0.8} strokeWidth="1.2" strokeDasharray="2 5" />
              </>
            )}
            <path d={horizontalAxisPath} strokeOpacity="0.56" strokeWidth="2" />
            <path d={verticalAxisPath} strokeOpacity="0.56" strokeWidth="2" />
          </g>
          <g transform={`rotate(${frameRotation} ${center} ${center})`} stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" strokeLinecap="round">
            <line x1={center - axisHalf} y1={center - 4} x2={center - axisHalf} y2={center + 4} />
            <line x1={center + axisHalf} y1={center - 4} x2={center + axisHalf} y2={center + 4} />
            <line x1={center - 4} y1={center - axisHalf} x2={center + 4} y2={center - axisHalf} />
            <line x1={center - 4} y1={center + axisHalf} x2={center + 4} y2={center + axisHalf} />
          </g>
          {hasTargetOffset && (
            <>
              <line x1={center} y1={center} x2={target.x} y2={target.y} stroke="currentColor" strokeOpacity="0.64" strokeWidth="2" strokeLinecap="round" />
              <line x1={target.x} y1={center} x2={target.x} y2={target.y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 4" />
              <line x1={center} y1={target.y} x2={target.x} y2={target.y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 4" />
            </>
          )}
          <circle cx={center} cy={center} r="6.5" className="fill-foreground" />
          <circle cx={center} cy={center} r="11" fill="none" className="stroke-foreground" strokeOpacity="0.18" strokeWidth="1.5" />
          {hasTargetOffset && (
            <>
              <circle cx={target.x} cy={target.y} r="7" fill="none" stroke="currentColor" strokeOpacity="0.48" strokeWidth="2" />
              <circle cx={target.x} cy={target.y} r="3.5" fill="currentColor" opacity="0.72" />
            </>
          )}
          <text x={center} y={neutralLabelY} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.56">current 0 / 0</text>
          {hasTargetOffset && (
            <text x={target.x} y={target.y - 12} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.72">new</text>
          )}
          <text x={center - axisHalf - 7} y={center + 4} textAnchor="end" fontSize="8" fill="currentColor" opacity="0.36">L</text>
          <text x={center + axisHalf + 7} y={center + 4} textAnchor="start" fontSize="8" fill="currentColor" opacity="0.36">R</text>
          <text x={center} y={center - axisHalf - 8} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.36">up</text>
          <text x={center} y={center + axisHalf + 15} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.36">down</text>
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
