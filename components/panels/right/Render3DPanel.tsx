
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import {
  Lock, Sun, User, Droplets, Wind, Sparkle, Car, Trees
} from 'lucide-react';
import { SliderControl, VerticalCard, SunPositionWidget } from './SharedRightComponents';
import { cn } from '../../../lib/utils';
import { Render3DSettings } from '../../../types';

interface Render3DPanelProps {
  showGenerationMode?: boolean;
  includeCamera?: boolean;
  accordionValue?: string | null;
  onAccordionChange?: (value: string | null) => void;
  accordionIdPrefix?: string;
}

export const Render3DPanel: React.FC<Render3DPanelProps> = ({
    showGenerationMode = true,
    includeCamera = true,
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
    const materialEmphasisOptions = [
      { key: 'concrete', label: t('render3dSettings.materials.emphasis.concrete') },
      { key: 'wood', label: t('render3dSettings.materials.emphasis.wood') },
      { key: 'metal', label: t('render3dSettings.materials.emphasis.metal') },
      { key: 'glass', label: t('render3dSettings.materials.emphasis.glass') },
      { key: 'stone', label: t('render3dSettings.materials.emphasis.stone') },
      { key: 'brick', label: t('render3dSettings.materials.emphasis.brick') },
      { key: 'tile', label: t('render3dSettings.materials.emphasis.tile') },
      { key: 'fabric', label: t('render3dSettings.materials.emphasis.fabric') },
      { key: 'paint', label: t('render3dSettings.materials.emphasis.paint') },
      { key: 'flooring', label: t('render3dSettings.materials.emphasis.flooring') }
    ];
    const sectionId = (id: string) => (accordionIdPrefix ? `${accordionIdPrefix}${id}` : id);

    return (
        <div className="space-y-6">
            {/* Generation Mode */}
            {showGenerationMode && (
                <div>
                    <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
                      {t('render3dSettings.generationMode.title')}
                    </label>
                    <div className="space-y-1">
                        {[
                            { id: 'enhance', label: t('render3dSettings.generationMode.options.enhance.label'), desc: t('render3dSettings.generationMode.options.enhance.desc') },
                            { id: 'stylize', label: t('render3dSettings.generationMode.options.stylize.label'), desc: t('render3dSettings.generationMode.options.stylize.desc') },
                            { id: 'hybrid', label: t('render3dSettings.generationMode.options.hybrid.label'), desc: t('render3dSettings.generationMode.options.hybrid.desc') },
                            { id: 'strict-realism', label: t('render3dSettings.generationMode.options.strictRealism.label'), desc: t('render3dSettings.generationMode.options.strictRealism.desc') },
                            { id: 'concept-push', label: t('render3dSettings.generationMode.options.conceptPush.label'), desc: t('render3dSettings.generationMode.options.conceptPush.desc') },
                        ].map(m => (
                            <VerticalCard 
                                key={m.id} 
                                label={m.label} 
                                description={m.desc} 
                                selected={wf.renderMode === m.id} 
                                onClick={() => updateWf({ renderMode: m.id as any })} 
                            />
                        ))}
                    </div>
                </div>
            )}

            <Accordion
              items={[
                // 1. GEOMETRY
                { id: sectionId('geometry'), title: t('render3dSettings.sections.geometry.title'), content: (
                    <div>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            {t('render3dSettings.sections.geometry.edgeMode.label')}
                          </label>
                          <SegmentedControl 
                             value={settings.geometry.edgeMode}
                             options={[
                                {label: t('render3dSettings.sections.geometry.edgeMode.soft'), value: 'soft'}, 
                                {label: t('render3dSettings.sections.geometry.edgeMode.medium'), value: 'medium'}, 
                                {label: t('render3dSettings.sections.geometry.edgeMode.sharp'), value: 'sharp'}
                             ]}
                             onChange={(v) => updateSection('geometry', { edgeMode: v })}
                          />
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                               <Lock size={12}/>
                               <span className="inline-flex items-center">
                                 {t('render3dSettings.sections.geometry.preservation.title')}
                               </span>
                             </span>
                          </div>
                          
                          <div className="space-y-4">
                             <Toggle 
                                label={t('render3dSettings.sections.geometry.preservation.strict')} 
                                checked={settings.geometry.strictPreservation} 
                                onChange={(v) => updateSection('geometry', { strictPreservation: v })} 
                             />
                             
                             {!settings.geometry.strictPreservation && (
                                <div className="animate-fade-in pl-2 border-l-2 border-border-subtle">
                                   <SliderControl 
                                      label={t('render3dSettings.sections.geometry.preservation.alteration')} 
                                      value={settings.geometry.geometryFreedom} 
                                      min={0} 
                                      max={100} 
                                      step={1} 
                                      unit="%" 
                                      onChange={(v) => updateSection('geometry', { geometryFreedom: v })} 
                                   />
                                   <p className="text-[9px] text-foreground-muted mt-1 leading-normal">
                                      {t('render3dSettings.sections.geometry.preservation.alterationHint')}
                                   </p>
                                </div>
                             )}
                          </div>
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            {t('render3dSettings.sections.geometry.detailLevel.label')}
                          </label>
                          <SegmentedControl 
                             value={settings.geometry.lod.level}
                             options={[
                                { label: t('render3dSettings.sections.geometry.detailLevel.low'), value: 'low' },
                                { label: t('render3dSettings.sections.geometry.detailLevel.medium'), value: 'medium' },
                                { label: t('render3dSettings.sections.geometry.detailLevel.high'), value: 'high' }
                             ]}
                             onChange={(v) => updateSection('geometry', { lod: { ...settings.geometry.lod, level: v } })}
                          />

                          <div className="mt-3 space-y-2">
                             <Toggle 
                                label={t('render3dSettings.sections.geometry.detailLevel.preserveOrnaments')} 
                                checked={settings.geometry.lod.preserveOrnaments} 
                                onChange={(v) => updateSection('geometry', { lod: { ...settings.geometry.lod, preserveOrnaments: v } })} 
                             />
                             <Toggle 
                                label={t('render3dSettings.sections.geometry.detailLevel.preserveMoldings')} 
                                checked={settings.geometry.lod.preserveMoldings} 
                                onChange={(v) => updateSection('geometry', { lod: { ...settings.geometry.lod, preserveMoldings: v } })} 
                             />
                             <Toggle 
                                label={t('render3dSettings.sections.geometry.detailLevel.preserveTrim')} 
                                checked={settings.geometry.lod.preserveTrim} 
                                onChange={(v) => updateSection('geometry', { lod: { ...settings.geometry.lod, preserveTrim: v } })} 
                             />
                          </div>
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-foreground-secondary inline-flex items-center">
                               {t('render3dSettings.sections.geometry.smoothing.title')}
                             </span>
                             <Toggle 
                                label="" 
                                checked={settings.geometry.smoothing.enabled} 
                                onChange={(v) => updateSection('geometry', { smoothing: { ...settings.geometry.smoothing, enabled: v } })} 
                             />
                          </div>

                          {settings.geometry.smoothing.enabled && (
                             <div className="space-y-3 animate-fade-in">
                                <SliderControl 
                                   label={t('render3dSettings.sections.geometry.smoothing.intensity')} 
                                   value={settings.geometry.smoothing.intensity} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { smoothing: { ...settings.geometry.smoothing, intensity: v } })} 
                                />
                                <Toggle 
                                   label={t('render3dSettings.sections.geometry.smoothing.preserveHardEdges')} 
                                   checked={settings.geometry.smoothing.preserveHardEdges} 
                                   onChange={(v) => updateSection('geometry', { smoothing: { ...settings.geometry.smoothing, preserveHardEdges: v } })} 
                                />
                                {settings.geometry.smoothing.preserveHardEdges && (
                                   <div className="pl-2 border-l-2 border-border-subtle">
                                      <SliderControl 
                                         label={t('render3dSettings.sections.geometry.smoothing.edgeThreshold')} 
                                         value={settings.geometry.smoothing.threshold} 
                                         min={0} 
                                         max={90} 
                                         step={1} 
                                         unit={t('common.degrees')} 
                                         onChange={(v) => updateSection('geometry', { smoothing: { ...settings.geometry.smoothing, threshold: v } })} 
                                      />
                                      <p className="text-[9px] text-foreground-muted mt-1 leading-normal">
                                         {t('render3dSettings.sections.geometry.smoothing.edgeThresholdHint')}
                                      </p>
                                   </div>
                                )}
                             </div>
                          )}
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-foreground-secondary inline-flex items-center">
                               {t('render3dSettings.sections.geometry.depthLayers.title')}
                             </span>
                             <Toggle 
                                label="" 
                                checked={settings.geometry.depthLayers.enabled} 
                                onChange={(v) => updateSection('geometry', { depthLayers: { ...settings.geometry.depthLayers, enabled: v } })} 
                             />
                          </div>

                          {settings.geometry.depthLayers.enabled && (
                             <div className="space-y-2 animate-fade-in">
                                <SliderControl 
                                   label={t('render3dSettings.sections.geometry.depthLayers.foreground')} 
                                   value={settings.geometry.depthLayers.foreground} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { depthLayers: { ...settings.geometry.depthLayers, foreground: v } })} 
                                />
                                <SliderControl 
                                   label={t('render3dSettings.sections.geometry.depthLayers.midground')} 
                                   value={settings.geometry.depthLayers.midground} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { depthLayers: { ...settings.geometry.depthLayers, midground: v } })} 
                                />
                                <SliderControl 
                                   label={t('render3dSettings.sections.geometry.depthLayers.background')} 
                                   value={settings.geometry.depthLayers.background} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { depthLayers: { ...settings.geometry.depthLayers, background: v } })} 
                                />
                             </div>
                          )}
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-foreground-secondary inline-flex items-center">
                               {t('render3dSettings.sections.geometry.displacement.title')}
                             </span>
                             <Toggle 
                                label="" 
                                checked={settings.geometry.displacement.enabled} 
                                onChange={(v) => updateSection('geometry', { displacement: { ...settings.geometry.displacement, enabled: v } })} 
                             />
                          </div>

                          {settings.geometry.displacement.enabled && (
                             <div className="space-y-3 animate-fade-in">
                                <SliderControl 
                                   label={t('render3dSettings.sections.geometry.displacement.strength')} 
                                   value={settings.geometry.displacement.strength} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { displacement: { ...settings.geometry.displacement, strength: v } })} 
                                />
                                <div>
                                   <label className="text-xs font-medium text-foreground mb-1.5 block">
                                     {t('render3dSettings.sections.geometry.displacement.scale')}
                                   </label>
                                   <SegmentedControl 
                                      value={settings.geometry.displacement.scale}
                                      options={[
                                         { label: t('render3dSettings.sections.geometry.displacement.fine'), value: 'fine' },
                                         { label: t('render3dSettings.sections.geometry.displacement.medium'), value: 'medium' },
                                         { label: t('render3dSettings.sections.geometry.displacement.coarse'), value: 'coarse' }
                                      ]}
                                      onChange={(v) => updateSection('geometry', { displacement: { ...settings.geometry.displacement, scale: v } })}
                                   />
                                </div>
                                <div>
                                   <Toggle 
                                      label={t('render3dSettings.sections.geometry.displacement.adaptToMaterial')} 
                                      checked={settings.geometry.displacement.adaptToMaterial} 
                                      onChange={(v) => updateSection('geometry', { displacement: { ...settings.geometry.displacement, adaptToMaterial: v } })} 
                                   />
                                   <p className="text-[9px] text-foreground-muted mt-1 leading-normal">
                                      {t('render3dSettings.sections.geometry.displacement.adaptHint')}
                                   </p>
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                )},

                // 2. LIGHTING
                { id: sectionId('lighting'), title: t('render3dSettings.sections.lighting.title'), content: (
                    <div>
                       
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Sun size={12} className="text-accent"/>
                            <span className="inline-flex items-center">
                              {t('render3dSettings.sections.lighting.sunPosition')}
                            </span>
                          </span>
                          <Toggle label="" checked={settings.lighting.sun.enabled} onChange={(v) => updateSection('lighting', { sun: { ...settings.lighting.sun, enabled: v } })} />
                       </div>
                       
                       {settings.lighting.sun.enabled && (
                          <div className="animate-fade-in">
                             <SunPositionWidget 
                                azimuth={settings.lighting.sun.azimuth} 
                                elevation={settings.lighting.sun.elevation}
                                onChange={(az, el) => updateSection('lighting', { sun: { ...settings.lighting.sun, azimuth: az, elevation: el } })}
                             />
                             
                             <SliderControl label={t('render3dSettings.sections.lighting.intensity')} value={settings.lighting.sun.intensity} min={0} max={200} step={1} unit="%" onChange={(v) => updateSection('lighting', { sun: { ...settings.lighting.sun, intensity: v } })} />
                             
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
                                      min={2000} max={12000} step={100} 
                                      value={settings.lighting.sun.colorTemp} 
                                      onChange={(e) => updateSection('lighting', { sun: { ...settings.lighting.sun, colorTemp: parseInt(e.target.value) } })}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                   />
                                   {/* Thumb Indicator */}
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
                             <Toggle label="" checked={settings.lighting.shadows.enabled} onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, enabled: v } })} />
                          </div>
                          {settings.lighting.shadows.enabled && (
                             <div className="space-y-3">
                                <SliderControl label={t('render3dSettings.sections.lighting.shadows.opacity')} value={settings.lighting.shadows.intensity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, intensity: v } })} />
                                <SliderControl label={t('render3dSettings.sections.lighting.shadows.softness')} value={settings.lighting.shadows.softness} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, softness: v } })} />
                             </div>
                          )}
                       </div>

                       <div className="mt-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">{t('render3dSettings.sections.lighting.timeOfDay.label')}</label>
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
                )},

                ...(includeCamera ? [
                  // 3. CAMERA
                  { id: sectionId('camera'), title: t('render3dSettings.sections.camera.title'), content: (
                    <div>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            {t('render3dSettings.sections.camera.lens')}
                          </label>
                          <div className="flex gap-1 bg-surface-sunken p-1 rounded-md">
                             {[12, 16, 24, 35, 50, 85].map(mm => (
                                <button
                                   key={mm}
                                   onClick={() => updateSection('camera', { lens: mm, fov: Math.round(2 * Math.atan(36/(2*mm)) * (180/Math.PI)) })}
                                   className={cn(
                                      "flex-1 py-1 text-[9px] font-mono rounded transition-colors",
                                      settings.camera.lens === mm ? "bg-white shadow-sm text-foreground font-bold" : "text-foreground-muted hover:text-foreground"
                                   )}
                                >
                                   {mm}
                                </button>
                             ))}
                          </div>
                       </div>

                       <SliderControl label={t('render3dSettings.sections.camera.fieldOfView')} value={settings.camera.fov} min={10} max={120} step={1} unit={t('common.degrees')} onChange={(v) => updateSection('camera', { fov: v })} />
                       
                       <div className="space-y-1 pt-2 border-t border-border-subtle">
                          <Toggle label={t('render3dSettings.sections.camera.autoCorrectPerspective')} checked={settings.camera.autoCorrect} onChange={(v) => updateSection('camera', { autoCorrect: v })} />
                          <Toggle label={t('render3dSettings.sections.camera.depthOfField')} checked={settings.camera.dof.enabled} onChange={(v) => updateSection('camera', { dof: { ...settings.camera.dof, enabled: v } })} />
                          
                          {settings.camera.dof.enabled && (
                             <div className="pl-2 border-l-2 border-border-subtle mt-2 space-y-2 animate-fade-in">
                                <SliderControl label={t('render3dSettings.sections.camera.aperture')} value={settings.camera.dof.aperture} min={1.4} max={22} step={0.1} unit="f/" onChange={(v) => updateSection('camera', { dof: { ...settings.camera.dof, aperture: v } })} />
                                <SliderControl label={t('render3dSettings.sections.camera.focusDistance')} value={settings.camera.dof.focusDist} min={0.5} max={50} step={0.5} unit="m" onChange={(v) => updateSection('camera', { dof: { ...settings.camera.dof, focusDist: v } })} />
                             </div>
                          )}
                       </div>
                    </div>
                  )},

                ] : []),

                // 4. MATERIALS
                { id: sectionId('materials'), title: t('render3dSettings.sections.materials.title'), content: (
                    <div>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-2 block">
                            {t('render3dSettings.sections.materials.emphasisLabel')}
                          </label>
                          <div className="space-y-2">
                             {materialEmphasisOptions.map((material) => (
                                <SliderControl
                                   key={material.key}
                                   label={material.label}
                                   value={settings.materials.emphasis[material.key as keyof typeof settings.materials.emphasis]}
                                   min={0}
                                   max={100}
                                   step={1}
                                   unit="%"
                                   onChange={(v) => updateSection('materials', { 
                                     emphasis: { 
                                       ...settings.materials.emphasis, 
                                       [material.key]: v 
                                     } 
                                   })}
                                />
                             ))}
                          </div>
                       </div>

                       <SliderControl label={t('render3dSettings.sections.materials.globalReflectivity')} value={settings.materials.reflectivity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('materials', { reflectivity: v })} />
                       <SliderControl label={t('render3dSettings.sections.materials.surfaceRoughness')} value={settings.materials.roughness} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('materials', { roughness: v })} />
                       
                       <div className="pt-2 border-t border-border-subtle mt-3">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                               <Droplets size={12}/>
                               <span className="inline-flex items-center">
                                 {t('render3dSettings.sections.materials.weathering.title')}
                               </span>
                             </span>
                             <Toggle label="" checked={settings.materials.weathering.enabled} onChange={(v) => updateSection('materials', { weathering: { ...settings.materials.weathering, enabled: v } })} />
                          </div>
                          
                          {settings.materials.weathering.enabled && (
                             <div className="space-y-3 animate-fade-in">
                                <SliderControl label={t('render3dSettings.sections.materials.weathering.intensity')} value={settings.materials.weathering.intensity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('materials', { weathering: { ...settings.materials.weathering, intensity: v } })} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                   {['dirt', 'moss', 'rust', 'cracks'].map(w => (
                                      <button key={w} className="px-2 py-1.5 border border-border rounded text-[10px] text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors">{t(`render3dSettings.sections.materials.weathering.options.${w}`)}</button>
                                   ))}
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                )},

                // 5. ATMOSPHERE
                { id: sectionId('atmosphere'), title: t('render3dSettings.sections.atmosphere.title'), content: (
                    <div>
                       
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                          {[
                             {id: 'natural', label: t('render3dSettings.sections.atmosphere.moods.natural')},
                             {id: 'warm', label: t('render3dSettings.sections.atmosphere.moods.warm')},
                             {id: 'cool', label: t('render3dSettings.sections.atmosphere.moods.cool')},
                             {id: 'dramatic', label: t('render3dSettings.sections.atmosphere.moods.dramatic')},
                             {id: 'soft', label: t('render3dSettings.sections.atmosphere.moods.soft')},
                             {id: 'moody', label: t('render3dSettings.sections.atmosphere.moods.moody')},
                             {id: 'luxury', label: t('render3dSettings.sections.atmosphere.moods.luxury')},
                             {id: 'cinematic', label: t('render3dSettings.sections.atmosphere.moods.cinematic')},
                             {id: 'hazy', label: t('render3dSettings.sections.atmosphere.moods.hazy')},
                             {id: 'crisp', label: t('render3dSettings.sections.atmosphere.moods.crisp')},
                             {id: 'stormy', label: t('render3dSettings.sections.atmosphere.moods.stormy')},
                             {id: 'noir', label: t('render3dSettings.sections.atmosphere.moods.noir')}
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

                       <SliderControl label={t('render3dSettings.sections.atmosphere.temperature')} value={settings.atmosphere.temp} min={-100} max={100} step={1} onChange={(v) => updateSection('atmosphere', { temp: v })} />
                       
                       <div className="space-y-3 pt-2 border-t border-border-subtle mt-2">
                          <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                               <Wind size={12}/>
                               <span className="inline-flex items-center">
                                 {t('render3dSettings.sections.atmosphere.fog.title')}
                               </span>
                             </span>
                             <Toggle label="" checked={settings.atmosphere.fog.enabled} onChange={(v) => updateSection('atmosphere', { fog: { ...settings.atmosphere.fog, enabled: v } })} />
                          </div>
                          {settings.atmosphere.fog.enabled && (
                             <SliderControl className="mb-0" label={t('render3dSettings.sections.atmosphere.fog.density')} value={settings.atmosphere.fog.density} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('atmosphere', { fog: { ...settings.atmosphere.fog, density: v } })} />
                          )}

                          <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                               <Sparkle size={12}/>
                               <span className="inline-flex items-center">
                                 {t('render3dSettings.sections.atmosphere.bloom.title')}
                               </span>
                             </span>
                             <Toggle label="" checked={settings.atmosphere.bloom.enabled} onChange={(v) => updateSection('atmosphere', { bloom: { ...settings.atmosphere.bloom, enabled: v } })} />
                          </div>
                          {settings.atmosphere.bloom.enabled && (
                             <SliderControl className="mb-0" label={t('render3dSettings.sections.atmosphere.bloom.intensity')} value={settings.atmosphere.bloom.intensity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('atmosphere', { bloom: { ...settings.atmosphere.bloom, intensity: v } })} />
                          )}
                       </div>
                    </div>
                )},

                // 6. SCENERY
                { id: sectionId('scenery'), title: t('render3dSettings.sections.scenery.title'), content: (
                    <div>
                       
                       <div className="space-y-4">
                          <div className="bg-surface-elevated border border-border rounded p-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold flex items-center gap-2">
                                  <User size={12}/>
                                <span className="inline-flex items-center">
                                    {t('render3dSettings.sections.scenery.people.title')}
                                  </span>
                                </span>
                                <Toggle label="" checked={settings.scenery.people.enabled} onChange={(v) => updateSection('scenery', { people: { ...settings.scenery.people, enabled: v } })} />
                             </div>
                             {settings.scenery.people.enabled && (
                                <SliderControl className="mb-0" label={t('render3dSettings.sections.scenery.people.count')} value={settings.scenery.people.count} min={0} max={100} step={1} onChange={(v) => updateSection('scenery', { people: { ...settings.scenery.people, count: v } })} />
                             )}
                          </div>

                          <div className="bg-surface-elevated border border-border rounded p-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold flex items-center gap-2">
                                  <Trees size={12}/>
                                  <span className="inline-flex items-center">
                                    {t('render3dSettings.sections.scenery.vegetation.title')}
                                  </span>
                                </span>
                                <Toggle label="" checked={settings.scenery.trees.enabled} onChange={(v) => updateSection('scenery', { trees: { ...settings.scenery.trees, enabled: v } })} />
                             </div>
                             {settings.scenery.trees.enabled && (
                                <SliderControl className="mb-0" label={t('render3dSettings.sections.scenery.vegetation.density')} value={settings.scenery.trees.count} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('scenery', { trees: { ...settings.scenery.trees, count: v } })} />
                             )}
                          </div>

                          <div className="bg-surface-elevated border border-border rounded p-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold flex items-center gap-2">
                                  <Car size={12}/>
                                  <span className="inline-flex items-center">
                                    {t('render3dSettings.sections.scenery.vehicles.title')}
                                  </span>
                                </span>
                                <Toggle label="" checked={settings.scenery.cars.enabled} onChange={(v) => updateSection('scenery', { cars: { ...settings.scenery.cars, enabled: v } })} />
                             </div>
                             {settings.scenery.cars.enabled && (
                                <SliderControl className="mb-0" label={t('render3dSettings.sections.scenery.vehicles.count')} value={settings.scenery.cars.count} min={0} max={50} step={1} onChange={(v) => updateSection('scenery', { cars: { ...settings.scenery.cars, count: v } })} />
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
                )},

                // 7. RENDER
                { id: sectionId('render'), title: t('render3dSettings.sections.render.title'), content: (
                    <div>
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            {t('render3dSettings.sections.render.aspectRatio')}
                          </label>
                          <SegmentedControl 
                             value={settings.render.aspectRatio}
                             options={[
                                {label: '16:9', value: '16:9'},
                                {label: '4:3', value: '4:3'},
                                {label: '3:2', value: '3:2'},
                                {label: '1:1', value: '1:1'},
                                {label: '21:9', value: '21:9'},
                                {label: '9:16', value: '9:16'}
                             ]}
                             onChange={(v) => updateSection('render', { aspectRatio: v })}
                          />
                       </div>

                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            {t('render3dSettings.sections.render.quality')}
                          </label>
                          <select 
                             className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                             value={settings.render.quality}
                             onChange={(e) => updateSection('render', { quality: e.target.value })}
                          >
                             <option value="draft">{t('render3dSettings.sections.render.qualityOptions.draft')}</option>
                             <option value="preview">{t('render3dSettings.sections.render.qualityOptions.preview')}</option>
                             <option value="production">{t('render3dSettings.sections.render.qualityOptions.production')}</option>
                             <option value="ultra">{t('render3dSettings.sections.render.qualityOptions.ultra')}</option>
                          </select>
                       </div>
                    </div>
                )}
            ]}
              value={accordionValue}
              onValueChange={onAccordionChange}
            />
        </div>
    );
};
