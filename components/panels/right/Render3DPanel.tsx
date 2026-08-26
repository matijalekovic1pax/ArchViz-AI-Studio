import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Sun, User, Wind, Sparkle, Car, Trees } from 'lucide-react';
import { SliderControl, LevelControl, VerticalCard, SunPositionWidget, ColorPicker } from './SharedRightComponents';
import { MATERIAL_SWATCHES } from '../../../lib/materialCatalog';
import { cn } from '../../../lib/utils';
import { DEFAULT_RENDER_GENERATION_MODE, RENDER_GENERATION_MODES, RENDER3D_SOURCE_MODES, Render3DSettings, Render3DSourceMode, RenderGenerationMode, Render3DGrade } from '../../../types';

const RENDER_3D_GENERATION_MODES: readonly RenderGenerationMode[] = [
  DEFAULT_RENDER_GENERATION_MODE,
  'enhance',
  'concept-push',
] as const;

interface Render3DPanelProps {
  showGenerationMode?: boolean;
  accordionValue?: string | null;
  onAccordionChange?: (value: string | null) => void;
  accordionIdPrefix?: string;
}

// Each stop maps 1:1 onto a distinct phrase in the prompt engine. Values are
// the bucket centres, so what the user picks is exactly what the model is told.
const FOG_LEVELS = [
  { value: 5, label: 'Haze' },
  { value: 25, label: 'Soft' },
  { value: 45, label: 'Mist' },
  { value: 70, label: 'Thick' },
  { value: 90, label: 'Dense' },
];
const BLOOM_LEVELS = [
  { value: 12, label: 'Subtle' },
  { value: 37, label: 'Gentle' },
  { value: 62, label: 'Prominent' },
  { value: 87, label: 'Intense' },
];
const PEOPLE_LEVELS = [
  { value: 5, label: 'Sparse' },
  { value: 20, label: 'Modest' },
  { value: 45, label: 'Lively' },
  { value: 80, label: 'Bustling' },
];
const VEGETATION_LEVELS = [
  { value: 10, label: 'Minimal' },
  { value: 30, label: 'Considered' },
  { value: 50, label: 'Abundant' },
  { value: 70, label: 'Lush' },
  { value: 90, label: 'Wild' },
];
const VEHICLE_LEVELS = [
  { value: 5, label: 'A few' },
  { value: 25, label: 'Some' },
  { value: 55, label: 'Steady' },
  { value: 85, label: 'Busy' },
];
const GRADE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'none', label: 'Straight' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'warm-film', label: 'Warm film' },
  { value: 'cool-editorial', label: 'Cool editorial' },
  { value: 'muted-matte', label: 'Muted matte' },
  { value: 'high-key', label: 'High key' },
  { value: 'deep-contrast', label: 'Deep contrast' },
  { value: 'bleach-bypass', label: 'Bleach bypass' },
];
const APERTURE_STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

