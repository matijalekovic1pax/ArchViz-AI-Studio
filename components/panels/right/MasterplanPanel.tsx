import React, { useCallback } from 'react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { RangeSlider } from '../../ui/RangeSlider';
import { Accordion } from '../../ui/Accordion';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { ArrowUpRight, ArrowUpLeft, ArrowDownRight, ArrowDownLeft, Layout, Crosshair } from 'lucide-react';

const buildStylePreview = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const outputStyles = [
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#97b487"/>
            <stop offset="100%" stop-color="#6e8f63"/>
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#93c6dd"/>
            <stop offset="100%" stop-color="#5f93ad"/>
          </linearGradient>
          <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e7e2d9"/>
            <stop offset="100%" stop-color="#c8c1b7"/>
          </linearGradient>
        </defs>
        <rect width="240" height="160" fill="url(#grass)"/>
        <path d="M0 120C40 90 90 90 130 110s80 20 110-5v45H0z" fill="#6f7d6e" opacity="0.9"/>
        <path d="M18 26c16 6 28 3 46-2 18-5 36-2 52 6 16 8 28 6 44-2 16-8 30-6 50 0l-8 18c-18 4-32 2-48-6-16-8-30-8-46-2-16 6-32 6-52-2-20-8-38-6-60 0z" fill="url(#water)"/>
        <g opacity="0.9">
          <rect x="34" y="56" width="70" height="36" rx="3" fill="url(#roof)"/>
          <rect x="114" y="50" width="56" height="30" rx="3" fill="url(#roof)"/>
          <rect x="176" y="66" width="34" height="22" rx="3" fill="url(#roof)"/>
          <rect x="120" y="90" width="80" height="26" rx="3" fill="#b8b0a7"/>
        </g>
        <g fill="#4f6a4a">
          <circle cx="28" cy="108" r="5"/>
          <circle cx="50" cy="118" r="6"/>
          <circle cx="90" cy="108" r="5"/>
          <circle cx="210" cy="118" r="6"/>
          <circle cx="200" cy="102" r="4"/>
        </g>
      </svg>`
    ),
  },
  {
    id: 'diagrammatic',
    label: 'Diagrammatic',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
        <rect width="240" height="160" fill="#ffffff"/>
        <rect x="10" y="14" width="100" height="52" fill="#d9ead3" stroke="#4f7f56" stroke-width="2"/>
        <rect x="120" y="14" width="110" height="52" fill="#cfe2f3" stroke="#3f6fa2" stroke-width="2"/>
        <rect x="18" y="78" width="80" height="46" fill="#f9cb9c" stroke="#b46b2a" stroke-width="2"/>
        <rect x="106" y="84" width="120" height="40" fill="#f4cccc" stroke="#a74848" stroke-width="2"/>
        <path d="M0 132h240" stroke="#222" stroke-width="4"/>
        <path d="M20 132c18-18 36-24 54-24 18 0 38 6 56 18 18 12 36 18 54 18s32-4 56-12" fill="none" stroke="#777" stroke-width="3"/>
        <circle cx="206" cy="40" r="10" fill="none" stroke="#222" stroke-width="2"/>
      </svg>`
    ),
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#bfc8bf"/>
            <stop offset="100%" stop-color="#909790"/>
          </linearGradient>
        </defs>
        <rect width="240" height="160" fill="url(#bg)"/>
        <path d="M0 118C48 94 96 92 132 108s70 20 108-4v36H0z" fill="#7f857f" opacity="0.9"/>
        <rect x="18" y="22" width="84" height="48" fill="#b6d7a8" opacity="0.75"/>
        <rect x="120" y="20" width="104" height="56" fill="#a4c2f4" opacity="0.75"/>
        <rect x="30" y="90" width="70" height="46" fill="#ffe599" opacity="0.8"/>
        <rect x="122" y="94" width="96" height="36" fill="#f4cccc" opacity="0.8"/>
        <g stroke="#323436" stroke-width="2" fill="none">
          <rect x="18" y="22" width="84" height="48"/>
          <rect x="120" y="20" width="104" height="56"/>
          <rect x="30" y="90" width="70" height="46"/>
          <rect x="122" y="94" width="96" height="36"/>
        </g>
      </svg>`
    ),
  },
  {
    id: 'illustrative',
    label: 'Illustrative',
    imageUrl: buildStylePreview(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
        <rect width="240" height="160" fill="#faf2e8"/>
        <path d="M12 48c20 12 44 18 64 10 20-8 44-8 60 6 16 14 42 16 70 2" fill="none" stroke="#7a7067" stroke-width="2" stroke-linecap="round"/>
        <path d="M20 118c26-12 58-22 84-10 26 12 56 12 84-6 28-18 42-18 52-12" fill="none" stroke="#7a7067" stroke-width="2" stroke-linecap="round"/>
        <rect x="22" y="30" width="88" height="48" rx="6" fill="#d6e4ce" opacity="0.7"/>
        <rect x="122" y="26" width="96" height="56" rx="6" fill="#f7d9a8" opacity="0.7"/>
        <rect x="38" y="92" width="72" height="46" rx="6" fill="#cddff2" opacity="0.6"/>
        <rect x="124" y="96" width="86" height="36" rx="6" fill="#f0c7c7" opacity="0.6"/>
        <g fill="none" stroke="#7a7067" stroke-width="2" stroke-linecap="round">
          <rect x="22" y="30" width="88" height="48" rx="6"/>
          <rect x="122" y="26" width="96" height="56" rx="6"/>
          <rect x="38" y="92" width="72" height="46" rx="6"/>
          <rect x="124" y="96" width="86" height="36" rx="6"/>
        </g>
      </svg>`
    ),
  },
];

