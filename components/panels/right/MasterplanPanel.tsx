import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
    labelKey: 'masterplan.outputStyles.photorealistic',
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
    labelKey: 'masterplan.outputStyles.diagrammatic',
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
    labelKey: 'masterplan.outputStyles.hybrid',
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
    labelKey: 'masterplan.outputStyles.illustrative',
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
  { id: 'top', labelKey: 'masterplan.viewAngles.top', icon: Layout },
  { id: 'iso-ne', labelKey: 'masterplan.viewAngles.isoNe', icon: ArrowUpRight },
  { id: 'iso-nw', labelKey: 'masterplan.viewAngles.isoNw', icon: ArrowUpLeft },
  { id: 'iso-se', labelKey: 'masterplan.viewAngles.isoSe', icon: ArrowDownRight },
  { id: 'iso-sw', labelKey: 'masterplan.viewAngles.isoSw', icon: ArrowDownLeft },
  { id: 'custom', labelKey: 'masterplan.viewAngles.custom', icon: Crosshair },
];

const buildingStyles = [
  { value: 'Contemporary Mixed', labelKey: 'masterplan.buildingStyles.contemporaryMixed' },
  { value: 'Modern Minimal', labelKey: 'masterplan.buildingStyles.modernMinimal' },
  { value: 'High-Tech Glass', labelKey: 'masterplan.buildingStyles.highTechGlass' },
  { value: 'Brutalist', labelKey: 'masterplan.buildingStyles.brutalist' },
  { value: 'Traditional European', labelKey: 'masterplan.buildingStyles.traditionalEuropean' },
  { value: 'Mediterranean', labelKey: 'masterplan.buildingStyles.mediterranean' },
  { value: 'Colonial', labelKey: 'masterplan.buildingStyles.colonial' },
  { value: 'Asian Contemporary', labelKey: 'masterplan.buildingStyles.asianContemporary' },
  { value: 'Industrial / Warehouse', labelKey: 'masterplan.buildingStyles.industrialWarehouse' },
  { value: 'Mixed Industrial', labelKey: 'masterplan.buildingStyles.mixedIndustrial' },
  { value: 'Match Surroundings (AI)', labelKey: 'masterplan.buildingStyles.matchSurroundings' },
];

const roofStyles = [
  { value: 'flat', labelKey: 'masterplan.roofStyles.flat' },
  { value: 'gabled', labelKey: 'masterplan.roofStyles.gabled' },
  { value: 'hip', labelKey: 'masterplan.roofStyles.hip' },
  { value: 'mansard', labelKey: 'masterplan.roofStyles.mansard' },
  { value: 'green', labelKey: 'masterplan.roofStyles.green' },
  { value: 'mixed', labelKey: 'masterplan.roofStyles.mixed' },
];

const labelStyles = [
  { value: 'modern', labelKey: 'masterplan.labelStyles.modern' },
  { value: 'classic', labelKey: 'masterplan.labelStyles.classic' },
  { value: 'technical', labelKey: 'masterplan.labelStyles.technical' },
  { value: 'handwritten', labelKey: 'masterplan.labelStyles.handwritten' },
  { value: 'minimal', labelKey: 'masterplan.labelStyles.minimal' },
];

const legendStyles = [
  { value: 'compact', labelKey: 'masterplan.legendStyles.compact' },
  { value: 'detailed', labelKey: 'masterplan.legendStyles.detailed' },
  { value: 'professional', labelKey: 'masterplan.legendStyles.professional' },
  { value: 'minimal', labelKey: 'masterplan.legendStyles.minimal' },
];

