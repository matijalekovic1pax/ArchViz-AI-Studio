
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { cn } from '../../../lib/utils';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { 
  Box, Camera, Sun, Palette, Layers, Grid, Sparkle, Brush, Type, 
  ChevronsLeft, ChevronsRight, FileCode, Upload, Wand2, Paintbrush, Home, Cloud, 
  Trash2, Wrench, Expand, Maximize2, Video, MousePointer, Aperture, Settings,
  ArrowRight, Download, Play, CheckCircle2, AlertTriangle, XCircle, FileText,
  Minimize, MoreHorizontal, HelpCircle, Share2, MonitorPlay, Zap, Image as ImageIcon,
  Move, RotateCcw, Focus, Moon, CloudSun, Sunrise, Shuffle, Clock, Gem, Plus, Check, ChevronDown,
  Monitor, Globe, Film, RotateCw, Eye, Thermometer, Droplets, Trees, User, Car, Sofa, Wind, Mountain,
  Plane
} from 'lucide-react';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';

// --- Shared Components ---

const QuickActionBtn: React.FC<{ label: string, icon?: React.ElementType, onClick?: () => void, className?: string }> = ({ label, icon: Icon, onClick, className }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center justify-center gap-2 px-3 py-2 bg-surface-elevated border border-border rounded text-[10px] font-bold uppercase tracking-wider text-foreground-secondary hover:text-foreground hover:border-foreground-muted transition-all shadow-sm flex-1",
      className
    )}
  >
    {Icon && <Icon size={12} />}
    {label}
  </button>
);

const SectionDesc: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] text-foreground-muted leading-relaxed mb-3 italic">
    {children}
  </p>
);

// --- SPECIFICATION COMPONENTS ---

// 4. SliderControl
interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

const SliderControl: React.FC<SliderControlProps> = ({ label, value, min, max, step, unit, onChange, disabled, className }) => (
  <div className={cn("space-y-2 mb-3", className, disabled && "opacity-50 pointer-events-none")}>
    <div className="flex justify-between items-baseline">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <span className="text-[10px] font-mono text-foreground-muted">{value}{unit}</span>
    </div>
    <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
  </div>
);

// Sun Widget
const SunPositionWidget: React.FC<{ azimuth: number; elevation: number; onChange: (az: number, el: number) => void }> = ({ azimuth, elevation, onChange }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (e: MouseEvent | React.MouseEvent) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);
    
    // Map x to Azimuth (0-360)
    const newAz = Math.round((x / rect.width) * 360);
    // Map y to Elevation (90-0) - Top is 90 deg
    const newEl = Math.round(90 - (y / rect.height) * 90);
    
    onChange(newAz, newEl);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e);
  };

  useEffect(() => {
    const up = () => setIsDragging(false);
    const move = (e: MouseEvent) => {
      if (isDragging) handleMove(e);
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mousemove', move);
    };
  }, [isDragging]);

  // Calculate position percentage
  const left = (azimuth / 360) * 100;
  const top = ((90 - elevation) / 90) * 100;

  return (
    <div 
      ref={boxRef}
      className="relative h-24 bg-surface-sunken border border-border rounded-lg overflow-hidden cursor-crosshair mb-4 shadow-inner"
      onMouseDown={handleMouseDown}
    >
      {/* Grid Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)', backgroundSize: '25% 33%' }} />
      
      {/* Directions */}
      <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-foreground-muted pointer-events-none">N</span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-foreground-muted pointer-events-none">S</span>
      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-foreground-muted pointer-events-none">W</span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-foreground-muted pointer-events-none">E</span>

      {/* Sun Handle */}
      <div 
        className="absolute w-4 h-4 bg-yellow-400 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.8)] border-2 border-white z-10 transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
        style={{ left: `${left}%`, top: `${top}%` }}
      />
      
      {/* Info Tag */}
      <div className="absolute bottom-1 right-1 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-mono border border-border pointer-events-none">
        Az:{azimuth}° El:{elevation}°
      </div>
    </div>
  );
};

// --- ADDITIONAL SHARED COMPONENTS ---

interface VerticalCardProps {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

const VerticalCard: React.FC<VerticalCardProps> = ({ label, description, selected, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full text-left p-3 rounded-lg border transition-all mb-2 flex flex-col gap-1",
      selected
        ? "bg-foreground text-background border-foreground shadow-sm"
        : "bg-surface-elevated border-border hover:border-foreground-muted"
    )}
  >
    <span className="text-xs font-bold">{label}</span>
    <span className={cn("text-[10px] leading-relaxed", selected ? "text-white/80" : "text-foreground-muted")}>
      {description}
    </span>
  </button>
);

const ColorPicker: React.FC<{ color: string; onChange: (c: string) => void }> = ({ color, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-6 rounded border border-border shadow-sm overflow-hidden relative">
         <input type="color" value={color} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
         <div className="w-full h-full" style={{ backgroundColor: color }} />
      </div>
    </div>
  );
};

interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

const NumberInput: React.FC<NumberInputProps> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="flex items-center justify-between">
    <label className="text-xs font-medium text-foreground">{label}</label>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 h-7 bg-surface-sunken border border-border rounded px-2 text-xs text-right focus:border-accent outline-none"
    />
  </div>
);

// --- MAIN FEATURE COMPONENT ---

