
import React, { useState } from 'react';
import { useAppStore } from '../../../store';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { Upload, Wrench, Eraser, Sun, Image as ImageIcon, Move, Maximize, Palette, Cloud } from 'lucide-react';
import { SectionDesc, SliderControl, SunPositionWidget, ColorPicker } from './SharedRightComponents';
import { cn } from '../../../lib/utils';

export const VisualEditPanel = () => {
    const { state, dispatch } = useAppStore();
    const tool = state.workflow.activeTool;
    const updateWf = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

    // Local state for UI responsiveness (sync with global state in real app)
    const [brushSize, setBrushSize] = useState(state.workflow.visualSelection.brushSize);
    
    const updateVisual = (category: string, updates: any) => {
        // Mock updater - in real app would dispatch deep updates
        console.log('Update visual', category, updates);
    };

    const renderToolOptions = () => {
        switch (tool) {
            case 'select': return (
                <div className="space-y-4 animate-fade-in">
                    <SectionDesc>Select areas for masking or specific regeneration.</SectionDesc>
                    <SegmentedControl 
                        value={state.workflow.visualSelection.mode} 
                        options={[{label:'Rect', value:'rect'}, {label:'Brush', value:'brush'}, {label:'Poly', value:'polygon'}, {label:'Auto', value:'ai'}]} 
                        onChange={(v) => updateVisual('selection', { mode: v })} 
                    />
                    
                    {state.workflow.visualSelection.mode === 'brush' && (
                        <div className="space-y-3 pt-2">
                            <SliderControl label="Brush Size" value={brushSize} min={10} max={300} step={10} unit="px" onChange={setBrushSize} />
                            <SliderControl label="Hardness" value={state.workflow.visualSelection.hardness} min={0} max={100} step={1} unit="%" onChange={()=>{}} />
                        </div>
                    )}

                    {state.workflow.visualSelection.mode === 'ai' && (
                        <div className="grid grid-cols-2 gap-2">
                            {['Facade', 'Windows', 'Sky', 'Ground', 'Vegetation', 'Road'].map(t => (
                                <button key={t} className="text-xs border border-border rounded py-2 hover:bg-surface-elevated hover:border-foreground-muted transition-colors text-foreground-secondary">
                                    {t}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <div className="pt-2 border-t border-border-subtle">
                        <Toggle label="Add to Selection" checked={true} onChange={()=>{}} />
                        <Toggle label="Feather Edges" checked={false} onChange={()=>{}} />
                    </div>
                </div>
            );

            case 'material': return (
                <div className="space-y-4 animate-fade-in">
                    <SectionDesc>Click a surface to replace its material.</SectionDesc>
                    
                    <div>
                        <label className="text-xs font-medium text-foreground mb-2 block">Material Library</label>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                            {['Concrete', 'Wood', 'Brick', 'Glass', 'Metal', 'Stone', 'Fabric', 'Plaster'].map(m => (
                                <div key={m} className="aspect-square rounded border border-border bg-surface-elevated hover:border-foreground cursor-pointer flex items-center justify-center group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-gray-200 to-gray-100" />
                                    <span className="relative z-10 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">{m}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border-subtle">
                        <SliderControl label="Texture Scale" value={state.workflow.visualMaterial.scale} min={10} max={500} step={10} unit="%" onChange={()=>{}} />
                        <SliderControl label="Rotation" value={state.workflow.visualMaterial.rotation} min={0} max={360} step={1} unit="°" onChange={()=>{}} />
                        <SliderControl label="Roughness" value={state.workflow.visualMaterial.roughness} min={0} max={100} step={1} unit="%" onChange={()=>{}} />
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-medium">Color Tint</span>
                        <ColorPicker color="#ffffff" onChange={()=>{}} />
                    </div>
                </div>
            );

            case 'lighting': return (
                <div className="space-y-4 animate-fade-in">
                    <SectionDesc>Relight the scene with a new sun position.</SectionDesc>
                    <SunPositionWidget azimuth={140} elevation={45} onChange={()=>{}} />
                    
                    <div className="space-y-3">
                        <SliderControl label="Intensity" value={state.workflow.visualLighting.intensity} min={0} max={200} step={1} unit="%" onChange={()=>{}} />
                        <SliderControl label="Temperature" value={state.workflow.visualLighting.warmth} min={0} max={100} step={1} onChange={()=>{}} />
                        <SliderControl label="Shadow Softness" value={50} min={0} max={100} step={1} unit="%" onChange={()=>{}} />
                    </div>

                    <div className="pt-2 border-t border-border-subtle">
                        <label className="text-xs font-medium text-foreground mb-2 block">Environment</label>
                        <SegmentedControl value="global" options={[{label:'Global Sun', value:'global'}, {label:'HDRI', value:'hdri'}, {label:'Local Light', value:'local'}]} onChange={()=>{}} />
                    </div>
                </div>
            );

            case 'object': return (
                <div className="space-y-4 animate-fade-in">
                    <SectionDesc>Place 3D assets into the scene.</SectionDesc>
                    
                    <div className="relative">
                        <input className="w-full bg-surface-elevated border border-border rounded text-xs py-2 px-3 pl-8 outline-none focus:border-accent" placeholder="Search assets..." />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted">
                            <ImageIcon size={12} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="aspect-square bg-surface-elevated border border-border rounded hover:border-foreground cursor-grab active:cursor-grabbing flex flex-col items-center justify-center">
                                <div className="w-8 h-8 bg-foreground/10 rounded mb-1" />
                                <span className="text-[8px] text-foreground-muted">Asset {i}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border-subtle">
                        <SliderControl label="Scale" value={state.workflow.visualObject.scale} min={10} max={200} step={1} unit="%" onChange={()=>{}} />
                        <Toggle label="Cast Shadows" checked={true} onChange={()=>{}} />
                        <Toggle label="Auto-Perspective" checked={true} onChange={()=>{}} />
                    </div>
                </div>
            );

            case 'sky': return (
                <div className="space-y-4 animate-fade-in">
                    <SectionDesc>Replace sky and adjust atmosphere.</SectionDesc>
                    
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        {['Blue', 'Overcast', 'Sunset', 'Dusk', 'Night', 'Storm'].map(s => (
                            <button key={s} className="text-[10px] py-2 border border-border rounded hover:bg-surface-elevated hover:border-foreground-muted transition-colors">{s}</button>
                        ))}
                    </div>

                    <div className="space-y-3">
                        <SliderControl label="Cloud Density" value={40} min={0} max={100} step={1} unit="%" onChange={()=>{}} />
                        <SliderControl label="Horizon Line" value={state.workflow.visualSky.horizonLine} min={0} max={100} step={1} unit="%" onChange={()=>{}} />
                        <SliderControl label="Atmospheric Haze" value={state.workflow.visualSky.atmosphere} min={0} max={100} step={1} unit="%" onChange={()=>{}} />
                    </div>
                    
                    <Toggle label="Reflect in Glass" checked={true} onChange={()=>{}} />
                </div>
            );

            case 'remove': return (
                <div className="space-y-4 animate-fade-in">
                    <SectionDesc>Remove unwanted objects or people.</SectionDesc>
                    
                    <SegmentedControl value="fill" options={[{label:'Generative Fill', value:'fill'}, {label:'Heal', value:'heal'}, {label:'Clone', value:'clone'}]} onChange={()=>{}} />
                    
                    <div className="bg-surface-elevated border border-border rounded p-3 text-center cursor-pointer hover:border-accent transition-colors border-dashed">
                        <Eraser className="mx-auto mb-2 text-foreground-muted" size={20} />
                        <span className="text-xs font-bold block">Paint over object</span>
                        <span className="text-[10px] text-foreground-muted">Click and drag to mask</span>
                    </div>

                    <SliderControl label="Brush Size" value={brushSize} min={10} max={200} step={10} unit="px" onChange={setBrushSize} />
                </div>
            );

            case 'adjust': return (
                <div className="space-y-4 animate-fade-in">
                    <SectionDesc>Global post-processing adjustments.</SectionDesc>
                    <div className="space-y-3">
                        <SliderControl label="Exposure" value={state.workflow.visualAdjust.exposure} min={-100} max={100} step={1} onChange={()=>{}} />
                        <SliderControl label="Contrast" value={state.workflow.visualAdjust.contrast} min={-100} max={100} step={1} onChange={()=>{}} />
                        <SliderControl label="Saturation" value={state.workflow.visualAdjust.saturation} min={-100} max={100} step={1} onChange={()=>{}} />
                        <SliderControl label="Warmth" value={state.workflow.visualAdjust.temp} min={-100} max={100} step={1} onChange={()=>{}} />
                        <div className="h-px bg-border-subtle my-2" />
                        <SliderControl label="Sharpness" value={20} min={0} max={100} step={1} onChange={()=>{}} />
                        <SliderControl label="Vignette" value={10} min={0} max={100} step={1} onChange={()=>{}} />
                    </div>
                </div>
            );

            case 'extend': return (
                <div className="space-y-4 animate-fade-in">
                    <SectionDesc>Outpaint to extend the image canvas.</SectionDesc>
                    
                    <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
                        <div />
                        <button className="aspect-square border rounded hover:bg-surface-elevated flex items-center justify-center"><Move size={14} className="-rotate-90" /></button>
                        <div />
                        <button className="aspect-square border rounded hover:bg-surface-elevated flex items-center justify-center"><Move size={14} className="rotate-180" /></button>
                        <div className="aspect-square border rounded bg-surface-sunken flex items-center justify-center text-[10px] font-bold">1:1</div>
                        <button className="aspect-square border rounded hover:bg-surface-elevated flex items-center justify-center"><Move size={14} /></button>
                        <div />
                        <button className="aspect-square border rounded hover:bg-surface-elevated flex items-center justify-center"><Move size={14} className="rotate-90" /></button>
                        <div />
                    </div>

                    <SliderControl label="Extension Amount" value={50} min={10} max={100} step={1} unit="%" onChange={()=>{}} />
                    <div className="p-2 bg-yellow-50 border border-yellow-100 rounded text-[10px] text-yellow-700 leading-relaxed">
                        Extending allows the AI to hallucinate new context around your current view.
                    </div>
                </div>
            );

            default: return (
                <div className="p-8 flex flex-col items-center justify-center text-center h-full">
                    <div className="w-12 h-12 bg-surface-sunken rounded-full flex items-center justify-center mb-3 text-foreground-muted">
                        <Wrench size={24} />
                    </div>
                    <p className="text-xs text-foreground-muted">Select a tool from the left toolbar to configure its settings.</p>
                </div>
            );
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border-subtle sticky top-0 bg-background-tertiary z-10">
                <Wrench size={16} className="text-accent" />
                <h3 className="text-sm font-bold capitalize text-foreground">{tool || 'Tool'} Settings</h3>
            </div>
            {renderToolOptions()}
        </div>
    );
};
