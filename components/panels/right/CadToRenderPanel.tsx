
import React, { useState } from 'react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';
import { Render3DPanel } from './Render3DPanel';

export const CadToRenderPanel = () => {
  const [settings, setSettings] = useState({
    camera: {
      height: 1.6,
      focalLength: 35,
      position: { x: 50, y: 50 },
      lookAt: 'n',
      verticalCorrection: true,
    },
    furnishing: {
      occupancy: 'staged',
      clutter: 35,
      people: false,
      entourage: 10,
    },
    context: {
      landscape: 'garden',
      environment: 'urban',
      season: 'summer',
    },
  });

  const updateSection = (section: keyof typeof settings, updates: any) => {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...updates } }));
  };

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
    updateSection('camera', { position: { x, y } });
  };


  return (
    <div className="space-y-6">
      <Accordion
        items={[
          {
            id: 'camera',
            title: 'Camera and Viewpoint',
            content: (
              <div className="space-y-4">
                <Slider
                  label="Camera Height (m)"
                  value={settings.camera.height}
                  min={0.8}
                  max={5}
                  step={0.05}
                  onChange={(value) => updateSection('camera', { height: value })}
                />
                <Slider
                  label="Focal Length (mm)"
                  value={settings.camera.focalLength}
                  min={24}
                  max={85}
                  step={1}
                  onChange={(value) => updateSection('camera', { focalLength: value })}
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
                        left: `calc(${settings.camera.position.x}% - 5px)`,
                        top: `calc(${settings.camera.position.y}% - 5px)`,
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
                          settings.camera.lookAt === direction.value
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted"
                        )}
                        onClick={() => updateSection('camera', { lookAt: direction.value })}
                      >
                        {direction.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Toggle
                  label="Vertical Correction"
                  checked={settings.camera.verticalCorrection}
                  onChange={(value) => updateSection('camera', { verticalCorrection: value })}
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
                    value={settings.furnishing.occupancy}
                    options={[
                      { label: 'Empty', value: 'empty' },
                      { label: 'Staged', value: 'staged' },
                      { label: 'Lived-in', value: 'lived-in' },
                    ]}
                    onChange={(value) => updateSection('furnishing', { occupancy: value })}
                  />
                </div>

                <Slider
                  label="Clutter Level"
                  value={settings.furnishing.clutter}
                  min={0}
                  max={100}
                  onChange={(value) => updateSection('furnishing', { clutter: value })}
                />

                <div className="space-y-2">
                  <Toggle
                    label="People / Entourage"
                    checked={settings.furnishing.people}
                    onChange={(value) => updateSection('furnishing', { people: value })}
                  />
                  {settings.furnishing.people && (
                    <div className="pl-2 border-l-2 border-border-subtle">
                      <Slider
                        label="Entourage Level"
                        value={settings.furnishing.entourage}
                        min={0}
                        max={50}
                        onChange={(value) => updateSection('furnishing', { entourage: value })}
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
                    value={settings.context.landscape}
                    onChange={(e) => updateSection('context', { landscape: e.target.value })}
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
                    value={settings.context.environment}
                    onChange={(e) => updateSection('context', { environment: e.target.value })}
                  >
                    <option value="urban">Urban</option>
                    <option value="suburban">Suburban</option>
                    <option value="rural">Rural</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Season</label>
                  <SegmentedControl
                    value={settings.context.season}
                    options={[
                      { label: 'Spring', value: 'spring' },
                      { label: 'Summer', value: 'summer' },
                      { label: 'Autumn', value: 'autumn' },
                      { label: 'Winter', value: 'winter' },
                    ]}
                    onChange={(value) => updateSection('context', { season: value })}
                  />
                </div>
              </div>
            ),
          },
        ]}
        defaultValue="camera"
      />
      <Render3DPanel showGenerationMode={false} includeCamera={false} />
    </div>
  );
};
