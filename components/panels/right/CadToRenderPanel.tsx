
import React from 'react';
import { useAppStore } from '../../../store';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';
import { Render3DPanel } from './Render3DPanel';
import { VerticalCard } from './SharedRightComponents';

export const CadToRenderPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const updateWf = (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload });
  const cadCamera = wf.cadCamera;
  const cadFurnishing = wf.cadFurnishing;
  const cadContext = wf.cadContext;
  const generationModes = [
    { id: 'enhance', label: 'Enhance', desc: 'Improves lighting and textures while keeping geometry.' },
    { id: 'stylize', label: 'Stylize', desc: 'Applies artistic styles to the base model.' },
    { id: 'hybrid', label: 'Hybrid', desc: 'Balances structural accuracy with creative details.' },
    { id: 'strict-realism', label: 'Strict Realism', desc: 'Photographic accuracy, minimal hallucination.' },
    { id: 'concept-push', label: 'Concept Push', desc: 'High creativity, explores new forms.' },
  ];

  const directionOptions = [
    { value: 'n', label: 'N' },
    { value: 'ne', label: 'NE' },
    { value: 'e', label: 'E' },
    { value: 'se', label: 'SE' },
    { value: 's', label: 'S' },
    { value: 'sw', label: 'SW' },
    { value: 'w', label: 'W' },
    { value: 'nw', label: 'NW' },
  ];

  const handleCameraPositionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    updateWf({ cadCamera: { ...cadCamera, position: { x, y } } });
  };


  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
          Generation Mode
        </label>
        <div className="space-y-1">
          {generationModes.map((mode) => (
            <VerticalCard
              key={mode.id}
              label={mode.label}
              description={mode.desc}
              selected={wf.renderMode === mode.id}
              onClick={() => updateWf({ renderMode: mode.id as any })}
            />
          ))}
        </div>
      </div>
      <Accordion
        items={[
          {
            id: 'camera',
            title: 'Camera and Viewpoint',
            content: (
              <div className="space-y-4">
                <Slider
                  label="Camera Height (m)"
                  value={cadCamera.height}
                  min={0.8}
                  max={5}
                  step={0.05}
                  onChange={(value) => updateWf({ cadCamera: { ...cadCamera, height: value } })}
                />
                <Slider
                  label="Focal Length (mm)"
                  value={cadCamera.focalLength}
                  min={24}
                  max={85}
                  step={1}
                  onChange={(value) => updateWf({ cadCamera: { ...cadCamera, focalLength: value } })}
                />

                <div className="space-y-2">
                  <label className="text-xs text-foreground-muted block">Camera Position Picker</label>
                  <div
                    className="relative h-28 rounded border border-border bg-surface-sunken cursor-crosshair"
                    onClick={handleCameraPositionClick}
                  >
                    <div className="absolute left-1/2 top-0 h-full w-px bg-border-subtle/70" />
                    <div className="absolute top-1/2 left-0 w-full h-px bg-border-subtle/70" />
                    <div
                      className="absolute w-2.5 h-2.5 rounded-full bg-accent shadow-sm"
                      style={{
                        left: `calc(${cadCamera.position.x}% - 5px)`,
                        top: `calc(${cadCamera.position.y}% - 5px)`,
                      }}
                    />
                  </div>
                  <p className="text-[9px] text-foreground-muted">
                    Click on the plan to place the camera.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-foreground-muted block">Look-at Direction</label>
                  <div className="grid grid-cols-4 gap-1">
                    {directionOptions.map((direction) => (
                      <button
                        key={direction.value}
                        className={cn(
                          "py-1 rounded border text-[9px] font-medium transition-colors",
                          cadCamera.lookAt === direction.value
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted"
                        )}
                        onClick={() => updateWf({ cadCamera: { ...cadCamera, lookAt: direction.value } })}
                      >
                        {direction.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Toggle
                  label="Vertical Correction"
                  checked={cadCamera.verticalCorrection}
                  onChange={(value) => updateWf({ cadCamera: { ...cadCamera, verticalCorrection: value } })}
                />
              </div>
            ),
          },
          {
            id: 'furnishing',
            title: 'Furnishing',
            content: (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Occupancy Feel</label>
                  <SegmentedControl
                    value={cadFurnishing.occupancy}
                    options={[
                      { label: 'Empty', value: 'empty' },
                      { label: 'Staged', value: 'staged' },
                      { label: 'Lived-in', value: 'lived-in' },
                    ]}
                    onChange={(value) => updateWf({ cadFurnishing: { ...cadFurnishing, occupancy: value } })}
                  />
                </div>

                <Slider
                  label="Clutter Level"
                  value={cadFurnishing.clutter}
                  min={0}
                  max={100}
                  onChange={(value) => updateWf({ cadFurnishing: { ...cadFurnishing, clutter: value } })}
                />

                <div className="space-y-2">
                  <Toggle
                    label="People / Entourage"
                    checked={cadFurnishing.people}
                    onChange={(value) => updateWf({ cadFurnishing: { ...cadFurnishing, people: value } })}
                  />
                  {cadFurnishing.people && (
                    <div className="pl-2 border-l-2 border-border-subtle">
                      <Slider
                        label="Entourage Level"
                        value={cadFurnishing.entourage}
                        min={0}
                        max={50}
                        onChange={(value) => updateWf({ cadFurnishing: { ...cadFurnishing, entourage: value } })}
                      />
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            id: 'context',
            title: 'Context (Exterior Views)',
            content: (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Landscape Style</label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={cadContext.landscape}
                    onChange={(e) => updateWf({ cadContext: { ...cadContext, landscape: e.target.value as any } })}
                  >
                    <option value="garden">Formal Garden</option>
                    <option value="native">Native Planting</option>
                    <option value="minimal">Minimal</option>
                    <option value="tropical">Lush Tropical</option>
                    <option value="xeriscape">Dry Xeriscape</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Environment</label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={cadContext.environment}
                    onChange={(e) => updateWf({ cadContext: { ...cadContext, environment: e.target.value as any } })}
                  >
                    <option value="urban">Urban</option>
                    <option value="suburban">Suburban</option>
                    <option value="rural">Rural</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Season</label>
                  <SegmentedControl
                    value={cadContext.season}
                    options={[
                      { label: 'Spring', value: 'spring' },
                      { label: 'Summer', value: 'summer' },
                      { label: 'Autumn', value: 'autumn' },
                      { label: 'Winter', value: 'winter' },
                    ]}
                    onChange={(value) => updateWf({ cadContext: { ...cadContext, season: value as any } })}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />
      <Render3DPanel showGenerationMode={false} includeCamera={false} />
    </div>
  );
};