export const Render3DPanel: React.FC<Render3DPanelProps> = ({
  showGenerationMode = true,
  accordionValue,
  onAccordionChange,
  accordionIdPrefix,
}) => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const wf = state.workflow;
  const settings = wf.render3d;
  const updateWf = (p: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload: p });
  const isRender3DWorkflow = state.mode === 'render-3d';
  const isEnhanceOnlyMode = isRender3DWorkflow && wf.renderMode === 'enhance';
  const hideManualLightingIntensityAndShadows = isRender3DWorkflow;

  React.useEffect(() => {
    if (isRender3DWorkflow && !RENDER_3D_GENERATION_MODES.includes(wf.renderMode)) {
      dispatch({ type: 'UPDATE_WORKFLOW', payload: { renderMode: DEFAULT_RENDER_GENERATION_MODE } });
    }
  }, [dispatch, isRender3DWorkflow, wf.renderMode]);

  const updateSection = (section: keyof Render3DSettings, updates: any) => {
    // `materials` is a list, not a record — spreading it into an object would
    // turn it into { 0: …, 1: … } and silently break the section.
    const next = Array.isArray(updates)
      ? updates
      : { ...(settings[section] as any), ...updates };
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        render3d: {
          ...settings,
          [section]: next
        }
      }
    });
  };

  const sectionId = (id: string) => (accordionIdPrefix ? `${accordionIdPrefix}${id}` : id);
  const generationModes = isRender3DWorkflow
    ? RENDER_3D_GENERATION_MODES
    : RENDER_GENERATION_MODES;
  const sourceModeCopy: Record<Render3DSourceMode, { label: string; desc: string }> = {
    'rerender': {
      label: t('render3dSettings.sourceMode.options.rerender.label', { defaultValue: 'Rerender' }),
      desc: t('render3dSettings.sourceMode.options.rerender.desc', { defaultValue: 'Use the original 3D/model screenshot and create a fresh render variation.' }),
    },
    'alter-rendering': {
      label: t('render3dSettings.sourceMode.options.alterRendering.label', { defaultValue: 'Alter rendering' }),
      desc: t('render3dSettings.sourceMode.options.alterRendering.desc', { defaultValue: 'Use the latest render and apply lighter style or lighting adjustments.' }),
    },
  };
  const sourceModeOptions = RENDER3D_SOURCE_MODES.map((mode) => ({
    value: mode,
    label: sourceModeCopy[mode].label,
  }));
  const generationModeCopy: Record<RenderGenerationMode, { label: string; desc: string }> = {
    'strict-realism': {
      label: t('render3dSettings.generationMode.options.strictRealism.label'),
      desc: t('render3dSettings.generationMode.options.strictRealism.desc'),
    },
    'enhance': {
      label: t('render3dSettings.generationMode.options.enhance.label'),
      desc: t('render3dSettings.generationMode.options.enhance.desc'),
    },
    'concept-push': {
      label: t('render3dSettings.generationMode.options.conceptPush.label'),
      desc: t('render3dSettings.generationMode.options.conceptPush.desc'),
    },
  };

  return (
    <div className="space-y-6">
      {isRender3DWorkflow && (
        <div>
          <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
            {t('render3dSettings.sourceMode.title', { defaultValue: 'Render Flow' })}
          </label>
          <SegmentedControl
            value={wf.render3dSourceMode}
            options={sourceModeOptions}
            onChange={(render3dSourceMode: Render3DSourceMode) => updateWf({ render3dSourceMode })}
            className="w-full"
          />
          <p className="mt-2 text-[10px] leading-relaxed text-foreground-muted">
            {sourceModeCopy[wf.render3dSourceMode].desc}
          </p>
        </div>
      )}

      {showGenerationMode && (
        <div>
          <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
            {t('render3dSettings.generationMode.title')}
          </label>
          <div className="space-y-1">
            {generationModes.map((mode) => (
              <VerticalCard
                key={mode}
                label={generationModeCopy[mode].label}
                description={generationModeCopy[mode].desc}
                selected={wf.renderMode === mode}
                onClick={() => updateWf({ renderMode: mode })}
              />
            ))}
          </div>
        </div>
      )}

      {!isEnhanceOnlyMode && (
      <Accordion
        items={[
          {
            id: sectionId('lighting'),
            title: t('render3dSettings.sections.lighting.title'),
            content: (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sun size={12} className="text-accent" />
                    <span className="inline-flex items-center">
                      {t('render3dSettings.sections.lighting.sunPosition')}
                    </span>
                  </span>
                  <Toggle
                    label=""
                    checked={settings.lighting.sun.enabled}
                    onChange={(v) => updateSection('lighting', { sun: { ...settings.lighting.sun, enabled: v } })}
                  />
                </div>

                {settings.lighting.sun.enabled && (
                  <div className="animate-fade-in">
                    <SunPositionWidget
                      azimuth={settings.lighting.sun.azimuth}
                      elevation={settings.lighting.sun.elevation}
                      helperText={t('render3dSettings.sections.lighting.lightSourceNote')}
                      onChange={(az, el) => updateSection('lighting', { sun: { ...settings.lighting.sun, azimuth: az, elevation: el } })}
                    />

                    {!hideManualLightingIntensityAndShadows && (
                      <SliderControl
                        label={t('render3dSettings.sections.lighting.intensity')}
                        value={settings.lighting.sun.intensity}
                        min={0}
                        max={200}
                        step={1}
                        unit="%"
                        onChange={(v) => updateSection('lighting', { sun: { ...settings.lighting.sun, intensity: v } })}
                      />
                    )}

                    <div className="mb-4">
                      <div className="flex justify-between items-baseline mb-2">
                        <label className="text-xs font-medium text-foreground">
                          {t('render3dSettings.sections.lighting.colorTemp')}
                        </label>
                        <span className="text-[10px] font-mono text-foreground-muted">{settings.lighting.sun.colorTemp}K</span>
                      </div>
                      <div className="h-4 w-full relative">
                        <div className="absolute inset-0 rounded-full overflow-hidden ring-1 ring-border" style={{ background: 'linear-gradient(90deg, #ff6b35, #ffd4a3, #ffffff, #9dc4ff)' }} />
                        <input
                          type="range"
                          min={2000}
                          max={12000}
                          step={100}
                          value={settings.lighting.sun.colorTemp}
                          onChange={(e) => updateSection('lighting', { sun: { ...settings.lighting.sun, colorTemp: parseInt(e.target.value) } })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        />
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-black/50 pointer-events-none"
                          style={{ left: `${((settings.lighting.sun.colorTemp - 2000) / 10000) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {!hideManualLightingIntensityAndShadows && (
                  <div className="border-t border-border-subtle pt-3 mt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-foreground-secondary inline-flex items-center">
                        {t('render3dSettings.sections.lighting.shadows.title')}
                      </span>
                      <Toggle
                        label=""
                        checked={settings.lighting.shadows.enabled}
                        onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, enabled: v } })}
                      />
                    </div>
                    {settings.lighting.shadows.enabled && (
                      <div className="space-y-3">
                        <SliderControl
                          label={t('render3dSettings.sections.lighting.shadows.opacity')}
                          value={settings.lighting.shadows.intensity}
                          min={0}
                          max={100}
                          step={1}
                          unit="%"
                          onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, intensity: v } })}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    {t('render3dSettings.sections.lighting.timeOfDay.label')}
                  </label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={settings.lighting.preset}
                    onChange={(e) => updateSection('lighting', { preset: e.target.value })}
                  >
                    <option value="pre-dawn">{t('render3dSettings.sections.lighting.timeOfDay.options.preDawn')}</option>
                    <option value="sunrise">{t('render3dSettings.sections.lighting.timeOfDay.options.sunrise')}</option>
                    <option value="early-morning">{t('render3dSettings.sections.lighting.timeOfDay.options.earlyMorning')}</option>
                    <option value="high-noon">{t('render3dSettings.sections.lighting.timeOfDay.options.highNoon')}</option>
                    <option value="late-afternoon">{t('render3dSettings.sections.lighting.timeOfDay.options.lateAfternoon')}</option>
                    <option value="golden-hour">{t('render3dSettings.sections.lighting.timeOfDay.options.goldenHour')}</option>
                    <option value="sunset-glow">{t('render3dSettings.sections.lighting.timeOfDay.options.sunsetGlow')}</option>
                    <option value="blue-hour">{t('render3dSettings.sections.lighting.timeOfDay.options.blueHour')}</option>
                    <option value="moonlit-night">{t('render3dSettings.sections.lighting.timeOfDay.options.moonlitNight')}</option>
                  </select>
                </div>
              </div>
            ),
          },
          {
            id: sectionId('atmosphere'),
            title: t('render3dSettings.sections.atmosphere.title'),
            content: (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                  {[
                    { id: 'natural', label: t('render3dSettings.sections.atmosphere.moods.natural') },
                    { id: 'warm', label: t('render3dSettings.sections.atmosphere.moods.warm') },
                    { id: 'cool', label: t('render3dSettings.sections.atmosphere.moods.cool') },
                    { id: 'dramatic', label: t('render3dSettings.sections.atmosphere.moods.dramatic') },
                    { id: 'soft', label: t('render3dSettings.sections.atmosphere.moods.soft') },
                    { id: 'moody', label: t('render3dSettings.sections.atmosphere.moods.moody') },
                    { id: 'luxury', label: t('render3dSettings.sections.atmosphere.moods.luxury') },
                    { id: 'cinematic', label: t('render3dSettings.sections.atmosphere.moods.cinematic') },
                    { id: 'hazy', label: t('render3dSettings.sections.atmosphere.moods.hazy') },
                    { id: 'crisp', label: t('render3dSettings.sections.atmosphere.moods.crisp') },
                    { id: 'stormy', label: t('render3dSettings.sections.atmosphere.moods.stormy') },
                    { id: 'noir', label: t('render3dSettings.sections.atmosphere.moods.noir') },
                  ].map(m => (
                    <button
                      key={m.id}
                      className={cn(
                        "py-2 px-1 text-[10px] font-bold border rounded transition-all",
                        settings.atmosphere.mood.includes(m.id)
                          ? "bg-surface-sunken text-foreground border-foreground/50"
                          : "bg-surface-elevated text-foreground-muted border-border hover:border-foreground-muted"
                      )}
                      onClick={() => updateSection('atmosphere', { mood: m.id })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 pt-2 border-t border-border-subtle mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                      <Wind size={12} />
                      <span className="inline-flex items-center">
                        {t('render3dSettings.sections.atmosphere.fog.title')}
                      </span>
                    </span>
                    <Toggle
                      label=""
                      checked={settings.atmosphere.fog.enabled}
                      onChange={(v) => updateSection('atmosphere', { fog: { ...settings.atmosphere.fog, enabled: v } })}
                    />
                  </div>
                  {settings.atmosphere.fog.enabled && (
                    <LevelControl
                      className="mb-0"
                      label={t('render3dSettings.sections.atmosphere.fog.density')}
                      value={settings.atmosphere.fog.density}
                      levels={FOG_LEVELS}
                      onChange={(v) => updateSection('atmosphere', { fog: { ...settings.atmosphere.fog, density: v } })}
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                      <Sparkle size={12} />
                      <span className="inline-flex items-center">
                        {t('render3dSettings.sections.atmosphere.bloom.title')}
                      </span>
                    </span>
                    <Toggle
                      label=""
                      checked={settings.atmosphere.bloom.enabled}
                      onChange={(v) => updateSection('atmosphere', { bloom: { ...settings.atmosphere.bloom, enabled: v } })}
                    />
                  </div>
                  {settings.atmosphere.bloom.enabled && (
                    <LevelControl
                      className="mb-0"
                      label={t('render3dSettings.sections.atmosphere.bloom.intensity')}
                      value={settings.atmosphere.bloom.intensity}
                      levels={BLOOM_LEVELS}
                      onChange={(v) => updateSection('atmosphere', { bloom: { ...settings.atmosphere.bloom, intensity: v } })}
                    />
                  )}
                </div>
              </div>
            ),
          },
          {
            id: sectionId('scenery'),
            title: t('render3dSettings.sections.scenery.title'),
            content: (
              <div>
                <div className="space-y-4">
                  <div className="bg-surface-elevated border border-border rounded p-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold flex items-center gap-2">
                        <User size={12} />
                        <span className="inline-flex items-center">
                          {t('render3dSettings.sections.scenery.people.title')}
                        </span>
                      </span>
                      <Toggle
                        label=""
                        checked={settings.scenery.people.enabled}
                        onChange={(v) => updateSection('scenery', { people: { ...settings.scenery.people, enabled: v } })}
                      />
                    </div>
                    {settings.scenery.people.enabled && (
                      <LevelControl
                        className="mb-0"
                        label={t('render3dSettings.sections.scenery.people.count')}
                        value={settings.scenery.people.count}
                        levels={PEOPLE_LEVELS}
                        onChange={(v) => updateSection('scenery', { people: { ...settings.scenery.people, count: v } })}
                      />
                    )}
                  </div>

                  <div className="bg-surface-elevated border border-border rounded p-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold flex items-center gap-2">
                        <Trees size={12} />
                        <span className="inline-flex items-center">
                          {t('render3dSettings.sections.scenery.vegetation.title')}
                        </span>
                      </span>
                      <Toggle
                        label=""
                        checked={settings.scenery.trees.enabled}
                        onChange={(v) => updateSection('scenery', { trees: { ...settings.scenery.trees, enabled: v } })}
                      />
                    </div>
                    {settings.scenery.trees.enabled && (
                      <LevelControl
                        className="mb-0"
                        label={t('render3dSettings.sections.scenery.vegetation.density')}
                        value={settings.scenery.trees.count}
                        levels={VEGETATION_LEVELS}
                        onChange={(v) => updateSection('scenery', { trees: { ...settings.scenery.trees, count: v } })}
                      />
                    )}
                  </div>

                  <div className="bg-surface-elevated border border-border rounded p-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold flex items-center gap-2">
                        <Car size={12} />
                        <span className="inline-flex items-center">
                          {t('render3dSettings.sections.scenery.vehicles.title')}
                        </span>
                      </span>
                      <Toggle
                        label=""
                        checked={settings.scenery.cars.enabled}
                        onChange={(v) => updateSection('scenery', { cars: { ...settings.scenery.cars, enabled: v } })}
                      />
                    </div>
                    {settings.scenery.cars.enabled && (
                      <LevelControl
                        className="mb-0"
                        label={t('render3dSettings.sections.scenery.vehicles.count')}
                        value={settings.scenery.cars.count}
                        levels={VEHICLE_LEVELS}
                        onChange={(v) => updateSection('scenery', { cars: { ...settings.scenery.cars, count: v } })}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    {t('render3dSettings.sections.scenery.contextPreset.label')}
                  </label>
                  <select
                    className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    value={settings.scenery.preset}
                    onChange={(e) => updateSection('scenery', { preset: e.target.value })}
                  >
                    <optgroup label={t('render3dSettings.sections.scenery.contextPreset.groups.terminalPublic')}>
                      <option value="departure-hall">{t('render3dSettings.sections.scenery.contextPreset.options.departureHall')}</option>
                      <option value="arrivals-hall">{t('render3dSettings.sections.scenery.contextPreset.options.arrivalsHall')}</option>
                      <option value="check-in-counter">{t('render3dSettings.sections.scenery.contextPreset.options.checkInCounter')}</option>
                      <option value="ticketing-area">{t('render3dSettings.sections.scenery.contextPreset.options.ticketingArea')}</option>
                      <option value="main-concourse">{t('render3dSettings.sections.scenery.contextPreset.options.mainConcourse')}</option>
                      <option value="terminal-atrium">{t('render3dSettings.sections.scenery.contextPreset.options.terminalAtrium')}</option>
                    </optgroup>
                    <optgroup label={t('render3dSettings.sections.scenery.contextPreset.groups.securityProcessing')}>
                      <option value="security-checkpoint">{t('render3dSettings.sections.scenery.contextPreset.options.securityCheckpoint')}</option>
                      <option value="passport-control">{t('render3dSettings.sections.scenery.contextPreset.options.passportControl')}</option>
                      <option value="customs-hall">{t('render3dSettings.sections.scenery.contextPreset.options.customsHall')}</option>
                      <option value="immigration-area">{t('render3dSettings.sections.scenery.contextPreset.options.immigrationArea')}</option>
                      <option value="tsa-screening">{t('render3dSettings.sections.scenery.contextPreset.options.tsaScreening')}</option>
                    </optgroup>
                    <optgroup label={t('render3dSettings.sections.scenery.contextPreset.groups.waitingLounges')}>
                      <option value="gate-waiting-area">{t('render3dSettings.sections.scenery.contextPreset.options.gateWaitingArea')}</option>
                      <option value="business-class-lounge">{t('render3dSettings.sections.scenery.contextPreset.options.businessClassLounge')}</option>
                      <option value="first-class-lounge">{t('render3dSettings.sections.scenery.contextPreset.options.firstClassLounge')}</option>
                      <option value="airline-lounge">{t('render3dSettings.sections.scenery.contextPreset.options.airlineLounge')}</option>
                      <option value="transit-lounge">{t('render3dSettings.sections.scenery.contextPreset.options.transitLounge')}</option>
                      <option value="family-waiting-area">{t('render3dSettings.sections.scenery.contextPreset.options.familyWaitingArea')}</option>
                    </optgroup>
                    <optgroup label={t('render3dSettings.sections.scenery.contextPreset.groups.baggage')}>
                      <option value="baggage-claim">{t('render3dSettings.sections.scenery.contextPreset.options.baggageClaim')}</option>
                      <option value="baggage-dropoff">{t('render3dSettings.sections.scenery.contextPreset.options.baggageDropoff')}</option>
                      <option value="oversized-baggage">{t('render3dSettings.sections.scenery.contextPreset.options.oversizedBaggage')}</option>
                      <option value="lost-baggage-office">{t('render3dSettings.sections.scenery.contextPreset.options.lostBaggageOffice')}</option>
                    </optgroup>
                    <optgroup label={t('render3dSettings.sections.scenery.contextPreset.groups.retailDining')}>
                      <option value="duty-free-shop">{t('render3dSettings.sections.scenery.contextPreset.options.dutyFreeShop')}</option>
                      <option value="food-court">{t('render3dSettings.sections.scenery.contextPreset.options.foodCourt')}</option>
                      <option value="restaurant-bar">{t('render3dSettings.sections.scenery.contextPreset.options.restaurantBar')}</option>
                      <option value="retail-corridor">{t('render3dSettings.sections.scenery.contextPreset.options.retailCorridor')}</option>
                      <option value="newsstand">{t('render3dSettings.sections.scenery.contextPreset.options.newsstand')}</option>
                    </optgroup>
                    <optgroup label={t('render3dSettings.sections.scenery.contextPreset.groups.transportAccess')}>
                      <option value="jet-bridge-gate">{t('render3dSettings.sections.scenery.contextPreset.options.jetBridgeGate')}</option>
                      <option value="bus-gate-area">{t('render3dSettings.sections.scenery.contextPreset.options.busGateArea')}</option>
                      <option value="ground-transportation">{t('render3dSettings.sections.scenery.contextPreset.options.groundTransportation')}</option>
                      <option value="taxi-rideshare-pickup">{t('render3dSettings.sections.scenery.contextPreset.options.taxiRidesharePickup')}</option>
                      <option value="parking-garage">{t('render3dSettings.sections.scenery.contextPreset.options.parkingGarage')}</option>
                      <option value="rental-car-center">{t('render3dSettings.sections.scenery.contextPreset.options.rentalCarCenter')}</option>
                    </optgroup>
                    <optgroup label={t('render3dSettings.sections.scenery.contextPreset.groups.operationsSupport')}>
                      <option value="information-desk">{t('render3dSettings.sections.scenery.contextPreset.options.informationDesk')}</option>
                      <option value="airport-office">{t('render3dSettings.sections.scenery.contextPreset.options.airportOffice')}</option>
                      <option value="control-tower-exterior">{t('render3dSettings.sections.scenery.contextPreset.options.controlTowerExterior')}</option>
                      <option value="maintenance-hangar">{t('render3dSettings.sections.scenery.contextPreset.options.maintenanceHangar')}</option>
                      <option value="cargo-terminal">{t('render3dSettings.sections.scenery.contextPreset.options.cargoTerminal')}</option>
                    </optgroup>
                    <optgroup label={t('render3dSettings.sections.scenery.contextPreset.groups.exterior')}>
                      <option value="terminal-curbside">{t('render3dSettings.sections.scenery.contextPreset.options.terminalCurbside')}</option>
                      <option value="runway-view">{t('render3dSettings.sections.scenery.contextPreset.options.runwayView')}</option>
                      <option value="apron-tarmac">{t('render3dSettings.sections.scenery.contextPreset.options.apronTarmac')}</option>
                      <option value="airport-entry-plaza">{t('render3dSettings.sections.scenery.contextPreset.options.airportEntryPlaza')}</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            ),
          },
          {
            id: sectionId('color'),
            title: t('render3dSettings.sections.color.title', { defaultValue: 'Colour & Grade' }),
            content: (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-foreground-secondary">
                    {t('render3dSettings.sections.color.enable', { defaultValue: 'Control colour' })}
                  </span>
                  <Toggle
                    label=""
                    checked={settings.color.enabled}
                    onChange={(v) => updateSection('color', { ...settings.color, enabled: v })}
                  />
                </div>

                {settings.color.enabled && (
                  <div className="animate-fade-in space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-foreground">
                        {t('render3dSettings.sections.color.palette', { defaultValue: 'Palette anchors' })}
                      </span>
                      <Toggle
                        label=""
                        checked={settings.color.paletteEnabled}
                        onChange={(v) => updateSection('color', { ...settings.color, paletteEnabled: v })}
                      />
                    </div>

                    {settings.color.paletteEnabled && (
                      <div className="grid grid-cols-2 gap-3 pb-1">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wide text-foreground-muted block">
                            {t('render3dSettings.sections.color.dominant', { defaultValue: 'Dominant' })}
                          </label>
                          <ColorPicker
                            color={settings.color.dominant}
                            onChange={(c) => updateSection('color', { ...settings.color, dominant: c })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wide text-foreground-muted block">
                            {t('render3dSettings.sections.color.accent', { defaultValue: 'Accent' })}
                          </label>
                          <ColorPicker
                            color={settings.color.accent}
                            onChange={(c) => updateSection('color', { ...settings.color, accent: c })}
                          />
                        </div>
                      </div>
                    )}

                    <div className="border-t border-border-subtle pt-3">
                      <SliderControl
                        label={t('render3dSettings.sections.color.whiteBalance', { defaultValue: 'White balance' })}
                        value={settings.color.whiteBalance}
                        min={-100}
                        max={100}
                        step={5}
                        onChange={(v) => updateSection('color', { ...settings.color, whiteBalance: v })}
                      />
                      <SliderControl
                        label={t('render3dSettings.sections.color.saturation', { defaultValue: 'Saturation' })}
                        value={settings.color.saturation}
                        min={-100}
                        max={100}
                        step={5}
                        onChange={(v) => updateSection('color', { ...settings.color, saturation: v })}
                      />
                      <SliderControl
                        label={t('render3dSettings.sections.color.contrast', { defaultValue: 'Contrast' })}
                        value={settings.color.contrast}
                        min={-100}
                        max={100}
                        step={5}
                        onChange={(v) => updateSection('color', { ...settings.color, contrast: v })}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground mb-1.5 block">
                        {t('render3dSettings.sections.color.grade', { defaultValue: 'Grade' })}
                      </label>
                      <select
                        className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                        value={settings.color.grade}
                        onChange={(e) => updateSection('color', { ...settings.color, grade: e.target.value as Render3DGrade })}
                      >
                        {GRADE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: sectionId('camera'),
            title: t('render3dSettings.sections.camera.title', { defaultValue: 'Camera' }),
            content: (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-foreground-secondary">
                    {t('render3dSettings.sections.camera.enable', { defaultValue: 'Specify the lens' })}
                  </span>
                  <Toggle
                    label=""
                    checked={settings.camera.enabled}
                    onChange={(v) => updateSection('camera', { ...settings.camera, enabled: v })}
                  />
                </div>

                {settings.camera.enabled && (
                  <div className="animate-fade-in">
                    <SliderControl
                      label={t('render3dSettings.sections.camera.focalLength', { defaultValue: 'Focal length' })}
                      value={settings.camera.focalLength}
                      min={14}
                      max={200}
                      step={1}
                      unit="mm"
                      onChange={(v) => updateSection('camera', { ...settings.camera, focalLength: v })}
                    />
                    <SliderControl
                      label={t('render3dSettings.sections.camera.eyeHeight', { defaultValue: 'Camera height' })}
                      value={settings.camera.eyeHeight}
                      min={20}
                      max={400}
                      step={5}
                      unit="cm"
                      onChange={(v) => updateSection('camera', { ...settings.camera, eyeHeight: v })}
                    />
                    <div className="mb-3 space-y-2">
                      <div className="flex justify-between items-baseline">
                        <label className="text-xs font-medium text-foreground">
                          {t('render3dSettings.sections.camera.aperture', { defaultValue: 'Aperture' })}
                        </label>
                        <span className="text-[10px] font-mono text-foreground-muted">f/{settings.camera.aperture}</span>
                      </div>
                      <div className="flex gap-1">
                        {APERTURE_STOPS.map((stop) => (
                          <button
                            key={stop}
                            type="button"
                            aria-pressed={settings.camera.aperture === stop}
                            onClick={() => updateSection('camera', { ...settings.camera, aperture: stop })}
                            className={cn(
                              'flex-1 text-[9px] leading-none py-1.5 rounded border transition-colors',
                              settings.camera.aperture === stop
                                ? 'bg-foreground text-background border-foreground font-medium'
                                : 'bg-surface-elevated border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted'
                            )}
                          >
                            {stop}
                          </button>
                        ))}
                      </div>
                    </div>
                    <SliderControl
                      label={t('render3dSettings.sections.camera.exposure', { defaultValue: 'Exposure' })}
                      value={settings.camera.exposure}
                      min={-100}
                      max={100}
                      step={5}
                      onChange={(v) => updateSection('camera', { ...settings.camera, exposure: v })}
                    />
                  </div>
                )}
              </div>
            ),
          },
          {
            id: sectionId('materials'),
            title: t('render3dSettings.sections.materials.title', { defaultValue: 'Material Overrides' }),
            content: (
              <div className="space-y-3">
                <p className="text-[10px] leading-relaxed text-foreground-muted">
                  {t('render3dSettings.sections.materials.hint', {
                    defaultValue: 'Name a part of the building and pick what it should be made of. These override the material implied by the style or the source model.',
                  })}
                </p>

                {settings.materials.map((override) => (
                  <div key={override.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={override.element}
                      placeholder={t('render3dSettings.sections.materials.elementPlaceholder', { defaultValue: 'facade, floor, soffit…' })}
                      onChange={(e) => updateSection('materials', settings.materials.map((entry) =>
                        entry.id === override.id ? { ...entry, element: e.target.value } : entry
                      ))}
                      className="flex-1 min-w-0 bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                    />
                    <select
                      value={override.materialId}
                      onChange={(e) => updateSection('materials', settings.materials.map((entry) =>
                        entry.id === override.id ? { ...entry, materialId: e.target.value } : entry
                      ))}
                      className="flex-1 min-w-0 bg-surface-elevated border border-border rounded text-xs h-8 px-1"
                    >
                      <option value="">{t('render3dSettings.sections.materials.pick', { defaultValue: 'Material…' })}</option>
                      {MATERIAL_SWATCHES.map((swatch) => (
                        <option key={swatch.id} value={swatch.id}>{swatch.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={t('render3dSettings.sections.materials.remove', { defaultValue: 'Remove assignment' })}
                      onClick={() => updateSection('materials', settings.materials.filter((entry) => entry.id !== override.id))}
                      className="shrink-0 w-7 h-8 rounded border border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => updateSection('materials', [
                    ...settings.materials,
                    { id: `mat-${Date.now()}`, element: '', materialId: '' },
                  ])}
                  className="w-full text-[11px] py-2 rounded border border-dashed border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted transition-colors"
                >
                  {t('render3dSettings.sections.materials.add', { defaultValue: '+ Assign a material' })}
                </button>
              </div>
            ),
          },
          {
            id: sectionId('control'),
            title: t('render3dSettings.sections.control.title', { defaultValue: 'Source & Exclusions' }),
            content: (
              <div>
                <SliderControl
                  label={t('render3dSettings.sections.control.adherence', { defaultValue: 'Source adherence' })}
                  value={settings.control.adherence}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                  onChange={(v) => updateSection('control', { ...settings.control, adherence: v })}
                />
                <p className="text-[10px] leading-relaxed text-foreground-muted -mt-1 mb-4">
                  {settings.control.adherence >= 90
                    ? t('render3dSettings.sections.control.adherenceMax', { defaultValue: 'Trace the model exactly. Only surface, light and atmosphere are interpreted.' })
                    : settings.control.adherence >= 45
                      ? t('render3dSettings.sections.control.adherenceMid', { defaultValue: 'Keep massing, layout and camera. Detailing and materials may be interpreted.' })
                      : t('render3dSettings.sections.control.adherenceLow', { defaultValue: 'Use the model as a scaffold. Expect real reinterpretation.' })}
                </p>

                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  {t('render3dSettings.sections.control.negative', { defaultValue: 'Keep out of the image' })}
                </label>
                <textarea
                  value={settings.control.negativePrompt}
                  onChange={(e) => updateSection('control', { ...settings.control, negativePrompt: e.target.value })}
                  placeholder={t('render3dSettings.sections.control.negativePlaceholder', { defaultValue: 'lens flare, visible watermarks, distorted signage…' })}
                  rows={2}
                  className="w-full bg-surface-elevated border border-border rounded text-xs p-2 resize-none leading-relaxed"
                />
              </div>
            ),
          },
          {
            id: sectionId('render'),
            title: t('render3dSettings.sections.render.title'),
            content: (
              <div>
                <div className="mb-4">
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    {t('render3dSettings.sections.render.aspectRatio')}
                  </label>
                  <SegmentedControl
                    value={settings.render.aspectRatio}
                    options={[
                      { label: '16:9', value: '16:9' },
                      { label: '4:3', value: '4:3' },
                      { label: '3:2', value: '3:2' },
                      { label: '1:1', value: '1:1' },
                      { label: '21:9', value: '21:9' },
                      { label: '9:16', value: '9:16' },
                    ]}
                    onChange={(v) => updateSection('render', { aspectRatio: v })}
                  />
                </div>
              </div>
            )
          }
        ]}
        value={accordionValue}
        onValueChange={onAccordionChange}
      />
      )}
    </div>
  );
};