const viewAngles = [
  { id: 'top', label: 'Top', icon: Layout },
  { id: 'iso-ne', label: 'Iso NE', icon: ArrowUpRight },
  { id: 'iso-nw', label: 'Iso NW', icon: ArrowUpLeft },
  { id: 'iso-se', label: 'Iso SE', icon: ArrowDownRight },
  { id: 'iso-sw', label: 'Iso SW', icon: ArrowDownLeft },
  { id: 'custom', label: 'Custom', icon: Crosshair },
];

const buildingStyles = [
  'Contemporary Mixed',
  'Modern Minimal',
  'High-Tech Glass',
  'Brutalist',
  'Traditional European',
  'Mediterranean',
  'Colonial',
  'Asian Contemporary',
  'Industrial / Warehouse',
  'Mixed Industrial',
  'Match Surroundings (AI)',
];

const roofStyles = ['Flat', 'Gabled', 'Hip', 'Mansard', 'Green', 'Mixed'];

const labelStyles = ['modern', 'classic', 'technical', 'handwritten', 'minimal'];

const legendStyles = ['compact', 'detailed', 'professional', 'minimal'];

export const MasterplanPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch, wf]
  );

  return (
    <div className="space-y-6">
      <Accordion
        items={[
          {
            id: 'output-style',
            title: 'Output Style',
            content: (
              <div className="grid grid-cols-2 gap-2">
                {outputStyles.map((style) => {
                  const selected = wf.mpOutputStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => updateWf({ mpOutputStyle: style.id as any })}
                      className={cn(
                        'rounded-lg border p-2 text-[10px] font-medium transition-all',
                        selected ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-foreground/40'
                      )}
                    >
                      <div className="relative rounded-md h-16 w-full mb-2 border border-border overflow-hidden">
                        <img src={style.imageUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
                      </div>
                      <div className="text-center">{style.label}</div>
                    </button>
                  );
                })}
              </div>
            ),
          },
          {
            id: 'view-angle',
            title: 'View Angle',
            content: (
              <div>
                <div className="grid grid-cols-3 gap-2">
                  {viewAngles.map((view) => {
                    const Icon = view.icon;
                    const selected = wf.mpViewAngle === view.id;
                    return (
                      <button
                        key={view.id}
                        type="button"
                        onClick={() => updateWf({ mpViewAngle: view.id as any })}
                        className={cn(
                          'aspect-square flex flex-col items-center justify-center border rounded transition-colors',
                          selected ? 'bg-surface-sunken border-foreground/50' : 'border-border hover:bg-surface-elevated'
                        )}
                      >
                        <Icon size={18} className={cn(selected ? 'text-foreground' : 'text-foreground-muted')} />
                        <span className={cn('text-[9px] mt-1', selected && 'font-bold')}>{view.label}</span>
                      </button>
                    );
                  })}
                </div>
                {wf.mpViewAngle === 'custom' && (
                  <div className="mt-3 space-y-2">
                    <Slider
                      label="Elevation Angle"
                      value={wf.mpViewCustom.elevation}
                      min={0}
                      max={90}
                      onChange={(value) => updateWf({ mpViewCustom: { ...wf.mpViewCustom, elevation: value } })}
                    />
                    <Slider
                      label="Rotation Angle"
                      value={wf.mpViewCustom.rotation}
                      min={0}
                      max={360}
                      onChange={(value) => updateWf({ mpViewCustom: { ...wf.mpViewCustom, rotation: value } })}
                    />
                    <Slider
                      label="Perspective Strength"
                      value={wf.mpViewCustom.perspective}
                      min={0}
                      max={100}
                      onChange={(value) => updateWf({ mpViewCustom: { ...wf.mpViewCustom, perspective: value } })}
                    />
                  </div>
                )}
              </div>
            ),
          },
          {
            id: 'buildings',
            title: 'Buildings',
            content: (
              <div className="space-y-3">
                <select
                  className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                  value={wf.mpBuildings.style}
                  onChange={(e) => updateWf({ mpBuildings: { ...wf.mpBuildings, style: e.target.value } })}
                >
                  {buildingStyles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
                <div>
                  <span className="text-[10px] text-foreground-muted block mb-1">Height Mode</span>
                  <SegmentedControl
                    value={wf.mpBuildings.heightMode}
                    options={[
                      { label: 'Uniform', value: 'uniform' },
                      { label: 'From Color', value: 'from-color' },
                      { label: 'Vary', value: 'vary' },
                    ]}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, heightMode: value as any } })}
                  />
                </div>
                <Slider
                  label="Default Height"
                  value={wf.mpBuildings.defaultHeight}
                  min={3}
                  max={100}
                  onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, defaultHeight: value } })}
                />
                <RangeSlider
                  label="Height Range"
                  value={[wf.mpBuildings.heightRange.min, wf.mpBuildings.heightRange.max]}
                  min={3}
                  max={150}
                  onChange={([min, max]) => updateWf({ mpBuildings: { ...wf.mpBuildings, heightRange: { min, max } } })}
                />
                <Slider
                  label="Floor Height"
                  value={wf.mpBuildings.floorHeight}
                  min={2.5}
                  max={5}
                  step={0.1}
                  onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, floorHeight: value } })}
                />
                <select
                  className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                  value={wf.mpBuildings.roofStyle}
                  onChange={(e) => updateWf({ mpBuildings: { ...wf.mpBuildings, roofStyle: e.target.value as any } })}
                >
                  {roofStyles.map((style) => (
                    <option key={style} value={style.toLowerCase()}>
                      {style}
                    </option>
                  ))}
                </select>
                <div className="space-y-2">
                  <Toggle
                    label="Show Building Shadows"
                    checked={wf.mpBuildings.showShadows}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, showShadows: value } })}
                  />
                  <Toggle
                    label="Transparent Buildings"
                    checked={wf.mpBuildings.transparent}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, transparent: value } })}
                  />
                  <Toggle
                    label="Facade Variation"
                    checked={wf.mpBuildings.facadeVariation}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, facadeVariation: value } })}
                  />
                  <Toggle
                    label="Show Floor Count Labels"
                    checked={wf.mpBuildings.showFloorLabels}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, showFloorLabels: value } })}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'landscape',
            title: 'Landscape',
            content: (
              <div className="space-y-3">
                <SegmentedControl
                  value={wf.mpLandscape.season}
                  options={[
                    { label: 'Spring', value: 'spring' },
                    { label: 'Summer', value: 'summer' },
                    { label: 'Autumn', value: 'autumn' },
                    { label: 'Winter', value: 'winter' },
                  ]}
                  onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, season: value as any } })}
                />
                <Slider
                  label="Vegetation Density"
                  value={wf.mpLandscape.vegetationDensity}
                  min={0}
                  max={100}
                  onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, vegetationDensity: value } })}
                />
                <Slider
                  label="Tree Size Variation"
                  value={wf.mpLandscape.treeVariation}
                  min={0}
                  max={100}
                  onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, treeVariation: value } })}
                />
                <div className="space-y-2">
                  <Toggle
                    label="Trees & Shrubs"
                    checked={wf.mpLandscape.trees}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, trees: value } })}
                  />
                  <Toggle
                    label="Grass & Ground Cover"
                    checked={wf.mpLandscape.grass}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, grass: value } })}
                  />
                  <Toggle
                    label="Water Features"
                    checked={wf.mpLandscape.water}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, water: value } })}
                  />
                  <Toggle
                    label="Pathways & Plazas"
                    checked={wf.mpLandscape.pathways}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, pathways: value } })}
                  />
                  <Toggle
                    label="Street Furniture"
                    checked={wf.mpLandscape.streetFurniture}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, streetFurniture: value } })}
                  />
                  <Toggle
                    label="Vehicles"
                    checked={wf.mpLandscape.vehicles}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, vehicles: value } })}
                  />
                  <Toggle
                    label="People"
                    checked={wf.mpLandscape.people}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, people: value } })}
                  />
                </div>
                {wf.mpOutputStyle === 'illustrative' && (
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={wf.mpLandscape.vegetationStyle}
                    onChange={(e) => updateWf({ mpLandscape: { ...wf.mpLandscape, vegetationStyle: e.target.value as any } })}
                  >
                    <option value="realistic">Realistic</option>
                    <option value="stylized">Stylized / Iconic</option>
                    <option value="watercolor">Watercolor</option>
                    <option value="technical">Technical (Symbols)</option>
                  </select>
                )}
              </div>
            ),
          },
          {
            id: 'annotations',
            title: 'Annotations',
            content: (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Toggle
                    label="Zone Labels"
                    checked={wf.mpAnnotations.zoneLabels}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, zoneLabels: value } })}
                  />
                  <Toggle
                    label="Street Names"
                    checked={wf.mpAnnotations.streetNames}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, streetNames: value } })}
                  />
                  <Toggle
                    label="Building Labels"
                    checked={wf.mpAnnotations.buildingLabels}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, buildingLabels: value } })}
                  />
                  <Toggle
                    label="Lot Numbers"
                    checked={wf.mpAnnotations.lotNumbers}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, lotNumbers: value } })}
                  />
                  <Toggle
                    label="Scale Bar"
                    checked={wf.mpAnnotations.scaleBar}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, scaleBar: value } })}
                  />
                  <Toggle
                    label="North Arrow"
                    checked={wf.mpAnnotations.northArrow}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, northArrow: value } })}
                  />
                  <Toggle
                    label="Dimensions"
                    checked={wf.mpAnnotations.dimensions}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, dimensions: value } })}
                  />
                  <Toggle
                    label="Area Calculations"
                    checked={wf.mpAnnotations.areaCalc}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, areaCalc: value } })}
                  />
                  <Toggle
                    label="Contour Labels"
                    checked={wf.mpAnnotations.contourLabels}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, contourLabels: value } })}
                  />
                </div>
                <select
                  className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                  value={wf.mpAnnotations.labelStyle}
                  onChange={(e) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, labelStyle: e.target.value as any } })}
                >
                  {labelStyles.map((style) => (
                    <option key={style} value={style}>
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </option>
                  ))}
                </select>
                <SegmentedControl
                  value={wf.mpAnnotations.labelSize}
                  options={[
                    { label: 'Small', value: 'small' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Large', value: 'large' },
                  ]}
                  onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, labelSize: value as any } })}
                />
                <SegmentedControl
                  value={wf.mpAnnotations.labelColor}
                  options={[
                    { label: 'Auto', value: 'auto' },
                    { label: 'Dark', value: 'dark' },
                    { label: 'Light', value: 'light' },
                  ]}
                  onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, labelColor: value as any } })}
                />
                <Toggle
                  label="Label Background (Halo)"
                  checked={wf.mpAnnotations.labelHalo}
                  onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, labelHalo: value } })}
                />
              </div>
            ),
          },
          {
            id: 'legend',
            title: 'Legend',
            content: (
              <div className="space-y-3">
                <Toggle
                  label="Include Legend"
                  checked={wf.mpLegend.include}
                  onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, include: value } })}
                />
                {wf.mpLegend.include && (
                  <>
                    <SegmentedControl
                      value={wf.mpLegend.position}
                      options={[
                        { label: 'Top-Left', value: 'top-left' },
                        { label: 'Top-Right', value: 'top-right' },
                        { label: 'Bottom', value: 'bottom' },
                      ]}
                      onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, position: value as any } })}
                    />
                    <div className="space-y-2">
                      <Toggle
                        label="Zone Colors & Names"
                        checked={wf.mpLegend.showZones}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showZones: value } })}
                      />
                      <Toggle
                        label="Zone Areas"
                        checked={wf.mpLegend.showZoneAreas}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showZoneAreas: value } })}
                      />
                      <Toggle
                        label="Building Types"
                        checked={wf.mpLegend.showBuildings}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showBuildings: value } })}
                      />
                      <Toggle
                        label="Landscape Elements"
                        checked={wf.mpLegend.showLandscape}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showLandscape: value } })}
                      />
                      <Toggle
                        label="Infrastructure"
                        checked={wf.mpLegend.showInfrastructure}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showInfrastructure: value } })}
                      />
                    </div>
                    <select
                      className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                      value={wf.mpLegend.style}
                      onChange={(e) => updateWf({ mpLegend: { ...wf.mpLegend, style: e.target.value as any } })}
                    >
                      {legendStyles.map((style) => (
                        <option key={style} value={style}>
                          {style.charAt(0).toUpperCase() + style.slice(1)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
