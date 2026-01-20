import React, { useCallback, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import * as Switch from '@radix-ui/react-switch';
import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../../../store';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { SectionHeader, StyleGrid } from './SharedLeftComponents';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { cn } from '../../../lib/utils';

const materialPalettes = [
  'Concrete & Glass',
  'Wood & Brick',
  'Stone & Metal',
  'Plaster & Timber',
  'Corten & Concrete',
  'Brick & Glass',
];

const moodPresets = [
  { id: 'soft-daylight', label: 'Soft Daylight' },
  { id: 'golden-hour', label: 'Golden Hour' },
  { id: 'overcast', label: 'Overcast' },
  { id: 'moody', label: 'Moody' },
  { id: 'night', label: 'Night' },
  { id: 'studio', label: 'Studio' },
];

const formatPerspectiveLabel = (value: string | null) => {
  if (!value) return 'Not detected';
  const label = value.replace('-', ' ');
  return label
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const SketchToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-elevated px-3 py-2">
    <button
      type="button"
      className="flex-1 min-w-0 text-left text-xs text-foreground-secondary leading-snug"
      onClick={() => onChange(!checked)}
    >
      {label}
    </button>
    <Switch.Root
      className={cn(
        'w-[44px] h-[24px] rounded-full relative shadow-inner-subtle transition-colors duration-200 ease-in-out',
        checked ? 'bg-foreground' : 'bg-border-strong'
      )}
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
    >
      <Switch.Thumb
        className={cn(
          'block w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out absolute top-[2px] left-[2px]',
          checked ? 'translate-x-[20px]' : 'translate-x-0'
        )}
      />
    </Switch.Root>
  </div>
);

export const LeftSketchPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);

  const availableStyles = useMemo(
    () => [...BUILT_IN_STYLES, ...state.customStyles],
    [state.customStyles]
  );

  const activeStyleLabel = useMemo(() => {
    const activeStyle = availableStyles.find((style) => style.id === state.activeStyleId);
    return activeStyle
      ? activeStyle.name
      : state.activeStyleId
          .split('-')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');
  }, [availableStyles, state.activeStyleId]);

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch]
  );

  const handleAddReference = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReferenceUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const nextRef = { id: nanoid(), url, type: wf.sketchRefType };
      updateWf({ sketchRefs: [...wf.sketchRefs, nextRef] });
      event.target.value = '';
    },
    [updateWf, wf.sketchRefType, wf.sketchRefs]
  );

  const handleRemoveReference = useCallback(
    (id: string) => {
      updateWf({ sketchRefs: wf.sketchRefs.filter((ref) => ref.id !== id) });
    },
    [updateWf, wf.sketchRefs]
  );

  const vanishingPoints = wf.sketchVanishingPoints || [];

  return (
    <div className="space-y-6">
      <StyleBrowserDialog
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        activeStyleId={state.activeStyleId}
        onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })}
        styles={availableStyles}
        onAddStyle={(style) => dispatch({ type: 'ADD_CUSTOM_STYLE', payload: style })}
      />

      <div>
        <SectionHeader title="Sketch Analysis" />
        <div className="space-y-4">
          <button
            type="button"
            className={cn(
              'w-full h-9 rounded-md border text-xs font-medium transition-all',
              wf.sketchAutoDetect
                ? 'border-accent bg-accent/10 text-foreground shadow-sm'
                : 'border-border text-foreground-muted hover:text-foreground hover:border-foreground/40'
            )}
            onClick={() => updateWf({ sketchAutoDetect: !wf.sketchAutoDetect })}
          >
            Auto-detect Analysis {wf.sketchAutoDetect ? 'On' : 'Off'}
          </button>
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Sketch Type</label>
            <SegmentedControl
              value={wf.sketchType}
              options={[
                { label: <span className="w-full text-center">Exterior</span>, value: 'exterior' },
                { label: <span className="w-full text-center">Interior</span>, value: 'interior' },
                { label: <span className="w-full text-center">Detail</span>, value: 'detail' },
                { label: <span className="w-full text-center">Aerial</span>, value: 'aerial' },
              ]}
              onChange={(value) => updateWf({ sketchType: value as any })}
            />
          </div>

          <div className="rounded-lg border border-border bg-surface-elevated p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground-muted">Detected Perspective</span>
              <span className="font-medium text-foreground">{formatPerspectiveLabel(wf.sketchDetectedPerspective)}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-muted">Line Quality</span>
                <span className="font-medium text-foreground">{wf.sketchLineQuality}%</span>
              </div>
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${wf.sketchLineQuality}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-muted">Completeness</span>
                <span className="font-medium text-foreground">{wf.sketchCompleteness}%</span>
              </div>
              <div className="h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${wf.sketchCompleteness}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Line Processing" />
        <div className="space-y-3">
          <Slider
            label="Cleanup Intensity"
            value={wf.sketchCleanupIntensity}
            min={0}
            max={100}
            onChange={(value) => updateWf({ sketchCleanupIntensity: value })}
          />
          <div className="space-y-2">
            <SketchToggle
              label="Enhance Faint Lines"
              checked={wf.sketchEnhanceFaint}
              onChange={(value) => updateWf({ sketchEnhanceFaint: value })}
            />
            <SketchToggle
              label="Connect Broken Lines"
              checked={wf.sketchConnectLines}
              onChange={(value) => updateWf({ sketchConnectLines: value })}
            />
            <SketchToggle
              label="Straighten Wobbly Lines"
              checked={wf.sketchStraighten}
              onChange={(value) => updateWf({ sketchStraighten: value })}
            />
            <SketchToggle
              label="Remove Construction Lines"
              checked={wf.sketchRemoveConstruction}
              onChange={(value) => updateWf({ sketchRemoveConstruction: value })}
            />
          </div>
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Line Weight</label>
            <SegmentedControl
              value={wf.sketchLineWeight}
              options={[
                { label: 'Thin', value: 'thin' },
                { label: 'Medium', value: 'medium' },
                { label: 'Thick', value: 'thick' },
                { label: 'Vary', value: 'vary' },
              ]}
              onChange={(value) => updateWf({ sketchLineWeight: value as any })}
            />
          </div>
          <SketchToggle
            label="Perspective Correction"
            checked={wf.sketchPerspectiveCorrect}
            onChange={(value) => updateWf({ sketchPerspectiveCorrect: value })}
          />
          {wf.sketchPerspectiveCorrect && (
            <div className="space-y-2 rounded-lg border border-border bg-surface-elevated p-3">
              <Slider
                label="Correction Strength"
                value={wf.sketchPerspectiveStrength}
                min={0}
                max={100}
                onChange={(value) => updateWf({ sketchPerspectiveStrength: value })}
              />
              <SketchToggle
                label="Fix Vertical Lines"
                checked={wf.sketchFixVerticals}
                onChange={(value) => updateWf({ sketchFixVerticals: value })}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionHeader title="View & Perspective" />
        <div className="space-y-3">
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Perspective Type</label>
            <select
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
              value={wf.sketchPerspectiveType}
              onChange={(event) => updateWf({ sketchPerspectiveType: event.target.value as any })}
            >
              <option value="1-point">1-point</option>
              <option value="2-point">2-point</option>
              <option value="3-point">3-point</option>
              <option value="isometric">Isometric</option>
              <option value="axonometric">Axonometric</option>
              <option value="freehand">Freehand</option>
            </select>
          </div>
          <Slider
            label="Horizon Position"
            value={wf.sketchHorizonLine}
            min={0}
            max={100}
            onChange={(value) => updateWf({ sketchHorizonLine: value })}
          />
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Camera Height</label>
            <SegmentedControl
              value={wf.sketchCameraHeight}
              options={[
                { label: 'Ground', value: 'ground' },
                { label: 'Eye', value: 'eye' },
                { label: 'Elevated', value: 'elevated' },
                { label: 'Aerial', value: 'aerial' },
              ]}
              onChange={(value) => updateWf({ sketchCameraHeight: value as any })}
            />
          </div>
          <div className="rounded-lg border border-border bg-surface-elevated p-3">
            <div className="text-[10px] text-foreground-muted mb-2">Vanishing Points</div>
            {vanishingPoints.length === 0 ? (
              <div className="text-xs text-foreground-muted">None detected yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2 text-[10px]">
                {vanishingPoints.map((point, index) => (
                  <span key={`${point.x}-${point.y}-${index}`} className="px-2 py-1 rounded bg-surface-sunken border border-border">
                    VP{index + 1}: {Math.round(point.x)}, {Math.round(point.y)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Interpretation Control" />
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[10px] text-foreground-muted mb-1">
              <span>Faithful</span>
              <span>Creative</span>
            </div>
            <Slider
              value={wf.sketchInterpretation}
              min={0}
              max={100}
              onChange={(value) => updateWf({ sketchInterpretation: value })}
            />
          </div>
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-foreground-muted">Preserve Strictly</div>
            <div className="space-y-2">
              <SketchToggle
                label="Building Outline"
                checked={wf.sketchPreserveOutline}
                onChange={(value) => updateWf({ sketchPreserveOutline: value })}
              />
              <SketchToggle
                label="Window/Door Positions"
                checked={wf.sketchPreserveOpenings}
                onChange={(value) => updateWf({ sketchPreserveOpenings: value })}
              />
              <SketchToggle
                label="Roof Shape"
                checked={wf.sketchPreserveRoof}
                onChange={(value) => updateWf({ sketchPreserveRoof: value })}
              />
              <SketchToggle
                label="Floor Levels"
                checked={wf.sketchPreserveFloors}
                onChange={(value) => updateWf({ sketchPreserveFloors: value })}
              />
              <SketchToggle
                label="Proportions & Scale"
                checked={wf.sketchPreserveProportions}
                onChange={(value) => updateWf({ sketchPreserveProportions: value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-foreground-muted">Allow Variation</div>
            <div className="space-y-2">
              <SketchToggle
                label="Add Architectural Details"
                checked={wf.sketchAllowDetails}
                onChange={(value) => updateWf({ sketchAllowDetails: value })}
              />
              <SketchToggle
                label="Interpret Materials"
                checked={wf.sketchAllowMaterials}
                onChange={(value) => updateWf({ sketchAllowMaterials: value })}
              />
              <SketchToggle
                label="Add Entourage"
                checked={wf.sketchAllowEntourage}
                onChange={(value) => updateWf({ sketchAllowEntourage: value })}
              />
              <SketchToggle
                label="Extend Beyond Bounds"
                checked={wf.sketchAllowExtend}
                onChange={(value) => updateWf({ sketchAllowExtend: value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Ambiguity Handling</label>
            <select
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
              value={wf.sketchAmbiguityMode}
              onChange={(event) => updateWf({ sketchAmbiguityMode: event.target.value as any })}
            >
              <option value="ask">Highlight</option>
              <option value="conservative">Conservative</option>
              <option value="creative">Creative</option>
              <option value="typical">Typical</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader title="Style Selection" />
          <span className="text-[9px] text-foreground-muted font-mono">{activeStyleLabel}</span>
        </div>
        <StyleGrid
          activeId={state.activeStyleId}
          onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })}
          onBrowse={() => setIsBrowserOpen(true)}
          styles={availableStyles}
        />
      </div>

      <div>
        <SectionHeader title="Reference Images" />
        <div className="space-y-3">
          <Slider
            label="Reference Influence"
            value={wf.sketchRefInfluence}
            min={0}
            max={100}
            onChange={(value) => updateWf({ sketchRefInfluence: value })}
          />
          <div>
            <label className="text-xs text-foreground-muted mb-2 block">Reference Type</label>
            <SegmentedControl
              value={wf.sketchRefType}
              options={[
                { label: 'Style', value: 'style' },
                { label: 'Material', value: 'material' },
                { label: 'Mood', value: 'mood' },
              ]}
              onChange={(value) => updateWf({ sketchRefType: value as any })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {wf.sketchRefs.map((ref) => (
              <div key={ref.id} className="group relative rounded-lg border border-border overflow-hidden bg-surface-elevated aspect-[4/3]">
                <img src={ref.url} alt="" className="h-full w-full object-cover" />
                <div className="absolute top-1 left-1 text-[9px] uppercase tracking-wide bg-black/60 text-white px-1.5 py-0.5 rounded">
                  {ref.type}
                </div>
                <button
                  type="button"
                  className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveReference(ref.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="aspect-[4/3] rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-colors"
              onClick={handleAddReference}
            >
              <Plus size={16} />
              <span className="text-[10px]">Add</span>
            </button>
          </div>

          {wf.sketchRefType === 'material' && (
            <div>
              <label className="text-xs text-foreground-muted mb-2 block">Material Palette</label>
              <select
                className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
                value={wf.sketchMaterialPalette}
                onChange={(event) => updateWf({ sketchMaterialPalette: event.target.value })}
              >
                {materialPalettes.map((palette) => (
                  <option key={palette} value={palette}>
                    {palette}
                  </option>
                ))}
              </select>
            </div>
          )}

          {wf.sketchRefType === 'mood' && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-foreground-muted">Mood Preset</div>
              <div className="grid grid-cols-3 gap-2">
                {moodPresets.map((preset) => {
                  const selected = wf.sketchMoodPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={cn(
                        'rounded-lg border px-2 py-2 text-[10px] font-medium transition-all',
                        selected ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-foreground/40'
                      )}
                      onClick={() => updateWf({ sketchMoodPreset: preset.id })}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleReferenceUpload}
        />
      </div>
    </div>
  );
};