const Render3DPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;
    const updateWf = (p: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload: p });

    // Local State strictly following specifications
    const [settings, setSettings] = useState({
      geometry: {
        edgeMode: 'subtle', // subtle, medium, strong, technical
        edgeStrength: 30,
        cornerSharpness: 50,
        structuralGrid: false,
        wireframe: false,
        optimization: 'high'
      },
      lighting: {
        sun: { enabled: true, azimuth: 135, elevation: 45, intensity: 80, colorTemp: 5500, softness: 35 },
        shadows: { enabled: true, intensity: 75, softness: 40, color: '#1a237e' },
        ambient: { intensity: 40, occlusion: 50 },
        preset: 'custom'
      },
      camera: {
        preset: 'eye-level',
        lens: 35, // 12, 16, 24, 35, 50
        fov: 63,
        autoCorrect: true,
        dof: { enabled: false, aperture: 2.8, focusDist: 5 }
      },
      materials: {
        category: 'Concrete',
        reflectivity: 50,
        roughness: 50,
        weathering: { enabled: false, intensity: 30 }
      },
      atmosphere: {
        mood: 'natural',
        fog: { enabled: false, density: 20 },
        bloom: { enabled: true, intensity: 30 },
        temp: 0 // -100 to 100
      },
      scenery: {
        people: { enabled: false, count: 20 },
        trees: { enabled: true, count: 50 },
        cars: { enabled: false, count: 10 },
        preset: 'residential'
      },
      render: {
        resolution: '1080p',
        format: 'png',
        quality: 'production'
      }
    });

    const updateSection = (section: keyof typeof settings, updates: any) => {
      setSettings(prev => ({ ...prev, [section]: { ...prev[section], ...updates } }));
    };

    return (
        <div className="space-y-6">
            {/* Preserved Generation Mode Section */}
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Generation Mode</label>
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

            {/* 7 Redesigned Collapsible Sections */}
            <Accordion items={[
                // 1. GEOMETRY
                { id: 'geometry', title: 'Geometry', content: (
                    <div>
                       <SectionDesc>Preserve architectural precision and structure.</SectionDesc>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Edge Mode</label>
                          <SegmentedControl 
                             value={settings.geometry.edgeMode}
                             options={[
                                {label: 'Subtle', value: 'subtle'}, {label: 'Med', value: 'medium'}, {label: 'Bold', value: 'strong'}, {label: 'Tech', value: 'technical'}
                             ]}
                             onChange={(v) => updateSection('geometry', { edgeMode: v })}
                          />
                       </div>

                       <SliderControl label="Edge Strength" value={settings.geometry.edgeStrength} min={0} max={100} step={1} onChange={(v) => updateSection('geometry', { edgeStrength: v })} />
                       <SliderControl label="Corner Sharpness" value={settings.geometry.cornerSharpness} min={0} max={100} step={1} onChange={(v) => updateSection('geometry', { cornerSharpness: v })} />
                       
                       <div className="space-y-2 pt-2 border-t border-border-subtle mt-2">
                          <Toggle label="Wireframe Overlay" checked={settings.geometry.wireframe} onChange={(v) => updateSection('geometry', { wireframe: v })} />
                          <Toggle label="Structural Grid" checked={settings.geometry.structuralGrid} onChange={(v) => updateSection('geometry', { structuralGrid: v })} />
                       </div>
                    </div>
                )},

                // 2. LIGHTING
                { id: 'lighting', title: 'Lighting', content: (
                    <div>
                       <SectionDesc>Natural and artificial illumination control.</SectionDesc>
                       
                       {/* Sun Widget */}
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold flex items-center gap-1.5"><Sun size={12} className="text-accent"/> Sun Position</span>
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
                                   <label className="text-xs font-medium text-foreground">Color Temp</label>
                                   <span className="text-[10px] font-mono text-foreground-muted">{settings.lighting.sun.colorTemp}K</span>
                                </div>
                                <div className="h-4 rounded-full w-full relative overflow-hidden ring-1 ring-border">
                                   <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #ff6b35, #ffd4a3, #ffffff, #9dc4ff)' }} />
                                   <input 
                                      type="range" 
                                      min={2000} max={12000} step={100} 
                                      value={settings.lighting.sun.colorTemp} 
                                      onChange={(e) => updateSection('lighting', { sun: { ...settings.lighting.sun, colorTemp: parseInt(e.target.value) } })}
                                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                   />
                                </div>
                             </div>
                          </div>
                       )}

                       <div className="border-t border-border-subtle pt-3 mt-3">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-foreground-secondary">Shadows</span>
                             <Toggle label="" checked={settings.lighting.shadows.enabled} onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, enabled: v } })} />
                          </div>
                          {settings.lighting.shadows.enabled && (
                             <div className="space-y-3">
                                <SliderControl label="Opacity" value={settings.lighting.shadows.intensity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, intensity: v } })} />
                                <SliderControl label="Softness" value={settings.lighting.shadows.softness} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('lighting', { shadows: { ...settings.lighting.shadows, softness: v } })} />
                             </div>
                          )}
                       </div>

                       <div className="mt-4 grid grid-cols-3 gap-2">
                          {['Golden', 'Noon', 'Blue', 'Overcast', 'Night'].map(p => (
                             <button 
                                key={p}
                                className="px-2 py-1.5 text-[9px] font-bold border border-border rounded hover:bg-surface-elevated hover:text-foreground text-foreground-muted transition-colors"
                                onClick={() => updateSection('lighting', { preset: p.toLowerCase() })}
                             >
                                {p}
                             </button>
                          ))}
                       </div>
                    </div>
                )},

                // 3. CAMERA
                { id: 'camera', title: 'Camera', content: (
                    <div>
                       <SectionDesc>Composition and perspective settings.</SectionDesc>
                       
                       <div className="grid grid-cols-3 gap-2 mb-4">
                          {[
                             {id: 'eye-level', label: 'Eye Level', icon: User},
                             {id: 'elevated', label: 'Elevated', icon: Box},
                             {id: 'birds-eye', label: 'Bird\'s Eye', icon: Plane},
                             {id: 'worms-eye', label: 'Worm\'s Eye', icon: ArrowRight},
                             {id: 'corner', label: 'Corner', icon: Box},
                             {id: 'straight', label: 'Straight', icon: Grid},
                          ].map(p => (
                             <button
                                key={p.id}
                                onClick={() => updateSection('camera', { preset: p.id })}
                                className={cn(
                                   "flex flex-col items-center justify-center p-2 rounded border transition-all h-14",
                                   settings.camera.preset === p.id 
                                      ? "bg-foreground text-background border-foreground shadow-sm" 
                                      : "bg-surface-elevated border-border text-foreground-muted hover:border-foreground-muted"
                                )}
                             >
                                <p.icon size={14} className="mb-1" />
                                <span className="text-[9px] font-medium">{p.label}</span>
                             </button>
                          ))}
                       </div>

                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Lens (Focal Length)</label>
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
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Category Override</label>
                          <select 
                             className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                             value={settings.materials.category}
                             onChange={(e) => updateSection('materials', { category: e.target.value })}
                          >
                             {['Concrete', 'Wood', 'Metal', 'Glass', 'Stone', 'Brick', 'Tile', 'Fabric', 'Paint', 'Flooring'].map(c => (
                                <option key={c} value={c}>{c}</option>
                             ))}
                          </select>
                       </div>

                       <SliderControl label="Global Reflectivity" value={settings.materials.reflectivity} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('materials', { reflectivity: v })} />
                       <SliderControl label="Surface Roughness" value={settings.materials.roughness} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('materials', { roughness: v })} />
                       
                       <div className="pt-2 border-t border-border-subtle mt-3">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5"><Droplets size={12}/> Weathering</span>
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
                             {id: 'warm', label: 'Warm'}, {id: 'cool', label: 'Cool'}, {id: 'dramatic', label: 'Dramatic'},
                             {id: 'soft', label: 'Soft'}, {id: 'moody', label: 'Moody'}, {id: 'luxury', label: 'Luxury'}
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
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5"><Wind size={12}/> Fog</span>
                             <Toggle label="" checked={settings.atmosphere.fog.enabled} onChange={(v) => updateSection('atmosphere', { fog: { ...settings.atmosphere.fog, enabled: v } })} />
                          </div>
                          {settings.atmosphere.fog.enabled && (
                             <SliderControl className="mb-0" label="Density" value={settings.atmosphere.fog.density} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('atmosphere', { fog: { ...settings.atmosphere.fog, density: v } })} />
                          )}

                          <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-foreground-secondary flex items-center gap-1.5"><Sparkle size={12}/> Bloom</span>
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
                                <span className="text-xs font-bold flex items-center gap-2"><User size={12}/> People</span>
                                <Toggle label="" checked={settings.scenery.people.enabled} onChange={(v) => updateSection('scenery', { people: { ...settings.scenery.people, enabled: v } })} />
                             </div>
                             {settings.scenery.people.enabled && (
                                <SliderControl className="mb-0" label="Count" value={settings.scenery.people.count} min={0} max={100} step={1} onChange={(v) => updateSection('scenery', { people: { ...settings.scenery.people, count: v } })} />
                             )}
                          </div>

                          <div className="bg-surface-elevated border border-border rounded p-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold flex items-center gap-2"><Trees size={12}/> Vegetation</span>
                                <Toggle label="" checked={settings.scenery.trees.enabled} onChange={(v) => updateSection('scenery', { trees: { ...settings.scenery.trees, enabled: v } })} />
                             </div>
                             {settings.scenery.trees.enabled && (
                                <SliderControl className="mb-0" label="Density" value={settings.scenery.trees.count} min={0} max={100} step={1} unit="%" onChange={(v) => updateSection('scenery', { trees: { ...settings.scenery.trees, count: v } })} />
                             )}
                          </div>

                          <div className="bg-surface-elevated border border-border rounded p-2">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold flex items-center gap-2"><Car size={12}/> Vehicles</span>
                                <Toggle label="" checked={settings.scenery.cars.enabled} onChange={(v) => updateSection('scenery', { cars: { ...settings.scenery.cars, enabled: v } })} />
                             </div>
                             {settings.scenery.cars.enabled && (
                                <SliderControl className="mb-0" label="Count" value={settings.scenery.cars.count} min={0} max={50} step={1} onChange={(v) => updateSection('scenery', { cars: { ...settings.scenery.cars, count: v } })} />
                             )}
                          </div>
                       </div>

                       <div className="mt-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Context Preset</label>
                          <select 
                             className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                             value={settings.scenery.preset}
                             onChange={(e) => updateSection('scenery', { preset: e.target.value })}
                          >
                             <option value="residential">Residential Suburban</option>
                             <option value="commercial">Urban Commercial</option>
                             <option value="interior">Interior Living</option>
                             <option value="empty">Empty / Studio</option>
                          </select>
                       </div>
                    </div>
                )},

                // 7. RENDER
                { id: 'render', title: 'Render Quality', content: (
                    <div>
                       <SectionDesc>Output specifications and export.</SectionDesc>
                       
                       <div className="mb-4">
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Resolution</label>
                          <SegmentedControl 
                             value={settings.render.resolution}
                             options={[
                                {label: 'HD', value: '720p'}, {label: 'FHD', value: '1080p'}, {label: '4K', value: '4k'}, {label: 'Print', value: 'print'}
                             ]}
                             onChange={(v) => updateSection('render', { resolution: v })}
                          />
                       </div>

                       <div className="flex gap-4 mb-4">
                          <div className="flex-1">
                             <label className="text-xs font-medium text-foreground mb-1.5 block">Format</label>
                             <select 
                                className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"
                                value={settings.render.format}
                                onChange={(e) => updateSection('render', { format: e.target.value })}
                             >
                                <option value="png">PNG (Lossless)</option>
                                <option value="jpg">JPG (Compact)</option>
                                <option value="tiff">TIFF (High Bit)</option>
                                <option value="exr">EXR (Linear)</option>
                             </select>
                          </div>
                          <div className="flex-1">
                             <label className="text-xs font-medium text-foreground mb-1.5 block">Quality</label>
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

                       <div className="space-y-2 mt-4">
                          <button className="w-full py-3 bg-foreground text-background rounded-lg flex items-center justify-center gap-2 text-xs font-bold hover:bg-foreground/90 transition-colors shadow-md">
                             <Camera size={16} /> Render Image
                          </button>
                          
                          <div className="grid grid-cols-2 gap-2">
                             <button className="py-2.5 bg-surface-elevated border border-border rounded-lg flex items-center justify-center gap-2 text-xs font-medium hover:bg-surface-sunken hover:border-foreground-muted transition-all">
                                <Globe size={14} /> 360° Pano
                             </button>
                             <button className="py-2.5 bg-surface-elevated border border-border rounded-lg flex items-center justify-center gap-2 text-xs font-medium hover:bg-surface-sunken hover:border-foreground-muted transition-all">
                                <Film size={14} /> Animation
                             </button>
                          </div>
                       </div>
                    </div>
                )}
            ]} defaultValue="geometry" />
        </div>
    );
};

