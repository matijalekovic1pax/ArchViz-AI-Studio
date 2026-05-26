import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Sun, User, Wind, Sparkle, Car, Trees } from 'lucide-react';
import { SliderControl, VerticalCard, SunPositionWidget } from './SharedRightComponents';
import { cn } from '../../../lib/utils';
import { RENDER_GENERATION_MODES, Render3DSettings, RenderGenerationMode } from '../../../types';

interface Render3DPanelProps {
  showGenerationMode?: boolean;
  accordionValue?: string | null;
  onAccordionChange?: (value: string | null) => void;
  accordionIdPrefix?: string;
}

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

  const updateSection = (section: keyof Render3DSettings, updates: any) => {
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        render3d: {
          ...settings,
          [section]: { ...settings[section], ...updates }
        }
      }
    });
  };

  const sectionId = (id: string) => (accordionIdPrefix ? `${accordionIdPrefix}${id}` : id);
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
      {showGenerationMode && (
        <div>
          <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
            {t('render3dSettings.generationMode.title')}
          </label>
          <div className="space-y-1">
            {RENDER_GENERATION_MODES.map((mode) => (
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
                      onChange={(az, el) => updateSection('lighting', { sun: { ...settings.lighting.sun, azimuth: az, elevation: el } })}
                    />

                    <SliderControl
                      label={t('render3dSettings.sections.lighting.intensity')}
                      value={settings.lighting.sun.intensity}
                      min={0}
                      max={200}
                      step={1}
                      unit="%"
                      onChange={(v) => updateSection('lighting', { sun: { ...settings.lighting.sun, intensity: v } })}
                    />

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
                      <SliderControl
                        label={t('render3dSettings.sections.lighting.shadows.softness')}
                        value={settings.lighting.shadows.softness}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, softness: v } })}
                      />
                    </div>
                  )}
                </div>

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

                <SliderControl
                  label={t('render3dSettings.sections.atmosphere.temperature')}
                  value={settings.atmosphere.temp}
                  min={-100}
                  max={100}
                  step={1}
                  onChange={(v) => updateSection('atmosphere', { temp: v })}
                />

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
                    <SliderControl
                      className="mb-0"
                      label={t('render3dSettings.sections.atmosphere.fog.density')}
                      value={settings.atmosphere.fog.density}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
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
                    <SliderControl
                      className="mb-0"
                      label={t('render3dSettings.sections.atmosphere.bloom.intensity')}
                      value={settings.atmosphere.bloom.intensity}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
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
                      <SliderControl
                        className="mb-0"
                        label={t('render3dSettings.sections.scenery.people.count')}
                        value={settings.scenery.people.count}
                        min={0}
                        max={100}
                        step={1}
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
                      <SliderControl
                        className="mb-0"
                        label={t('render3dSettings.sections.scenery.vegetation.density')}
                        value={settings.scenery.trees.count}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
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
                      <SliderControl
                        className="mb-0"
                        label={t('render3dSettings.sections.scenery.vehicles.count')}
                        value={settings.scenery.cars.count}
                        min={0}
                        max={50}
                        step={1}
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
    </div>
  );
};
