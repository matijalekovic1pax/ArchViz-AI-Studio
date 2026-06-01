import React, { useCallback } from 'react';
import { ArrowDown, ArrowUp, Camera, RotateCcw, RotateCw, ScanEye } from 'lucide-react';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Toggle } from '../../ui/Toggle';
import { cn } from '../../../lib/utils';
import type { WorkflowSettings } from '../../../types';

type AngleDirection = WorkflowSettings['angleChangeDirection'];
type SceneType = WorkflowSettings['angleChangeSceneType'];

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

const SCENE_TYPES: Array<{ id: SceneType; label: string; description: string }> = [
  { id: 'auto', label: 'Auto', description: 'Infer source type' },
  { id: 'interior', label: 'Room', description: 'Interior POV' },
  { id: 'exterior', label: 'Building', description: 'Exterior camera' },
  { id: 'object', label: 'Object', description: 'Object orbit' },
];

const formatRotation = (degrees: number) => {
  if (degrees === 0) return '0°';
  if (Math.abs(degrees) === 180) return '180°';
  return `${Math.abs(degrees)}° ${degrees < 0 ? 'left' : 'right'}`;
};

const AngleOrbitPreview: React.FC<{ rotation: number; pitch: number }> = ({ rotation, pitch }) => {
  const radius = 48;
  const center = 64;
  const startAngle = -90;
  const targetAngle = startAngle + clamp(rotation, -180, 180);
  const targetRad = (targetAngle * Math.PI) / 180;
  const sourceRad = (startAngle * Math.PI) / 180;
  const source = {
    x: center + radius * Math.cos(sourceRad),
    y: center + radius * Math.sin(sourceRad),
  };
  const target = {
    x: center + radius * Math.cos(targetRad),
    y: center + radius * Math.sin(targetRad),
  };
  const pitchIcon = pitch > 0 ? ArrowUp : pitch < 0 ? ArrowDown : Camera;
  const PitchIcon = pitchIcon;

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground-muted">Camera shift</span>
        <span className="font-mono text-foreground-secondary">{formatRotation(rotation)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <svg width={128} height={128} viewBox="0 0 128 128" className="shrink-0 text-foreground-muted">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={2} />
          <rect x={42} y={45} width={44} height={38} rx={4} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeOpacity={0.25} />
          <path d="M49 56h30M49 67h30" stroke="currentColor" strokeOpacity={0.18} strokeWidth={2} strokeLinecap="round" />
          <circle cx={source.x} cy={source.y} r={5} fill="currentColor" fillOpacity={0.35} />
          <circle cx={target.x} cy={target.y} r={7} fill="currentColor" />
          <line x1={center} y1={center} x2={target.x} y2={target.y} stroke="currentColor" strokeOpacity={0.42} strokeWidth={2} strokeLinecap="round" />
          <text x={source.x} y={source.y - 10} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.55">src</text>
          <text x={target.x} y={target.y + 18} textAnchor="middle" fontSize="9" fill="currentColor">new</text>
        </svg>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="rounded-md bg-surface-sunken px-2.5 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Rotation</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{formatRotation(rotation)}</div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-surface-sunken px-2.5 py-2">
            <PitchIcon size={14} className="shrink-0 text-foreground-secondary" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Tilt</div>
              <div className="text-xs text-foreground-secondary">
                {pitch === 0 ? 'Same horizon' : `${Math.abs(pitch)}° ${pitch > 0 ? 'up' : 'down'}`}
              </div>
            </div>
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
        <AngleOrbitPreview rotation={wf.angleChangeDegrees} pitch={wf.angleChangePitch} />
      </div>

      <div className="space-y-3">
        <label className="text-xs text-foreground-muted block font-bold uppercase tracking-wider">Camera Controls</label>
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
          min={-20}
          max={20}
          step={1}
          value={wf.angleChangePitch}
          onChange={(value) => updateWf({ angleChangePitch: clamp(Math.round(value), -20, 20) })}
        />
        <div>
          <label className="mb-2 block text-xs text-foreground-muted">Lens</label>
          <SegmentedControl
            value={wf.angleChangeLens}
            options={[
              { label: 'Match', value: 'match' },
              { label: 'Wide', value: 'wide' },
              { label: 'Normal', value: 'normal' },
              { label: 'Tight', value: 'telephoto' },
            ]}
            onChange={(value) => updateWf({ angleChangeLens: value })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs text-foreground-muted block font-bold uppercase tracking-wider">Source Type</label>
        <div className="grid grid-cols-2 gap-2">
          {SCENE_TYPES.map((item) => {
            const selected = wf.angleChangeSceneType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateWf({ angleChangeSceneType: item.id })}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  selected
                    ? "border-foreground bg-surface-sunken text-foreground"
                    : "border-border bg-surface-elevated text-foreground-secondary hover:border-foreground/40"
                )}
              >
                <div className="text-xs font-semibold">{item.label}</div>
                <div className="mt-1 text-[10px] leading-snug text-foreground-muted">{item.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs text-foreground-muted block font-bold uppercase tracking-wider">Fidelity</label>
        <Toggle
          label="Preserve lighting"
          checked={wf.angleChangePreserveLighting}
          onChange={(value) => updateWf({ angleChangePreserveLighting: value })}
        />
        <Toggle
          label="Preserve framing"
          checked={wf.angleChangePreserveFraming}
          onChange={(value) => updateWf({ angleChangePreserveFraming: value })}
        />
        <div>
          <label className="mb-2 block text-xs text-foreground-muted">Hidden side inference</label>
          <SegmentedControl
            value={wf.angleChangeInferHidden}
            options={[
              { label: 'Safe', value: 'conservative' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Creative', value: 'creative' },
            ]}
            onChange={(value) => updateWf({ angleChangeInferHidden: value })}
          />
        </div>
        <p className="rounded-lg bg-surface-sunken px-3 py-2 text-[10px] leading-relaxed text-foreground-muted">
          Uses the current canvas image as the source and generates one clean camera-shifted view.
        </p>
      </div>
    </div>
  );
};