// --- FEATURE 2: CAD TO RENDER ---
const CadToRenderPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">View Type</label>
                <SegmentedControl value="exterior" options={[{label:'Ext', value:'exterior'}, {label:'Int', value:'interior'}, {label:'Aerial', value:'aerial'}, {label:'Street', value:'street'}]} onChange={()=>{}} />
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Camera Angle</label>
                <div className="h-24 bg-surface-sunken border border-border rounded flex items-center justify-center text-foreground-muted text-xs hover:bg-surface-elevated cursor-pointer transition-colors">
                    <Focus size={24} className="opacity-50" />
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Spatial</label>
                <div className="space-y-3">
                    <Slider label="Ceiling Height" value={2.8} min={2} max={10} onChange={()=>{}} />
                    <Slider label="Floor Thickness" value={0.3} min={0.1} max={1} onChange={()=>{}} />
                    <Slider label="Wall Thickness" value={0.2} min={0.1} max={1} onChange={()=>{}} />
                    <Slider label="Interpretation" value={50} min={0} max={100} onChange={()=>{}} />
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Materials</label>
                <div className="space-y-1">
                    {['Walls', 'Floors', 'Ceilings', 'Windows', 'Doors'].map(el => (
                        <div key={el} className="flex justify-between items-center p-2 bg-surface-elevated border border-border rounded text-xs hover:border-foreground-muted cursor-pointer transition-all">
                            <span>{el}</span>
                            <span className="text-foreground-muted bg-surface-sunken px-1.5 py-0.5 rounded text-[10px]">Auto</span>
                        </div>
                    ))}
                    <button className="w-full py-1.5 text-[10px] border border-dashed border-border rounded text-foreground-muted hover:bg-surface-elevated transition-colors">+ Add Material Rule</button>
                </div>
            </div>

            <Accordion items={[
                { id: 'light', title: 'Lighting', content: (
                    <div className="space-y-3">
                        <Toggle label="Auto-Generate Interior Lights" checked={true} onChange={()=>{}} />
                        <Slider label="Sun Intensity" value={80} min={0} max={100} onChange={()=>{}} />
                        <Slider label="Ambient Light" value={40} min={0} max={100} onChange={()=>{}} />
                        <div className="flex justify-between text-xs pt-1">
                            <span className="text-foreground-muted">North Direction</span>
                            <input type="number" className="w-12 h-6 bg-surface-sunken border border-border rounded text-center" defaultValue={0} />
                        </div>
                    </div>
                )},
                { id: 'ctx', title: 'Context', content: (
                    <div className="space-y-3">
                        <Toggle label="Generate Site Context" checked={true} onChange={()=>{}} />
                        <Slider label="Neighboring Building Height" value={15} min={0} max={100} onChange={()=>{}} />
                        <Toggle label="Add Vegetation" checked={true} onChange={()=>{}} />
                        <Toggle label="Add Street Elements" checked={false} onChange={()=>{}} />
                    </div>
                )},
                { id: 'furn', title: 'Furniture', content: (
                    <div className="space-y-3">
                        <Toggle label="Auto-furnish" checked={true} onChange={()=>{}} />
                        <div className="pl-2 border-l-2 border-border-subtle space-y-2">
                            <Toggle label="By Room Type" checked={true} onChange={()=>{}} />
                            <select className="w-full bg-surface-sunken border border-border rounded text-xs h-7 px-1"><option>Modern</option><option>Classic</option><option>Scandinavian</option></select>
                            <Slider label="Density" value={60} min={0} max={100} onChange={()=>{}} />
                        </div>
                    </div>
                )},
                { id: 'out', title: 'Output', content: (
                    <div className="space-y-3">
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>High Quality (4K)</option><option>Standard (HD)</option><option>Draft</option></select>
                        <Toggle label="Denoise" checked={true} onChange={()=>{}} />
                        <Toggle label="Color Correction" checked={true} onChange={()=>{}} />
                    </div>
                )},
            ]} defaultValue="furn" />
        </div>
    );
};

