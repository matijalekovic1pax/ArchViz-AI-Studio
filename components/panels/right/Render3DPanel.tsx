
import React from 'react';
import { useAppStore } from '../../../store';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import {
  Lock, Sun, User, Droplets, Wind, Sparkle, Car, Trees
} from 'lucide-react';
import { SectionDesc, SliderControl, VerticalCard, SunPositionWidget } from './SharedRightComponents';
import { cn } from '../../../lib/utils';
import { Render3DSettings } from '../../../types';

export const Render3DPanel = () => {
    const { state, dispatch } = useAppStore();
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
      { key: 'concrete', label: 'Concrete' },
      { key: 'wood', label: 'Wood' },
      { key: 'metal', label: 'Metal' },
      { key: 'glass', label: 'Glass' },
      { key: 'stone', label: 'Stone' },
      { key: 'brick', label: 'Brick' },
      { key: 'tile', label: 'Tile' },
      { key: 'fabric', label: 'Fabric' },
      { key: 'paint', label: 'Paint' },
      { key: 'flooring', label: 'Flooring' }
    ];

    return (
        <div className="space-y-6">
            {/* Generation Mode */}
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
                  Generation Mode
                </label>
                <div className="space-y-1">
                    {[
                        { id: 'enhance', label: 'Enhance', desc: 'Improves lighting and textures while keeping geometry.' },
                        { id: 'stylize', label: 'Stylize', desc: 'Applies artistic styles to the base model.' },
                        { id: 'hybrid', label: 'Hybrid', desc: 'Balances structural accuracy with creative details.' },
                        { id: 'strict-realism', label: 'Strict Realism', desc: 'Photographic accuracy, minimal hallucination.' },
                        { id: 'concept-push', label: 'Concept Push', desc: 'High creativity, explores new forms.' },
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

            <Accordion items={[
                // 1. GEOMETRY
                { id: 'geometry', title: 'Geometry', content: (
                    <div>
                       <SectionDesc>Preserve architectural precision and structure.</SectionDesc>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            Edge Mode
                          </label>
                          <SegmentedControl 
                             value={settings.geometry.edgeMode}
                             options={[
                                {label: 'Soft', value: 'soft'}, 
                                {label: 'Medium', value: 'medium'}, 
                                {label: 'Sharp', value: 'sharp'}
                             ]}
                             onChange={(v) => updateSection('geometry', { edgeMode: v })}
                          />
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                               <Lock size={12}/>
                               <span className="inline-flex items-center">
                                 Preservation
                               </span>
                             </span>
                          </div>
                          
                          <div className="space-y-4">
                             <Toggle 
                                label="Strict Geometry Preservation" 
                                checked={settings.geometry.strictPreservation} 
                                onChange={(v) => updateSection('geometry', { strictPreservation: v })} 
                             />
                             
                             {!settings.geometry.strictPreservation && (
                                <div className="animate-fade-in pl-2 border-l-2 border-border-subtle">
                                   <SliderControl 
                                      label="Geometry Alteration" 
                                      value={settings.geometry.geometryFreedom} 
                                      min={0} 
                                      max={100} 
                                      step={1} 
                                      unit="%" 
                                      onChange={(v) => updateSection('geometry', { geometryFreedom: v })} 
                                   />
                                   <p className="text-[9px] text-foreground-muted mt-1 leading-normal">
                                      Higher values allow the model to deviate from the original geometry.
                                   </p>
                                </div>
                             )}
                          </div>
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            Detail Level
                          </label>
                          <SegmentedControl 
                             value={settings.geometry.lod.level}
                             options={[
                                { label: 'Minimal', value: 'minimal' },
                                { label: 'Low', value: 'low' },
                                { label: 'Medium', value: 'medium' },
                                { label: 'High', value: 'high' },
                                { label: 'Ultra', value: 'ultra' }
                             ]}
                             onChange={(v) => updateSection('geometry', { lod: { ...settings.geometry.lod, level: v } })}
                          />

                          <div className="mt-3 space-y-2">
                             <Toggle 
                                label="Preserve Ornaments" 
                                checked={settings.geometry.lod.preserveOrnaments} 
                                onChange={(v) => updateSection('geometry', { lod: { ...settings.geometry.lod, preserveOrnaments: v } })} 
                             />
                             <Toggle 
                                label="Preserve Moldings" 
                                checked={settings.geometry.lod.preserveMoldings} 
                                onChange={(v) => updateSection('geometry', { lod: { ...settings.geometry.lod, preserveMoldings: v } })} 
                             />
                             <Toggle 
                                label="Preserve Trim" 
                                checked={settings.geometry.lod.preserveTrim} 
                                onChange={(v) => updateSection('geometry', { lod: { ...settings.geometry.lod, preserveTrim: v } })} 
                             />
                          </div>
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-foreground-secondary inline-flex items-center">
                               Surface Smoothing
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
                                   label="Intensity" 
                                   value={settings.geometry.smoothing.intensity} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { smoothing: { ...settings.geometry.smoothing, intensity: v } })} 
                                />
                                <Toggle 
                                   label="Preserve Hard Edges" 
                                   checked={settings.geometry.smoothing.preserveHardEdges} 
                                   onChange={(v) => updateSection('geometry', { smoothing: { ...settings.geometry.smoothing, preserveHardEdges: v } })} 
                                />
                                {settings.geometry.smoothing.preserveHardEdges && (
                                   <div className="pl-2 border-l-2 border-border-subtle">
                                      <SliderControl 
                                         label="Edge Threshold" 
                                         value={settings.geometry.smoothing.threshold} 
                                         min={0} 
                                         max={90} 
                                         step={1} 
                                         unit="°" 
                                         onChange={(v) => updateSection('geometry', { smoothing: { ...settings.geometry.smoothing, threshold: v } })} 
                                      />
                                      <p className="text-[9px] text-foreground-muted mt-1 leading-normal">
                                         Angles below threshold remain hard.
                                      </p>
                                   </div>
                                )}
                             </div>
                          )}
                       </div>

                       <div className="pt-3 border-t border-border-subtle mt-3">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-bold text-foreground-secondary inline-flex items-center">
                               Depth Layers
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
                                   label="Foreground Quality" 
                                   value={settings.geometry.depthLayers.foreground} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { depthLayers: { ...settings.geometry.depthLayers, foreground: v } })} 
                                />
                                <SliderControl 
                                   label="Midground Quality" 
                                   value={settings.geometry.depthLayers.midground} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { depthLayers: { ...settings.geometry.depthLayers, midground: v } })} 
                                />
                                <SliderControl 
                                   label="Background Quality" 
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
                               Displacement
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
                                   label="Strength" 
                                   value={settings.geometry.displacement.strength} 
                                   min={0} 
                                   max={100} 
                                   step={1} 
                                   unit="%" 
                                   onChange={(v) => updateSection('geometry', { displacement: { ...settings.geometry.displacement, strength: v } })} 
                                />
                                <div>
                                   <label className="text-xs font-medium text-foreground mb-1.5 block">
                                     Scale
                                   </label>
                                   <SegmentedControl 
                                      value={settings.geometry.displacement.scale}
                                      options={[
                                         { label: 'Fine', value: 'fine' },
                                         { label: 'Medium', value: 'medium' },
                                         { label: 'Coarse', value: 'coarse' }
                                      ]}
                                      onChange={(v) => updateSection('geometry', { displacement: { ...settings.geometry.displacement, scale: v } })}
                                   />
                                </div>
                                <div>
                                   <Toggle 
                                      label="Adapt to Material" 
                                      checked={settings.geometry.displacement.adaptToMaterial} 
                                      onChange={(v) => updateSection('geometry', { displacement: { ...settings.geometry.displacement, adaptToMaterial: v } })} 
                                   />
                                   <p className="text-[9px] text-foreground-muted mt-1 leading-normal">
                                      Auto-adjusts per surface type.
                                   </p>
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                )},

                // 2. LIGHTING
                { id: 'lighting', title: 'Lighting', content: (
                    <div>
                       <SectionDesc>Natural and artificial illumination control.</SectionDesc>
                       
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Sun size={12} className="text-accent"/>
                            <span className="inline-flex items-center">
                              Sun Position
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
                             
                             <SliderControl label="Intensity" value={settings.lighting.sun.intensity} min={0} max={200} step={1} unit="%" onChange={(v) => updateSection('lighting', { sun: { ...settings.lighting.sun, intensity: v } })} />
                             
                             <div className="mb-4">
                                <div className="flex justify-between items-baseline mb-2">
                                   <label className="text-xs font-medium text-foreground">
                                     Color Temp
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
                               Shadows
                             </span>
                             <Toggle label="" checked={settings.lighting.shadows.enabled} onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, enabled: v } })} />
                          </div>
                          {settings.lighting.shadows.enabled && (
                             <div className="space-y-3">
                                <SliderControl label="Opacity" value={settings.lighting.shadows.intensity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, intensity: v } })} />
                                <SliderControl label="Softness" value={settings.lighting.shadows.softness} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, softness: v } })} />
                             </div>
                          )}
                       </div>

                       <div className="mt-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Time of the Day</label>
                          <select
                             className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                             value={settings.lighting.preset}
                             onChange={(e) => updateSection('lighting', { preset: e.target.value })}
                          >
                             <option value="pre-dawn">Pre-Dawn</option>
                             <option value="sunrise">Sunrise</option>
                             <option value="early-morning">Early Morning</option>
                             <option value="high-noon">High Noon</option>
                             <option value="late-afternoon">Late Afternoon</option>
                             <option value="golden-hour">Golden Hour</option>
                             <option value="sunset-glow">Sunset Glow</option>
                             <option value="blue-hour">Blue Hour</option>
                             <option value="moonlit-night">Moonlit Night</option>
                          </select>
                       </div>
                    </div>
                )},

                // 3. CAMERA
                { id: 'camera', title: 'Camera', content: (
                    <div>
                       <SectionDesc>Composition and perspective settings.</SectionDesc>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            Lens (Focal Length)
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

                       <SliderControl label="Field of View" value={settings.camera.fov} min={10} max={120} step={1} unit="°" onChange={(v) => updateSection('camera', { fov: v })} />
                       
                       <div className="space-y-1 pt-2 border-t border-border-subtle">
                          <Toggle label="Auto-Correct Perspective" checked={settings.camera.autoCorrect} onChange={(v) => updateSection('camera', { autoCorrect: v })} />
                          <Toggle label="Depth of Field" checked={settings.camera.dof.enabled} onChange={(v) => updateSection('camera', { dof: { ...settings.camera.dof, enabled: v } })} />
                          
                          {settings.camera.dof.enabled && (
                             <div className="pl-2 border-l-2 border-border-subtle mt-2 space-y-2 animate-fade-in">
                                <SliderControl label="Aperture" value={settings.camera.dof.aperture} min={1.4} max={22} step={0.1} unit="f/" onChange={(v) => updateSection('camera', { dof: { ...settings.camera.dof, aperture: v } })} />
                                <SliderControl label="Focus Dist" value={settings.camera.dof.focusDist} min={0.5} max={50} step={0.5} unit="m" onChange={(v) => updateSection('camera', { dof: { ...settings.camera.dof, focusDist: v } })} />
                             </div>
                          )}
                       </div>
                    </div>
                )},

                // 4. MATERIALS
                { id: 'materials', title: 'Materials', content: (
                    <div>
                       <SectionDesc>Surface appearance and weathering.</SectionDesc>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-2 block">
                            Material Emphasis
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

                       <SliderControl label="Global Reflectivity" value={settings.materials.reflectivity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('materials', { reflectivity: v })} />
                       <SliderControl label="Surface Roughness" value={settings.materials.roughness} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('materials', { roughness: v })} />
                       
                       <div className="pt-2 border-t border-border-subtle mt-3">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                               <Droplets size={12}/>
                               <span className="inline-flex items-center">
                                 Weathering
                               </span>
                             </span>
                             <Toggle label="" checked={settings.materials.weathering.enabled} onChange={(v) => updateSection('materials', { weathering: { ...settings.materials.weathering, enabled: v } })} />
                          </div>
                          
                          {settings.materials.weathering.enabled && (
                             <div className="space-y-3 animate-fade-in">
                                <SliderControl label="Intensity" value={settings.materials.weathering.intensity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('materials', { weathering: { ...settings.materials.weathering, intensity: v } })} />
                                <div className="grid grid-cols-2 gap-2">
                                   {['Dirt', 'Moss', 'Rust', 'Cracks'].map(w => (
                                      <button key={w} className="px-2 py-1.5 border border-border rounded text-[10px] text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors">{w}</button>
                                   ))}
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                )},

                // 5. ATMOSPHERE
                { id: 'atmosphere', title: 'Atmosphere', content: (
                    <div>
                       <SectionDesc>Mood, tone, and environmental effects.</SectionDesc>
                       
                       <div className="grid grid-cols-3 gap-2 mb-4">
                          {[
                             {id: 'natural', label: 'Natural'},
                             {id: 'warm', label: 'Warm'},
                             {id: 'cool', label: 'Cool'},
                             {id: 'dramatic', label: 'Dramatic'},
                             {id: 'soft', label: 'Soft'},
                             {id: 'moody', label: 'Moody'},
                             {id: 'luxury', label: 'Luxury'},
                             {id: 'cinematic', label: 'Cinematic'},
                             {id: 'hazy', label: 'Hazy'},
                             {id: 'crisp', label: 'Crisp'},
                             {id: 'stormy', label: 'Stormy'},
                             {id: 'noir', label: 'Noir'}
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

                       <SliderControl label="Temperature" value={settings.atmosphere.temp} min={-100} max={100} step={1} onChange={(v) => updateSection('atmosphere', { temp: v })} />
                       
                       <div className="space-y-3 pt-2 border-t border-border-subtle mt-2">
                          <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                               <Wind size={12}/>
                               <span className="inline-flex items-center">
                                 Fog
                               </span>
                             </span>
                             <Toggle label="" checked={settings.atmosphere.fog.enabled} onChange={(v) => updateSection('atmosphere', { fog: { ...settings.atmosphere.fog, enabled: v } })} />
                          </div>
                          {settings.atmosphere.fog.enabled && (
                             <SliderControl className="mb-0" label="Density" value={settings.atmosphere.fog.density} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('atmosphere', { fog: { ...settings.atmosphere.fog, density: v } })} />
                          )}

                          <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5">
                               <Sparkle size={12}/>
                               <span className="inline-flex items-center">
                                 Bloom
                               </span>
                             </span>
                             <Toggle label="" checked={settings.atmosphere.bloom.enabled} onChange={(v) => updateSection('atmosphere', { bloom: { ...settings.atmosphere.bloom, enabled: v } })} />
                          </div>
                          {settings.atmosphere.bloom.enabled && (
                             <SliderControl className="mb-0" label="Intensity" value={settings.atmosphere.bloom.intensity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('atmosphere', { bloom: { ...settings.atmosphere.bloom, intensity: v } })} />
                          )}
                       </div>
                    </div>
                )},

                // 6. SCENERY
                { id: 'scenery', title: 'Scenery', content: (
                    <div>
                       <SectionDesc>Populate scene with context.</SectionDesc>
                       
                       <div className="space-y-4">
                          <div className="bg-surface-elevated border border-border rounded p-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold flex items-center gap-2">
                                  <User size={12}/>
                                  <span className="inline-flex items-center">
                                    People
                                  </span>
                                </span>
                                <Toggle label="" checked={settings.scenery.people.enabled} onChange={(v) => updateSection('scenery', { people: { ...settings.scenery.people, enabled: v } })} />
                             </div>
                             {settings.scenery.people.enabled && (
                                <SliderControl className="mb-0" label="Count" value={settings.scenery.people.count} min={0} max={100} step={1} onChange={(v) => updateSection('scenery', { people: { ...settings.scenery.people, count: v } })} />
                             )}
                          </div>

                          <div className="bg-surface-elevated border border-border rounded p-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold flex items-center gap-2">
                                  <Trees size={12}/>
                                  <span className="inline-flex items-center">
                                    Vegetation
                                  </span>
                                </span>
                                <Toggle label="" checked={settings.scenery.trees.enabled} onChange={(v) => updateSection('scenery', { trees: { ...settings.scenery.trees, enabled: v } })} />
                             </div>
                             {settings.scenery.trees.enabled && (
                                <SliderControl className="mb-0" label="Density" value={settings.scenery.trees.count} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('scenery', { trees: { ...settings.scenery.trees, count: v } })} />
                             )}
                          </div>

                          <div className="bg-surface-elevated border border-border rounded p-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold flex items-center gap-2">
                                  <Car size={12}/>
                                  <span className="inline-flex items-center">
                                    Vehicles
                                  </span>
                                </span>
                                <Toggle label="" checked={settings.scenery.cars.enabled} onChange={(v) => updateSection('scenery', { cars: { ...settings.scenery.cars, enabled: v } })} />
                             </div>
                             {settings.scenery.cars.enabled && (
                                <SliderControl className="mb-0" label="Count" value={settings.scenery.cars.count} min={0} max={50} step={1} onChange={(v) => updateSection('scenery', { cars: { ...settings.scenery.cars, count: v } })} />
                             )}
                          </div>
                       </div>

                       <div className="mt-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            Context Preset
                          </label>
                          <select 
                             className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                             value={settings.scenery.preset}
                             onChange={(e) => updateSection('scenery', { preset: e.target.value })}
                          >
                             <optgroup label="Terminal & Public Areas">
                                <option value="departure-hall">Departure Hall</option>
                                <option value="arrivals-hall">Arrivals Hall</option>
                                <option value="check-in-counter">Check-in Counter</option>
                                <option value="ticketing-area">Ticketing Area</option>
                                <option value="main-concourse">Main Concourse</option>
                                <option value="terminal-atrium">Terminal Atrium</option>
                             </optgroup>
                             <optgroup label="Security & Processing">
                                <option value="security-checkpoint">Security Checkpoint</option>
                                <option value="passport-control">Passport Control</option>
                                <option value="customs-hall">Customs Hall</option>
                                <option value="immigration-area">Immigration Area</option>
                                <option value="tsa-screening">TSA Screening</option>
                             </optgroup>
                             <optgroup label="Waiting & Lounges">
                                <option value="gate-waiting-area">Gate Waiting Area</option>
                                <option value="business-class-lounge">Business Class Lounge</option>
                                <option value="first-class-lounge">First Class Lounge</option>
                                <option value="airline-lounge">Airline Lounge</option>
                                <option value="transit-lounge">Transit Lounge</option>
                                <option value="family-waiting-area">Family Waiting Area</option>
                             </optgroup>
                             <optgroup label="Baggage">
                                <option value="baggage-claim">Baggage Claim</option>
                                <option value="baggage-dropoff">Baggage Drop-off</option>
                                <option value="oversized-baggage">Oversized Baggage</option>
                                <option value="lost-baggage-office">Lost Baggage Office</option>
                             </optgroup>
                             <optgroup label="Retail & Dining">
                                <option value="duty-free-shop">Duty-Free Shop</option>
                                <option value="food-court">Food Court</option>
                                <option value="restaurant-bar">Restaurant/Bar</option>
                                <option value="retail-corridor">Retail Corridor</option>
                                <option value="newsstand">Newsstand/Convenience</option>
                             </optgroup>
                             <optgroup label="Transport & Access">
                                <option value="jet-bridge-gate">Jet Bridge / Boarding Gate</option>
                                <option value="bus-gate-area">Bus Gate Area</option>
                                <option value="ground-transportation">Ground Transportation</option>
                                <option value="taxi-rideshare-pickup">Taxi/Rideshare Pickup</option>
                                <option value="parking-garage">Parking Garage</option>
                                <option value="rental-car-center">Rental Car Center</option>
                             </optgroup>
                             <optgroup label="Operations & Support">
                                <option value="information-desk">Information Desk</option>
                                <option value="airport-office">Airport Office</option>
                                <option value="control-tower-exterior">Control Tower (exterior)</option>
                                <option value="maintenance-hangar">Maintenance Hangar</option>
                                <option value="cargo-terminal">Cargo Terminal</option>
                             </optgroup>
                             <optgroup label="Exterior">
                                <option value="terminal-curbside">Terminal Curbside</option>
                                <option value="runway-view">Runway View</option>
                                <option value="apron-tarmac">Apron / Tarmac</option>
                                <option value="airport-entry-plaza">Airport Entry Plaza</option>
                             </optgroup>
                          </select>
                       </div>
                    </div>
                )},

                // 7. RENDER
                { id: 'render', title: 'Render Format', content: (
                    <div>
                       <SectionDesc>Output specifications and export.</SectionDesc>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            Resolution
                          </label>
                          <SegmentedControl 
                             value={settings.render.resolution}
                             options={[
                                {label: 'HD', value: '720p'}, {label: 'FHD', value: '1080p'}, {label: '4K', value: '4k'}, {label: 'Print', value: 'print'}
                             ]}
                             onChange={(v) => updateSection('render', { resolution: v })}
                          />
                       </div>

                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            Aspect Ratio
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
                            View Type
                          </label>
                          <select 
                             className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                             value={settings.render.viewType}
                             onChange={(e) => updateSection('render', { viewType: e.target.value })}
                          >
                             <option value="passenger-pov">Passenger POV - eye-level walking through</option>
                             <option value="concourse-walk">Concourse Walk - corridor perspective</option>
                             <option value="atrium-overview">Atrium Overview - ground level looking up</option>
                             <option value="gate-seating">Gate Seating - seated passenger view</option>
                             <option value="lounge-interior">Lounge Interior - luxury seated angle</option>
                             <option value="mezzanine-view">Mezzanine View - from upper level down</option>
                             <option value="drone-low">Drone Low - facade hero shot</option>
                             <option value="drone-high">Drone High - full terminal context</option>
                             <option value="section-cut">Section Cut - interior reveal</option>
                             <option value="spherical-360">360 Spherical - VR panorama</option>
                          </select>
                          <p className="text-[9px] text-foreground-muted mt-1 leading-normal">
                             View preset controls the camera viewpoint and composition for the render.
                          </p>
                       </div>

                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">
                            Quality
                          </label>
                          <select 
                             className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                             value={settings.render.quality}
                             onChange={(e) => updateSection('render', { quality: e.target.value })}
                          >
                             <option value="draft">Draft (Fast)</option>
                             <option value="preview">Preview</option>
                             <option value="production">Production</option>
                             <option value="ultra">Ultra</option>
                          </select>
                       </div>
                    </div>
                )}
            ]} defaultValue="geometry" />
        </div>
    );
};