export const MasterplanPanel = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
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
            title: t('masterplan.sections.outputStyle.title'),
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
                      <div className="text-center">{t(style.labelKey)}</div>
                    </button>
                  );
                })}
              </div>
            ),
          },
          {
            id: 'view-angle',
            title: t('masterplan.sections.viewAngle.title'),
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
                        <span className={cn('text-[9px] mt-1', selected && 'font-bold')}>{t(view.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
                {wf.mpViewAngle === 'custom' && (
                  <div className="mt-3 space-y-2">
                    <Slider
                      label={t('masterplan.sections.viewAngle.elevation')}
                      value={wf.mpViewCustom.elevation}
                      min={0}
                      max={90}
                      onChange={(value) => updateWf({ mpViewCustom: { ...wf.mpViewCustom, elevation: value } })}
                    />
                    <Slider
                      label={t('masterplan.sections.viewAngle.rotation')}
                      value={wf.mpViewCustom.rotation}
                      min={0}
                      max={360}
                      onChange={(value) => updateWf({ mpViewCustom: { ...wf.mpViewCustom, rotation: value } })}
                    />
                    <Slider
                      label={t('masterplan.sections.viewAngle.perspective')}
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
            title: t('masterplan.sections.buildings.title'),
            content: (
              <div className="space-y-3">
                <select
                  className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                  value={wf.mpBuildings.style}
                  onChange={(e) => updateWf({ mpBuildings: { ...wf.mpBuildings, style: e.target.value } })}
                >
                  {buildingStyles.map((style) => (
                    <option key={style.value} value={style.value}>
                      {t(style.labelKey)}
                    </option>
                  ))}
                </select>
                <div>
                  <span className="text-[10px] text-foreground-muted block mb-1">{t('masterplan.sections.buildings.heightMode')}</span>
                  <SegmentedControl
                    value={wf.mpBuildings.heightMode}
                    options={[
                      { label: t('masterplan.sections.buildings.heightModeOptions.uniform'), value: 'uniform' },
                      { label: t('masterplan.sections.buildings.heightModeOptions.fromColor'), value: 'from-color' },
                      { label: t('masterplan.sections.buildings.heightModeOptions.vary'), value: 'vary' },
                    ]}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, heightMode: value as any } })}
                  />
                </div>
                <Slider
                  label={t('masterplan.sections.buildings.defaultHeight')}
                  value={wf.mpBuildings.defaultHeight}
                  min={3}
                  max={100}
                  onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, defaultHeight: value } })}
                />
                <RangeSlider
                  label={t('masterplan.sections.buildings.heightRange')}
                  value={[wf.mpBuildings.heightRange.min, wf.mpBuildings.heightRange.max]}
                  min={3}
                  max={150}
                  onChange={([min, max]) => updateWf({ mpBuildings: { ...wf.mpBuildings, heightRange: { min, max } } })}
                />
                <Slider
                  label={t('masterplan.sections.buildings.floorHeight')}
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
                    <option key={style.value} value={style.value}>
                      {t(style.labelKey)}
                    </option>
                  ))}
                </select>
                <div className="space-y-2">
                  <Toggle
                    label={t('masterplan.sections.buildings.showShadows')}
                    checked={wf.mpBuildings.showShadows}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, showShadows: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.buildings.transparent')}
                    checked={wf.mpBuildings.transparent}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, transparent: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.buildings.facadeVariation')}
                    checked={wf.mpBuildings.facadeVariation}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, facadeVariation: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.buildings.showFloorLabels')}
                    checked={wf.mpBuildings.showFloorLabels}
                    onChange={(value) => updateWf({ mpBuildings: { ...wf.mpBuildings, showFloorLabels: value } })}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'landscape',
            title: t('masterplan.sections.landscape.title'),
            content: (
              <div className="space-y-3">
                <SegmentedControl
                  value={wf.mpLandscape.season}
                  options={[
                    { label: t('masterplan.sections.landscape.seasonOptions.spring'), value: 'spring' },
                    { label: t('masterplan.sections.landscape.seasonOptions.summer'), value: 'summer' },
                    { label: t('masterplan.sections.landscape.seasonOptions.autumn'), value: 'autumn' },
                    { label: t('masterplan.sections.landscape.seasonOptions.winter'), value: 'winter' },
                  ]}
                  onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, season: value as any } })}
                />
                <Slider
                  label={t('masterplan.sections.landscape.vegetationDensity')}
                  value={wf.mpLandscape.vegetationDensity}
                  min={0}
                  max={100}
                  onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, vegetationDensity: value } })}
                />
                <Slider
                  label={t('masterplan.sections.landscape.treeVariation')}
                  value={wf.mpLandscape.treeVariation}
                  min={0}
                  max={100}
                  onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, treeVariation: value } })}
                />
                <div className="space-y-2">
                  <Toggle
                    label={t('masterplan.sections.landscape.trees')}
                    checked={wf.mpLandscape.trees}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, trees: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.landscape.grass')}
                    checked={wf.mpLandscape.grass}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, grass: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.landscape.water')}
                    checked={wf.mpLandscape.water}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, water: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.landscape.pathways')}
                    checked={wf.mpLandscape.pathways}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, pathways: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.landscape.streetFurniture')}
                    checked={wf.mpLandscape.streetFurniture}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, streetFurniture: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.landscape.vehicles')}
                    checked={wf.mpLandscape.vehicles}
                    onChange={(value) => updateWf({ mpLandscape: { ...wf.mpLandscape, vehicles: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.landscape.people')}
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
                    <option value="realistic">{t('masterplan.sections.landscape.vegetationStyleOptions.realistic')}</option>
                    <option value="stylized">{t('masterplan.sections.landscape.vegetationStyleOptions.stylized')}</option>
                    <option value="watercolor">{t('masterplan.sections.landscape.vegetationStyleOptions.watercolor')}</option>
                    <option value="technical">{t('masterplan.sections.landscape.vegetationStyleOptions.technical')}</option>
                  </select>
                )}
              </div>
            ),
          },
          {
            id: 'annotations',
            title: t('masterplan.sections.annotations.title'),
            content: (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Toggle
                    label={t('masterplan.sections.annotations.zoneLabels')}
                    checked={wf.mpAnnotations.zoneLabels}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, zoneLabels: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.annotations.streetNames')}
                    checked={wf.mpAnnotations.streetNames}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, streetNames: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.annotations.buildingLabels')}
                    checked={wf.mpAnnotations.buildingLabels}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, buildingLabels: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.annotations.lotNumbers')}
                    checked={wf.mpAnnotations.lotNumbers}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, lotNumbers: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.annotations.scaleBar')}
                    checked={wf.mpAnnotations.scaleBar}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, scaleBar: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.annotations.northArrow')}
                    checked={wf.mpAnnotations.northArrow}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, northArrow: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.annotations.dimensions')}
                    checked={wf.mpAnnotations.dimensions}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, dimensions: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.annotations.areaCalculations')}
                    checked={wf.mpAnnotations.areaCalc}
                    onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, areaCalc: value } })}
                  />
                  <Toggle
                    label={t('masterplan.sections.annotations.contourLabels')}
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
                    <option key={style.value} value={style.value}>
                      {t(style.labelKey)}
                    </option>
                  ))}
                </select>
                <SegmentedControl
                  value={wf.mpAnnotations.labelSize}
                  options={[
                    { label: t('masterplan.sections.annotations.labelSizeOptions.small'), value: 'small' },
                    { label: t('masterplan.sections.annotations.labelSizeOptions.medium'), value: 'medium' },
                    { label: t('masterplan.sections.annotations.labelSizeOptions.large'), value: 'large' },
                  ]}
                  onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, labelSize: value as any } })}
                />
                <SegmentedControl
                  value={wf.mpAnnotations.labelColor}
                  options={[
                    { label: t('masterplan.sections.annotations.labelColorOptions.auto'), value: 'auto' },
                    { label: t('masterplan.sections.annotations.labelColorOptions.dark'), value: 'dark' },
                    { label: t('masterplan.sections.annotations.labelColorOptions.light'), value: 'light' },
                  ]}
                  onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, labelColor: value as any } })}
                />
                <Toggle
                  label={t('masterplan.sections.annotations.labelHalo')}
                  checked={wf.mpAnnotations.labelHalo}
                  onChange={(value) => updateWf({ mpAnnotations: { ...wf.mpAnnotations, labelHalo: value } })}
                />
              </div>
            ),
          },
          {
            id: 'legend',
            title: t('masterplan.sections.legend.title'),
            content: (
              <div className="space-y-3">
                <Toggle
                  label={t('masterplan.sections.legend.include')}
                  checked={wf.mpLegend.include}
                  onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, include: value } })}
                />
                {wf.mpLegend.include && (
                  <>
                    <SegmentedControl
                      value={wf.mpLegend.position}
                      options={[
                        { label: t('masterplan.sections.legend.positionOptions.topLeft'), value: 'top-left' },
                        { label: t('masterplan.sections.legend.positionOptions.topRight'), value: 'top-right' },
                        { label: t('masterplan.sections.legend.positionOptions.bottom'), value: 'bottom' },
                      ]}
                      onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, position: value as any } })}
                    />
                    <div className="space-y-2">
                      <Toggle
                        label={t('masterplan.sections.legend.zoneColorsNames')}
                        checked={wf.mpLegend.showZones}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showZones: value } })}
                      />
                      <Toggle
                        label={t('masterplan.sections.legend.zoneAreas')}
                        checked={wf.mpLegend.showZoneAreas}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showZoneAreas: value } })}
                      />
                      <Toggle
                        label={t('masterplan.sections.legend.buildingTypes')}
                        checked={wf.mpLegend.showBuildings}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showBuildings: value } })}
                      />
                      <Toggle
                        label={t('masterplan.sections.legend.landscapeElements')}
                        checked={wf.mpLegend.showLandscape}
                        onChange={(value) => updateWf({ mpLegend: { ...wf.mpLegend, showLandscape: value } })}
                      />
                      <Toggle
                        label={t('masterplan.sections.legend.infrastructure')}
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
                        <option key={style.value} value={style.value}>
                          {t(style.labelKey)}
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