// --- FEATURE 3: MASTERPLANS ---
const MasterplanPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Type</label>
                <div className="grid grid-cols-2 gap-2">
                    {['Photorealistic', 'Diagrammatic', 'Hybrid', 'Illustrative'].map(t => (
                        <button key={t} className="py-2 px-1 text-xs border rounded hover:bg-surface-elevated">{t}</button>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">View Angle</label>
                <div className="h-24 bg-surface-sunken border border-border rounded flex items-center justify-center text-foreground-muted text-xs">
                    [Hemisphere Picker]
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Buildings</label>
                <div className="space-y-3">
                    <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>Contemporary Mixed</option><option>Residential</option><option>Office Park</option></select>
                    <div>
                        <span className="text-[10px] text-foreground-muted block mb-1">Height Interpretation</span>
                        <SegmentedControl value="uniform" options={[{label:'Uniform', value:'uniform'}, {label:'Color', value:'color'}, {label:'Random', value:'random'}]} onChange={()=>{}} />
                    </div>
                    <Slider label="Default Height" value={24} min={3} max={100} onChange={()=>{}} />
                    <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>Flat Roof</option><option>Gabled</option><option>Green Roof</option></select>
                </div>
            </div>

            <Accordion items={[
                { id: 'land', title: 'Landscape', content: (
                    <div className="space-y-3">
                        <Slider label="Tree Density" value={60} min={0} max={100} onChange={()=>{}} />
                        <Toggle label="Water Bodies" checked={true} onChange={()=>{}} />
                        <Toggle label="Parks & Plazas" checked={true} onChange={()=>{}} />
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>Temperate</option><option>Tropical</option><option>Arid</option></select>
                    </div>
                )},
                { id: 'infra', title: 'Infrastructure', content: (
                    <div className="space-y-3">
                        <Toggle label="Roads" checked={true} onChange={()=>{}} />
                        <Slider label="Traffic Density" value={30} min={0} max={100} onChange={()=>{}} />
                        <Toggle label="Pedestrian Paths" checked={true} onChange={()=>{}} />
                        <Toggle label="Street Lights" checked={false} onChange={()=>{}} />
                    </div>
                )},
                { id: 'atm', title: 'Atmosphere', content: (
                    <div className="space-y-3">
                        <Slider label="Haze / Depth" value={20} min={0} max={100} onChange={()=>{}} />
                        <Slider label="Cloud Cover" value={40} min={0} max={100} onChange={()=>{}} />
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>Clear Day</option><option>Golden Hour</option><option>Overcast</option></select>
                    </div>
                )},
                { id: 'annot', title: 'Annotations', content: (
                    <div className="space-y-2">
                        <Toggle label="Show Labels" checked={true} onChange={()=>{}} />
                        <Toggle label="Show Diagrams" checked={false} onChange={()=>{}} />
                        <Toggle label="Scale Bar" checked={true} onChange={()=>{}} />
                        <Toggle label="North Arrow" checked={true} onChange={()=>{}} />
                    </div>
                )},
                { id: 'out', title: 'Output', content: (
                    <div className="space-y-3">
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>4K Ultra HD</option><option>8K Print</option><option>1080p Web</option></select>
                        <Toggle label="Export Layers" checked={false} onChange={()=>{}} />
                    </div>
                )},
            ]} />
        </div>
    );
};

// --- FEATURE 4: VISUAL EDITING SUITE ---
const VisualEditPanel = () => {
    const { state, dispatch } = useAppStore();
    const tool = state.workflow.activeTool;

    const renderToolOptions = () => {
        switch (tool) {
            case 'select': return (
                <div className="space-y-4">
                    <SegmentedControl value="rect" options={[{label:'Rect', value:'rect'}, {label:'Lasso', value:'lasso'}, {label:'AI', value:'ai'}]} onChange={()=>{}} />
                    <div className="grid grid-cols-2 gap-2">
                        {['Facade', 'Windows', 'Sky', 'Ground'].map(t => <button key={t} className="text-xs border rounded py-1 hover:bg-surface-elevated">{t}</button>)}
                    </div>
                    <Slider label="Feather" value={0} min={0} max={20} onChange={()=>{}} />
                    <div className="flex gap-2">
                        <button className="flex-1 py-1 text-xs border rounded bg-surface-elevated">Add</button>
                        <button className="flex-1 py-1 text-xs border rounded hover:bg-surface-elevated">Sub</button>
                        <button className="flex-1 py-1 text-xs border rounded hover:bg-surface-elevated">Inv</button>
                    </div>
                </div>
            );
            case 'material': return (
                <div className="space-y-4">
                    <div className="text-xs text-center p-2 bg-surface-sunken rounded border border-border">Current Selection: Wall</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-surface-elevated border border-border rounded cursor-pointer hover:border-foreground"/>)}
                    </div>
                    <button className="w-full py-2 text-xs border rounded flex items-center justify-center gap-2"><Upload size={12}/> Custom Texture</button>
                    <Slider label="Intensity" value={80} min={0} max={100} onChange={()=>{}} />
                    <Toggle label="Preserve Lighting" checked={true} onChange={()=>{}} />
                    <div className="grid grid-cols-2 gap-2"><button className="py-2 border rounded">Preview</button><button className="py-2 bg-foreground text-background rounded">Apply</button></div>
                </div>
            );
            case 'lighting': return (
                <div className="space-y-4">
                    <SegmentedControl value="global" options={[{label:'Global Relight', value:'global'}, {label:'Local', value:'local'}]} onChange={()=>{}} />
                    <Slider label="Time of Day" value={14} min={0} max={24} onChange={()=>{}} />
                    <div className="h-20 bg-surface-sunken rounded flex items-center justify-center text-xs">[Compass]</div>
                    <Slider label="Brightness" value={50} min={0} max={100} onChange={()=>{}} />
                    <Slider label="Shadows" value={50} min={0} max={100} onChange={()=>{}} />
                    <Slider label="Highlights" value={50} min={0} max={100} onChange={()=>{}} />
                    <div className="grid grid-cols-2 gap-2"><button className="py-2 border rounded">Preview</button><button className="py-2 bg-foreground text-background rounded">Apply</button></div>
                </div>
            );
            case 'object': return (
                <div className="space-y-4">
                    <select className="w-full h-8 text-xs bg-surface-elevated border border-border rounded px-2"><option>Furniture</option><option>Vegetation</option><option>People</option></select>
                    <div className="grid grid-cols-3 gap-2">
                        {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-surface-elevated border border-border rounded cursor-pointer hover:border-foreground"/>)}
                    </div>
                    <Slider label="Scale" value={1} min={0.1} max={5} step={0.1} onChange={()=>{}} />
                    <Toggle label="Auto-scale" checked={true} onChange={()=>{}} />
                    <Toggle label="Match Lighting" checked={true} onChange={()=>{}} />
                    <button className="w-full py-2 bg-foreground text-background rounded text-xs font-bold">Place Object</button>
                </div>
            );
            case 'sky': return (
                <div className="space-y-4">
                    <Toggle label="Auto-detect Sky" checked={true} onChange={()=>{}} />
                    <div className="grid grid-cols-2 gap-2">
                        {['Clear', 'Cloudy', 'Sunset', 'Night'].map(s => <button key={s} className="py-2 text-xs border rounded hover:bg-surface-elevated">{s}</button>)}
                    </div>
                    <button className="w-full py-2 text-xs border rounded flex items-center justify-center gap-2"><Upload size={12}/> Custom Sky</button>
                    <Slider label="Horizon Blend" value={50} min={0} max={100} onChange={()=>{}} />
                    <Toggle label="Update Reflections" checked={true} onChange={()=>{}} />
                    <div className="grid grid-cols-2 gap-2"><button className="py-2 border rounded">Preview</button><button className="py-2 bg-foreground text-background rounded">Apply</button></div>
                </div>
            );
            case 'adjust': return (
                <div className="space-y-4">
                    <div>
                        <div className="text-[10px] font-bold uppercase text-foreground-muted mb-1">Tone</div>
                        <Slider label="Exposure" value={0} min={-100} max={100} onChange={()=>{}} />
                        <Slider label="Contrast" value={0} min={-100} max={100} onChange={()=>{}} />
                        <Slider label="Highlights" value={0} min={-100} max={100} onChange={()=>{}} />
                        <Slider label="Shadows" value={0} min={-100} max={100} onChange={()=>{}} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase text-foreground-muted mb-1">Color</div>
                        <Slider label="Temp" value={0} min={-100} max={100} onChange={()=>{}} />
                        <Slider label="Sat" value={0} min={-100} max={100} onChange={()=>{}} />
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                        {['Nat', 'Viv', 'Mat', 'B&W'].map(p => <button key={p} className="text-[10px] border rounded py-1 hover:bg-surface-elevated">{p}</button>)}
                    </div>
                    <div className="grid grid-cols-2 gap-2"><button className="py-2 border rounded text-xs">Reset</button><button className="py-2 bg-foreground text-background rounded text-xs">Apply</button></div>
                </div>
            );
            default: return <div className="p-4 text-xs text-center text-foreground-muted">Select a tool from the left toolbar.</div>;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                <Wrench size={16} className="text-accent" />
                <h3 className="text-sm font-bold capitalize">{tool || 'Tool'} Options</h3>
            </div>
            {renderToolOptions()}
        </div>
    );
};

// --- FEATURE 5: EXPLODED VIEWS ---
const ExplodedPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">View Type</label>
                <SegmentedControl value="axon" options={[{label:'Axonometric', value:'axon'}, {label:'Perspective', value:'persp'}]} onChange={()=>{}} />
            </div>
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Direction</label>
                <div className="h-20 bg-surface-sunken border border-border rounded flex items-center justify-center text-xs">[3D Direction Picker]</div>
            </div>
            <Slider label="Separation Distance" value={50} min={0} max={200} onChange={()=>{}} />
            
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Visual Style</label>
                <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2 mb-2"><option>Diagrammatic</option><option>Photorealistic</option><option>Technical</option></select>
                <SegmentedControl value="sys" options={[{label:'Realistic Color', value:'real'}, {label:'By System', value:'sys'}]} onChange={()=>{}} />
                <div className="mt-2 space-y-1">
                    <Toggle label="Labels" checked={true} onChange={()=>{}} />
                    <Toggle label="Leader Lines" checked={true} onChange={()=>{}} />
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Animation</label>
                <Toggle label="Enable Animation" checked={false} onChange={()=>{}} />
                <SegmentedControl value="exp" options={[{label:'Assembly', value:'assembly'}, {label:'Explosion', value:'exp'}]} onChange={()=>{}} />
                <Slider label="Duration (s)" value={3} min={1} max={10} onChange={()=>{}} />
                <div className="flex gap-2 mt-2">
                    <button className="flex-1 py-1 text-xs border rounded bg-surface-elevated">GIF</button>
                    <button className="flex-1 py-1 text-xs border rounded hover:bg-surface-elevated">MP4</button>
                </div>
                <button className="w-full mt-2 py-2 border rounded flex items-center justify-center gap-2 text-xs hover:bg-surface-elevated"><Play size={12}/> Preview</button>
            </div>

            <Accordion items={[
                { id: 'out', title: 'Output', content: (
                    <div className="space-y-3">
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>4K Resolution</option><option>1080p</option></select>
                        <Toggle label="Transparent Background" checked={true} onChange={()=>{}} />
                    </div>
                )}
            ]} />
        </div>
    );
};

// --- FEATURE 6: RENDER TO SECTION ---
const SectionPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Type</label>
                <SegmentedControl value="tech" options={[{label:'Technical', value:'tech'}, {label:'Rendered', value:'render'}, {label:'Hybrid', value:'hybrid'}]} onChange={()=>{}} />
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Cut Style</label>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs">Poche Color</span>
                    <ColorPicker color="#000000" onChange={()=>{}} />
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                    {['Solid', 'Diag', 'Cross', 'Conc'].map(p => <button key={p} className="h-8 border rounded bg-surface-elevated text-[10px]">{p}</button>)}
                </div>
                <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2 mb-2"><option>Heavy Cut Line</option><option>Medium</option></select>
                <Slider label="Beyond Visibility" value={50} min={0} max={100} onChange={()=>{}} />
            </div>

            <Accordion items={[
                { id: 'lines', title: 'Line Weights', content: (
                    <div className="space-y-3">
                        <Slider label="Cut Lines" value={4} min={1} max={10} onChange={()=>{}} />
                        <Slider label="View Lines" value={2} min={1} max={5} onChange={()=>{}} />
                        <Slider label="Grid Lines" value={1} min={0} max={2} onChange={()=>{}} />
                    </div>
                )}
            ]} />

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Annotations</label>
                <div className="space-y-1">
                    <Toggle label="Dimensions" checked={true} onChange={()=>{}} />
                    <Toggle label="Level Markers" checked={true} onChange={()=>{}} />
                    <Toggle label="Material Tags" checked={false} onChange={()=>{}} />
                </div>
            </div>

            <Accordion items={[
                { id: 'out', title: 'Output', content: (
                    <div className="space-y-3">
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>1:50</option><option>1:100</option><option>1:200</option></select>
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>PDF (Vector)</option><option>DWG</option><option>PNG</option></select>
                    </div>
                )}
            ]} />
        </div>
    );
};

