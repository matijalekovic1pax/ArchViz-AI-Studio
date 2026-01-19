import React, { useCallback } from 'react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Slider } from '../../ui/Slider';
import { ColorPicker } from './SharedRightComponents';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../store';

const buildStylePreview = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const dissectionStyles = [
  {
    id: 'stacked',
    label: 'Stacked Layers',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f5f4f1"/>
        <g fill="#c9d2db">
          <rect x="26" y="90" width="188" height="14" rx="3"/>
          <rect x="32" y="70" width="176" height="14" rx="3"/>
          <rect x="38" y="50" width="164" height="14" rx="3"/>
          <rect x="44" y="30" width="152" height="14" rx="3"/>
        </g>
      </svg>`
    ),
  },
  {
    id: 'radial',
    label: 'Radial Burst',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#eef3f7"/>
        <circle cx="120" cy="70" r="20" fill="#b8c9dd"/>
        <g stroke="#7892b0" stroke-width="6" stroke-linecap="round">
          <line x1="120" y1="20" x2="120" y2="44"/>
          <line x1="120" y1="96" x2="120" y2="120"/>
          <line x1="70" y1="70" x2="94" y2="70"/>
          <line x1="146" y1="70" x2="170" y2="70"/>
          <line x1="85" y1="35" x2="102" y2="52"/>
          <line x1="155" y1="88" x2="172" y2="105"/>
          <line x1="85" y1="105" x2="102" y2="88"/>
          <line x1="155" y1="52" x2="172" y2="35"/>
        </g>
      </svg>`
    ),
  },
  {
    id: 'sequential',
    label: 'Sequential Peel',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f8f1e6"/>
        <g fill="#e1caa5">
          <rect x="30" y="78" width="150" height="16" rx="3"/>
          <rect x="42" y="58" width="150" height="16" rx="3"/>
          <rect x="54" y="38" width="150" height="16" rx="3"/>
          <rect x="66" y="18" width="150" height="16" rx="3"/>
        </g>
      </svg>`
    ),
  },
  {
    id: 'core-shell',
    label: 'Core + Shell',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#eef1f4"/>
        <rect x="34" y="20" width="172" height="100" rx="6" fill="none" stroke="#9fb1c7" stroke-width="6"/>
        <rect x="92" y="48" width="56" height="44" rx="4" fill="#9fb1c7"/>
      </svg>`
    ),
  },
  {
    id: 'slice',
    label: 'Slice & Lift',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f4f4f4"/>
        <g fill="#cfcfcf">
          <rect x="28" y="76" width="184" height="18" rx="3"/>
          <rect x="40" y="50" width="184" height="18" rx="3"/>
          <rect x="52" y="24" width="184" height="18" rx="3"/>
        </g>
      </svg>`
    ),
  },
  {
    id: 'systems',
    label: 'System Focus',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#eef6f0"/>
        <rect x="36" y="28" width="168" height="84" rx="8" fill="#e2ece6" stroke="#b4c9bb" stroke-width="2"/>
        <g stroke-width="6" stroke-linecap="round">
          <line x1="56" y1="50" x2="184" y2="50" stroke="#4A90D9"/>
          <line x1="56" y1="70" x2="184" y2="70" stroke="#7ED321"/>
          <line x1="56" y1="90" x2="184" y2="90" stroke="#F5A623"/>
        </g>
      </svg>`
    ),
  },
];

