import React, { useCallback } from 'react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Slider } from '../../ui/Slider';
import { ColorPicker } from './SharedRightComponents';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../store';

const buildStylePreview = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const revealStyles = [
  {
    id: 'front-peel',
    label: 'Front Peel',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f4f4f4"/>
        <rect x="36" y="28" width="120" height="84" rx="6" fill="#d7d7d7"/>
        <rect x="140" y="28" width="64" height="84" rx="6" fill="#bfc8d2"/>
      </svg>`
    ),
  },
  {
    id: 'slice-lift',
    label: 'Slice + Lift',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f4f4f4"/>
        <rect x="34" y="30" width="172" height="80" rx="6" fill="#d9d9d9"/>
        <rect x="110" y="20" width="30" height="100" rx="4" fill="#b7c1cc"/>
      </svg>`
    ),
  },
  {
    id: 'stacked-floors',
    label: 'Stacked Floors',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f4f4f4"/>
        <g fill="#cfd5dd">
          <rect x="40" y="86" width="160" height="14" rx="3"/>
          <rect x="46" y="64" width="148" height="14" rx="3"/>
          <rect x="52" y="42" width="136" height="14" rx="3"/>
          <rect x="58" y="20" width="124" height="14" rx="3"/>
        </g>
      </svg>`
    ),
  },
  {
    id: 'core-focus',
    label: 'Core Focus',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f4f4f4"/>
        <rect x="36" y="24" width="168" height="92" rx="8" fill="none" stroke="#b7c1cc" stroke-width="6"/>
        <rect x="104" y="50" width="32" height="40" rx="4" fill="#b7c1cc"/>
      </svg>`
    ),
  },
  {
    id: 'program-color',
    label: 'Program Blocks',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f4f4f4"/>
        <rect x="38" y="28" width="164" height="84" rx="6" fill="#e6e6e6"/>
        <rect x="50" y="38" width="52" height="28" rx="4" fill="#7ED321"/>
        <rect x="110" y="38" width="70" height="28" rx="4" fill="#4A90D9"/>
        <rect x="50" y="72" width="70" height="28" rx="4" fill="#F5A623"/>
        <rect x="128" y="72" width="52" height="28" rx="4" fill="#9B9B9B"/>
      </svg>`
    ),
  },
  {
    id: 'circulation',
    label: 'Circulation',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f4f4f4"/>
        <rect x="36" y="26" width="168" height="88" rx="8" fill="#e5e7eb"/>
        <rect x="116" y="30" width="8" height="80" rx="3" fill="#6b7280"/>
        <circle cx="120" cy="44" r="6" fill="#6b7280"/>
        <circle cx="120" cy="70" r="6" fill="#6b7280"/>
        <circle cx="120" cy="96" r="6" fill="#6b7280"/>
      </svg>`
    ),
  },
  {
    id: 'services',
    label: 'Services',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
        <rect width="240" height="140" fill="#f4f4f4"/>
        <rect x="36" y="28" width="168" height="84" rx="6" fill="#e6e6e6"/>
        <g stroke="#F5A623" stroke-width="6" stroke-linecap="round">
          <line x1="54" y1="50" x2="186" y2="50" />
          <line x1="54" y1="72" x2="186" y2="72" />
          <line x1="54" y1="94" x2="186" y2="94" />
        </g>
      </svg>`
    ),
  },
];

export const SectionPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch, wf]
  );

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Section Reveal</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {revealStyles.map((style) => {
            const selected = wf.sectionReveal.style === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => updateWf({ sectionReveal: { ...wf.sectionReveal, style: style.id as any } })}
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
        <div className="mt-3 space-y-2">
          <label className="text-[10px] text-foreground-muted mb-1 block">Focus</label>
          <select
            className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
            value={wf.sectionReveal.focus}
            onChange={(e) => updateWf({ sectionReveal: { ...wf.sectionReveal, focus: e.target.value as any } })}
          >
            <option value="residential">Residential</option>
            <option value="parking">Parking</option>
            <option value="circulation">Circulation</option>
            <option value="services">Services</option>
            <option value="mixed">Mixed</option>
            <option value="amenities">Amenities</option>
            <option value="lobby">Lobby / Common</option>
            <option value="retail">Retail</option>
            <option value="office">Office</option>
            <option value="mechanical">Mechanical</option>
            <option value="storage">Storage</option>
          </select>
          <Slider
            label="Facade Opacity"
            value={wf.sectionReveal.facadeOpacity}
            min={0}
            max={100}
            onChange={(value) => updateWf({ sectionReveal: { ...wf.sectionReveal, facadeOpacity: value } })}
          />
          <Slider
            label="Depth Fade"
            value={wf.sectionReveal.depthFade}
            min={0}
            max={100}
            onChange={(value) => updateWf({ sectionReveal: { ...wf.sectionReveal, depthFade: value } })}
          />
        </div>
      </div>

      <Accordion
        items={[
          {
            id: 'program',
            title: 'Program & Labels',
            content: (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Color Mode</label>
                  <SegmentedControl
                    value={wf.sectionProgram.colorMode}
                    options={[
                      { label: 'Program Colors', value: 'program' },
                      { label: 'Material', value: 'material' },
                      { label: 'Mono', value: 'mono' },
                    ]}
                    onChange={(value) => updateWf({ sectionProgram: { ...wf.sectionProgram, colorMode: value as any } })}
                  />
                </div>

                {wf.sectionProgram.colorMode === 'program' && (
                  <div className="space-y-2">
                    {[
                      { key: 'residential', label: 'Residential' },
                      { key: 'parking', label: 'Parking' },
                      { key: 'circulation', label: 'Circulation' },
                      { key: 'services', label: 'Services' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <span className="text-xs text-foreground">{item.label}</span>
                        <ColorPicker
                          color={wf.sectionProgram.programColors[item.key]}
                          onChange={(color) =>
                            updateWf({
                              sectionProgram: {
                                ...wf.sectionProgram,
                                programColors: { ...wf.sectionProgram.programColors, [item.key]: color },
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Toggle
                    label="Program Labels"
                    checked={wf.sectionProgram.labels}
                    onChange={(value) => updateWf({ sectionProgram: { ...wf.sectionProgram, labels: value } })}
                  />
                  <Toggle
                    label="Leader Lines"
                    checked={wf.sectionProgram.leaderLines}
                    onChange={(value) => updateWf({ sectionProgram: { ...wf.sectionProgram, leaderLines: value } })}
                  />
                  <Toggle
                    label="Area Tags"
                    checked={wf.sectionProgram.areaTags}
                    onChange={(value) => updateWf({ sectionProgram: { ...wf.sectionProgram, areaTags: value } })}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Label Style</label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={wf.sectionProgram.labelStyle}
                    onChange={(e) => updateWf({ sectionProgram: { ...wf.sectionProgram, labelStyle: e.target.value as any } })}
                  >
                    <option value="minimal">Minimal</option>
                    <option value="technical">Technical</option>
                    <option value="descriptive">Descriptive</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Font Size</label>
                  <SegmentedControl
                    value={wf.sectionProgram.fontSize}
                    options={[
                      { label: 'S', value: 'small' },
                      { label: 'M', value: 'medium' },
                      { label: 'L', value: 'large' },
                    ]}
                    onChange={(value) => updateWf({ sectionProgram: { ...wf.sectionProgram, fontSize: value as any } })}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'cut-style',
            title: 'Cut Style',
            content: (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Poche Color</span>
                  <ColorPicker
                    color={wf.sectionStyle.poche}
                    onChange={(color) => updateWf({ sectionStyle: { ...wf.sectionStyle, poche: color } })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Hatch</label>
                  <SegmentedControl
                    value={wf.sectionStyle.hatch}
                    options={[
                      { label: 'Solid', value: 'solid' },
                      { label: 'Diag', value: 'diag' },
                      { label: 'Cross', value: 'cross' },
                    ]}
                    onChange={(value) => updateWf({ sectionStyle: { ...wf.sectionStyle, hatch: value as any } })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-foreground-muted mb-1 block">Line Weight</label>
                  <SegmentedControl
                    value={wf.sectionStyle.weight}
                    options={[
                      { label: 'Light', value: 'light' },
                      { label: 'Medium', value: 'medium' },
                      { label: 'Heavy', value: 'heavy' },
                    ]}
                    onChange={(value) => updateWf({ sectionStyle: { ...wf.sectionStyle, weight: value as any } })}
                  />
                </div>
                <Slider
                  label="Beyond Visibility"
                  value={wf.sectionStyle.showBeyond}
                  min={0}
                  max={100}
                  onChange={(value) => updateWf({ sectionStyle: { ...wf.sectionStyle, showBeyond: value } })}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