// --- FEATURE 7: SKETCH TO RENDER ---
const SketchPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Interpretation</label>
                <div className="flex justify-between text-[10px] text-foreground-muted mb-1"><span>Faithful</span><span>Creative</span></div>
                <Slider value={50} min={0} max={100} onChange={()=>{}} />
            </div>

            <Accordion items={[
                { id: 'mat', title: 'Materials', content: (
                    <div className="space-y-3">
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>Concrete & Glass</option><option>Wood & Brick</option><option>White Stucco</option></select>
                        <Slider label="Texture Scale" value={100} min={10} max={200} onChange={()=>{}} />
                    </div>
                )},
                { id: 'lit', title: 'Lighting', content: (
                    <div className="space-y-3">
                        <Toggle label="Match Sketch Shadows" checked={true} onChange={()=>{}} />
                        <Slider label="Light Direction" value={45} min={0} max={360} onChange={()=>{}} />
                        <Slider label="Warmth" value={50} min={0} max={100} onChange={()=>{}} />
                    </div>
                )},
                { id: 'ctx', title: 'Context', content: (
                    <div className="space-y-3">
                        <SegmentedControl value="urban" options={[{label:'Urban', value:'urban'}, {label:'Nature', value:'nature'}]} onChange={()=>{}} />
                        <Toggle label="Add Surroundings" checked={true} onChange={()=>{}} />
                    </div>
                )},
                { id: 'out', title: 'Output', content: (
                    <div className="space-y-3">
                        <NumberInput label="Variations" value={4} min={1} max={8} onChange={()=>{}} />
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>High Resolution</option><option>Standard</option></select>
                    </div>
                )},
            ]} />
        </div>
    );
};