export const ExplodedPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch, wf]
  );

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">View</label>
        <div className="space-y-3">
          <SegmentedControl
            value={wf.explodedView.type}
            options={[
              { label: 'Axonometric', value: 'axon' },
              { label: 'Perspective', value: 'perspective' },
            ]}
            onChange={(value) => updateWf({ explodedView: { ...wf.explodedView, type: value as any } })}
          />

          {wf.explodedView.type === 'axon' ? (
            <div>
              <label className="text-[10px] text-foreground-muted mb-1 block">Angle</label>
              <SegmentedControl
                value={wf.explodedView.angle}
                options={[
                  { label: 'ISO NE', value: 'iso-ne' },
                  { label: 'ISO NW', value: 'iso-nw' },
                  { label: 'ISO SE', value: 'iso-se' },
                  { label: 'ISO SW', value: 'iso-sw' },
                ]}
                onChange={(value) => updateWf({ explodedView: { ...wf.explodedView, angle: value as any } })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Slider
                label="Camera Height (m)"
                value={wf.explodedView.cameraHeight}
                min={0.5}
                max={10}
                step={0.1}
                onChange={(value) => updateWf({ explodedView: { ...wf.explodedView, cameraHeight: value } })}
              />
              <Slider
                label="Field of View (deg)"
                value={wf.explodedView.fov}
                min={20}
                max={100}
                onChange={(value) => updateWf({ explodedView: { ...wf.explodedView, fov: value } })}
              />
              <div>
                <label className="text-[10px] text-foreground-muted mb-1 block">Look At</label>
                <select
                  className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                  value={wf.explodedView.lookAt}
                  onChange={(e) => updateWf({ explodedView: { ...wf.explodedView, lookAt: e.target.value as any } })}
                >
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <Accordion
        items={[
          {
            id: 'render-style',
            title: 'Dissection Style',
            content: (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {dissectionStyles.map((style) => {
                    const selected = wf.explodedStyle.render === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => updateWf({ explodedStyle: { ...wf.explodedStyle, render: style.id as any } })}
                        className={cn(
                          'rounded-lg border p-2 text-[10px] font-medium transition-all',
                          selected ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-foreground/40'
                        )}
                      >
                        <div className="relative rounded-md h-12 w-full mb-2 border border-border overflow-hidden bg-white">
                          <img src={style.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-center">{style.label}</div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Color Mode</label>
                  <SegmentedControl
                    value={wf.explodedStyle.colorMode}
                    options={[
                      { label: 'Material Colors', value: 'material' },
                      { label: 'System Colors', value: 'system' },
                      { label: 'Monochrome', value: 'mono' },
                    ]}
                    onChange={(value) => updateWf({ explodedStyle: { ...wf.explodedStyle, colorMode: value as any } })}
                  />
                </div>

                {wf.explodedStyle.colorMode === 'system' && (
                  <div className="space-y-2">
                    {[
                      { key: 'structure', label: 'Structure' },
                      { key: 'envelope', label: 'Envelope' },
                      { key: 'mep', label: 'MEP' },
                      { key: 'interior', label: 'Interior' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <span className="text-xs text-foreground">{item.label}</span>
                        <ColorPicker
                          color={wf.explodedStyle.systemColors[item.key]}
                          onChange={(color) =>
                            updateWf({
                              explodedStyle: {
                                ...wf.explodedStyle,
                                systemColors: { ...wf.explodedStyle.systemColors, [item.key]: color },
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Edge Style</label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={wf.explodedStyle.edgeStyle}
                    onChange={(e) => updateWf({ explodedStyle: { ...wf.explodedStyle, edgeStyle: e.target.value as any } })}
                  >
                    <option value="hidden-removed">Hidden lines removed</option>
                    <option value="hidden-dashed">Hidden lines dashed</option>
                    <option value="all-visible">All edges visible</option>
                    <option value="silhouette">Silhouette only</option>
                  </select>
                </div>

                <Slider
                  label="Line Weight"
                  value={wf.explodedStyle.lineWeight}
                  min={1}
                  max={5}
                  onChange={(value) => updateWf({ explodedStyle: { ...wf.explodedStyle, lineWeight: value } })}
                />
              </div>
            ),
          },
          {
            id: 'annotations',
            title: 'Annotations',
            content: (
              <div className="space-y-3">
                <Toggle
                  label="Component Labels"
                  checked={wf.explodedAnnotations.labels}
                  onChange={(value) => updateWf({ explodedAnnotations: { ...wf.explodedAnnotations, labels: value } })}
                />
                <Toggle
                  label="Leader Lines"
                  checked={wf.explodedAnnotations.leaders}
                  onChange={(value) => updateWf({ explodedAnnotations: { ...wf.explodedAnnotations, leaders: value } })}
                />
                <Toggle
                  label="Dimensions"
                  checked={wf.explodedAnnotations.dimensions}
                  onChange={(value) => updateWf({ explodedAnnotations: { ...wf.explodedAnnotations, dimensions: value } })}
                />
                <Toggle
                  label="Assembly Numbers"
                  checked={wf.explodedAnnotations.assemblyNumbers}
                  onChange={(value) => updateWf({ explodedAnnotations: { ...wf.explodedAnnotations, assemblyNumbers: value } })}
                />
                <Toggle
                  label="Material Callouts"
                  checked={wf.explodedAnnotations.materialCallouts}
                  onChange={(value) => updateWf({ explodedAnnotations: { ...wf.explodedAnnotations, materialCallouts: value } })}
                />

                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Label Style</label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={wf.explodedAnnotations.labelStyle}
                    onChange={(e) => updateWf({ explodedAnnotations: { ...wf.explodedAnnotations, labelStyle: e.target.value as any } })}
                  >
                    <option value="minimal">Minimal</option>
                    <option value="technical">Technical</option>
                    <option value="descriptive">Descriptive</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Leader Style</label>
                  <SegmentedControl
                    value={wf.explodedAnnotations.leaderStyle}
                    options={[
                      { label: 'Straight', value: 'straight' },
                      { label: 'Angled', value: 'angled' },
                      { label: 'Curved', value: 'curved' },
                    ]}
                    onChange={(value) => updateWf({ explodedAnnotations: { ...wf.explodedAnnotations, leaderStyle: value as any } })}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Font Size</label>
                  <SegmentedControl
                    value={wf.explodedAnnotations.fontSize}
                    options={[
                      { label: 'S', value: 'small' },
                      { label: 'M', value: 'medium' },
                      { label: 'L', value: 'large' },
                    ]}
                    onChange={(value) => updateWf({ explodedAnnotations: { ...wf.explodedAnnotations, fontSize: value as any } })}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