// --- FEATURE 8: UPSCALING ---
const UpscalePanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Scale Factor</label>
                <div className="flex gap-2 mb-2">
                    {['2x', '4x', '8x'].map(x => <button key={x} className="flex-1 py-3 border rounded text-sm font-bold hover:bg-surface-elevated">{x}</button>)}
                </div>
                <div className="flex justify-between text-[10px] text-foreground-muted">
                    <span>In: 1024x1024</span>
                    <span>Out: 4096x4096</span>
                </div>
                <div className="mt-2 p-2 bg-yellow-50 text-yellow-700 text-[10px] rounded border border-yellow-200 flex gap-2">
                    <AlertTriangle size={12} /> Large upscales may take time.
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Enhancement</label>
                <SegmentedControl value="arch" options={[{label:'General', value:'gen'}, {label:'Architecture', value:'arch'}, {label:'Photo', value:'photo'}]} onChange={()=>{}} />
                <div className="mt-3 space-y-3">
                    <Slider label="Detail Gen" value={20} min={0} max={100} onChange={()=>{}} />
                    <Slider label="Noise Reduction" value={50} min={0} max={100} onChange={()=>{}} />
                    <Slider label="Sharpening" value={30} min={0} max={100} onChange={()=>{}} />
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Color</label>
                <Toggle label="Color Enhancement" checked={true} onChange={()=>{}} />
                <Slider label="Saturation" value={0} min={-50} max={50} onChange={()=>{}} />
            </div>

            <Accordion items={[
                { id: 'out', title: 'Output', content: (
                    <div className="space-y-3">
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>PNG</option><option>JPG</option><option>TIFF</option></select>
                        <Toggle label="Keep Metadata" checked={true} onChange={()=>{}} />
                    </div>
                )}
            ]} />
        </div>
    );
};

// --- FEATURE 9: IMAGE TO CAD ---
const ImageToCadPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Type</label>
                <SegmentedControl value="plan" options={[{label:'Elevation', value:'elev'}, {label:'Plan', value:'plan'}, {label:'Detail', value:'detail'}]} onChange={()=>{}} />
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Line Settings</label>
                <div className="space-y-3">
                    <Slider label="Sensitivity" value={50} min={0} max={100} onChange={()=>{}} />
                    <Slider label="Simplification" value={20} min={0} max={100} onChange={()=>{}} />
                    <Toggle label="Connect Gaps" checked={true} onChange={()=>{}} />
                    <div className="flex justify-between items-center text-xs"><span>Gap Tolerance</span><input className="w-12 h-6 bg-surface-sunken border border-border rounded text-center" defaultValue="5px"/></div>
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Layers</label>
                <div className="space-y-1">
                    {['Walls', 'Windows', 'Details', 'Hidden Lines'].map(l => (
                        <div key={l} className="flex justify-between items-center p-1.5 bg-surface-elevated border border-border rounded text-xs">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 bg-black rounded-full"/> {l}</span>
                            <Settings size={12} className="text-foreground-muted" />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Scale</label>
                <div className="flex gap-2">
                    <input className="flex-1 h-8 bg-surface-sunken border border-border rounded px-2 text-xs" placeholder="1:100" />
                    <button className="px-3 border rounded hover:bg-surface-elevated"><Wrench size={12}/></button>
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Format</label>
                <div className="grid grid-cols-4 gap-1 mb-2">
                    {['DXF', 'DWG', 'SVG', 'PDF'].map(f => <button key={f} className="text-[10px] border rounded py-1.5 hover:bg-surface-elevated">{f}</button>)}
                </div>
                <Toggle label="Separate Layers" checked={true} onChange={()=>{}} />
                <Toggle label="Line Weights" checked={true} onChange={()=>{}} />
            </div>
        </div>
    );
};

// --- FEATURE 10: IMAGE TO 3D MODEL ---
const ImageTo3DPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Quality</label>
                <SegmentedControl value="std" options={[{label:'Draft', value:'draft'}, {label:'Standard', value:'std'}, {label:'High', value:'high'}]} onChange={()=>{}} />
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Geometry</label>
                <SegmentedControl value="arch" options={[{label:'Organic', value:'organic'}, {label:'Architectural', value:'arch'}]} onChange={()=>{}} />
                <div className="mt-3 space-y-3">
                    <Slider label="Edge Detection" value={50} min={0} max={100} onChange={()=>{}} />
                    <Toggle label="Fill Holes" checked={true} onChange={()=>{}} />
                    <Toggle label="Smooth Normals" checked={false} onChange={()=>{}} />
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Textures</label>
                <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>2K Resolution</option><option>4K Resolution</option></select>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Format</label>
                <div className="grid grid-cols-4 gap-1 mb-2">
                    {['OBJ', 'FBX', 'GLB', 'USD'].map(f => <button key={f} className="text-[10px] border rounded py-1.5 hover:bg-surface-elevated">{f}</button>)}
                </div>
                <Toggle label="Include Textures" checked={true} onChange={()=>{}} />
                <Toggle label="Include Materials" checked={true} onChange={()=>{}} />
            </div>
        </div>
    );
};

// --- FEATURE 11: AI VIDEO PRODUCTION ---
const VideoPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Duration</label>
                <div className="flex gap-2">
                    {['5s', '10s', '30s'].map(d => <button key={d} className="flex-1 py-2 text-xs border rounded hover:bg-surface-elevated">{d}</button>)}
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Frame Rate</label>
                <div className="flex gap-2">
                    {['24', '30', '60'].map(f => <button key={f} className="flex-1 py-2 text-xs border rounded hover:bg-surface-elevated">{f}</button>)}
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Motion</label>
                <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2 mb-2"><option>Cinematic Slow</option><option>Dynamic</option></select>
                <Slider label="Smoothness" value={50} min={0} max={100} onChange={()=>{}} />
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Camera</label>
                <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2 mb-2"><option>Orbit</option><option>Flythrough</option><option>Pan</option></select>
                <div className="p-2 border border-border rounded bg-surface-sunken text-xs text-center text-foreground-muted">[Camera Behavior Controls]</div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Effects</label>
                <Toggle label="Motion Blur" checked={true} onChange={()=>{}} />
                <Toggle label="Depth of Field" checked={true} onChange={()=>{}} />
                <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2 mt-2"><option>Neutral Grade</option><option>Film</option></select>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Audio</label>
                <Toggle label="Music" checked={false} onChange={()=>{}} />
                <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2 mt-1"><option>Ambient Arch</option><option>Corporate</option></select>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output</label>
                <div className="grid grid-cols-3 gap-1 mb-2">
                    {['HD', 'FHD', '4K'].map(r => <button key={r} className="text-[10px] border rounded py-1.5 hover:bg-surface-elevated">{r}</button>)}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    {['MP4', 'MOV'].map(f => <button key={f} className="text-[10px] border rounded py-1.5 hover:bg-surface-elevated">{f}</button>)}
                </div>
                <Slider label="Quality" value={80} min={0} max={100} onChange={()=>{}} />
                <div className="text-[10px] text-foreground-muted mt-1">Est. Size: 45MB • Time: ~2m</div>
            </div>
        </div>
    );
};

// --- Material Validation (Preserved) ---
const ValidationPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-3">Documents</h4>
                <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-surface-elevated border border-border rounded">
                        <span className="text-xs">Specs.pdf</span><CheckCircle2 size={12} className="text-green-500"/>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-surface-elevated border border-border rounded">
                        <span className="text-xs">BoQ.xlsx</span><CheckCircle2 size={12} className="text-green-500"/>
                    </div>
                    <button className="w-full py-1.5 flex items-center justify-center gap-2 border border-dashed border-border rounded text-xs text-foreground-muted hover:text-foreground">
                        <Upload size={12} /> Add Document
                    </button>
                </div>
            </div>
            <div>
                <h4 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-3">Checks</h4>
                <div className="space-y-2">
                    <Toggle label="Dimensions" checked={true} onChange={()=>{}} />
                    <Toggle label="Product Refs" checked={true} onChange={()=>{}} />
                    <Toggle label="Quantities" checked={true} onChange={()=>{}} />
                </div>
            </div>
            <div className="pt-4 border-t border-border-subtle">
                <button className="w-full py-2 bg-foreground text-background rounded text-xs font-bold flex items-center justify-center gap-2">
                    <Play size={12} fill="currentColor"/> Run Validation
                </button>
            </div>
        </div>
    );
};

// --- MAIN RIGHT PANEL ---

export const RightPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { rightPanelOpen, rightPanelWidth, mode } = state;

  // Hide Right Panel in 'generate-text' mode
  if (mode === 'generate-text') return null;

  if (!rightPanelOpen) {
    return (
      <div className="w-12 bg-background-tertiary border-l border-border relative flex flex-col items-center py-4 gap-4">
        <button 
          onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-md transition-all"
          title="Expand Panel"
        >
          <ChevronsLeft size={20} />
        </button>
        <div className="flex-1 flex items-center justify-center">
            <span 
              className="text-xs font-bold text-foreground-muted uppercase tracking-widest whitespace-nowrap transform rotate-180" 
              style={{ writingMode: 'vertical-rl' }}
            >
              Settings
            </span>
        </div>
      </div>
    );
  }

  let panelContent: React.ReactNode = null;
  let panelTitle = "Settings";
  let PanelIcon = Settings;

  switch (mode) {
      case 'generate-text': panelTitle = "Image Generation"; PanelIcon = Sparkle; panelContent = null; break; // This case is technically unreachable now
      case 'render-3d': panelTitle = "3D to Render"; PanelIcon = Box; panelContent = <Render3DPanel />; break;
      case 'render-cad': panelTitle = "CAD to Render"; PanelIcon = FileCode; panelContent = <CadToRenderPanel />; break;
      case 'masterplan': panelTitle = "Masterplan"; PanelIcon = Grid; panelContent = <MasterplanPanel />; break;
      case 'visual-edit': panelTitle = "Visual Editor"; PanelIcon = Wrench; panelContent = <VisualEditPanel />; break;
      case 'exploded': panelTitle = "Exploded View"; PanelIcon = Layers; panelContent = <ExplodedPanel />; break;
      case 'section': panelTitle = "Render to Section"; PanelIcon = FileCode; panelContent = <SectionPanel />; break; // Icon approx
      case 'render-sketch': panelTitle = "Sketch to Render"; PanelIcon = Brush; panelContent = <SketchPanel />; break;
      case 'upscale': panelTitle = "Upscaler"; PanelIcon = Maximize2; panelContent = <UpscalePanel />; break;
      case 'img-to-cad': panelTitle = "Image to CAD"; PanelIcon = FileCode; panelContent = <ImageToCadPanel />; break;
      case 'img-to-3d': panelTitle = "Image to 3D"; PanelIcon = Box; panelContent = <ImageTo3DPanel />; break;
      case 'video': panelTitle = "Video Studio"; PanelIcon = Video; panelContent = <VideoPanel />; break;
      case 'material-validation': panelTitle = "Validation"; PanelIcon = CheckCircle2; panelContent = <ValidationPanel />; break;
      default: panelTitle = "Settings"; panelContent = <div className="p-4 text-center text-xs text-foreground-muted">Select a workflow</div>;
  }

  return (
    <div 
      className={cn(
        "bg-background-tertiary border-l border-border flex flex-col overflow-hidden transition-all relative z-10",
        rightPanelWidth ? `w-[${rightPanelWidth}px]` : "w-[320px]"
      )}
    >
      <div className="shrink-0 p-5 pb-3 bg-background-tertiary border-b border-border-subtle flex justify-between items-center">
          <div className="flex items-center gap-2">
              <PanelIcon size={16} className="text-foreground-secondary"/>
              <h2 className="text-sm font-bold tracking-tight text-foreground">{panelTitle}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button className="text-foreground-muted hover:text-foreground p-1"><HelpCircle size={14}/></button>
            <button 
                onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
                className="text-foreground-muted hover:text-foreground hover:bg-surface-sunken p-1 rounded-md transition-colors"
            >
                <ChevronsRight size={16} />
            </button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
         {panelContent}
      </div>
      
      <div className="shrink-0 p-3 border-t border-border-subtle bg-surface-sunken text-[10px] text-foreground-muted">
         <div className="flex items-center gap-2 mb-1">
            <Share2 size={12} /> <span>Press <span className="font-mono bg-background border rounded px-1">Space</span> to pan</span>
         </div>
         <div className="flex items-center gap-2">
            <MonitorPlay size={12} /> <span><span className="font-mono bg-background border rounded px-1">Ctrl+Z</span> to undo</span>
         </div>
      </div>
    </div>
  );
};