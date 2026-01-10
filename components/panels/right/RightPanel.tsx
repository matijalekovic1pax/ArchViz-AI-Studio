
import React from 'react';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { cn } from '../../../lib/utils';
import { 
  Box, Camera, Sun, Palette, Users, Shield, Sparkles, SlidersHorizontal, Target, Lightbulb,
  Eye, EyeOff, Video, Zap, Clock, RotateCcw, Move, ArrowUp, Circle, Maximize,
  Wrench, MousePointer, Image as ImageIcon, ClipboardCheck, Compass, Aperture, Cloud, Droplets, User, TreePine, Car, Armchair,
  Move3d, Focus, MousePointer2, Layers, Grid
} from 'lucide-react';
import { CameraMotionType, VideoModel } from '../../../types';

// --- Shared Components ---

const StyleSelector = ({ state, dispatch }: any) => (
  <div className="space-y-3 mb-6">
     <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Generation Mode</h4>
     <div className="space-y-1">
        {[
          { id: 'enhance', label: 'Enhance', icon: Shield, desc: 'Preserve geometry' },
          { id: 'stylize', label: 'Stylize', icon: Sparkles, desc: 'Heavy transformation' },
          { id: 'hybrid', label: 'Hybrid', icon: SlidersHorizontal, desc: 'Balanced' },
          { id: 'strict-realism', label: 'Strict', icon: Target, desc: 'Competition accuracy' },
          { id: 'concept-push', label: 'Concept', icon: Lightbulb, desc: 'Mood & Story' }
        ].map(m => (
           <button 
             key={m.id}
             onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { renderMode: m.id as any } })}
             className={cn("w-full flex items-center p-2 rounded border text-left transition-all", 
               state.workflow.renderMode === m.id ? "bg-surface-elevated border-foreground shadow-sm" : "border-transparent hover:bg-surface-elevated"
             )}
           >
              <m.icon size={16} className={cn("mr-3", state.workflow.renderMode === m.id ? "text-accent" : "text-foreground-muted")} />
              <div>
                 <div className="text-xs font-medium">{m.label}</div>
                 <div className="text-[10px] text-foreground-muted">{m.desc}</div>
              </div>
           </button>
        ))}
     </div>
  </div>
);

// --- Standard Blocks ---

const GeometryBlock = ({ dispatch, state }: any) => {
  const g = state.geometry;
  return (
    <div className="space-y-6">
      <div>
        <h5 className="section-header mb-2">Locks & Constraints</h5>
        <div className="space-y-2">
          <Toggle label="Lock Geometry" checked={g.lockGeometry} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { lockGeometry: v } })} />
          <Toggle label="Lock Perspective" checked={g.lockPerspective} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { lockPerspective: v } })} />
          <Toggle label="Lock Camera Position" checked={g.lockCameraPosition} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { lockCameraPosition: v } })} />
          <Toggle label="Lock Framing" checked={g.lockFraming} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { lockFraming: v } })} />
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Refinement</h5>
        <div className="space-y-2">
          <Toggle label="Allow Minor Refinement" checked={g.allowMinorRefinement} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { allowMinorRefinement: v } })} />
          <Toggle label="Allow Reinterpretation" checked={g.allowReinterpretation} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { allowReinterpretation: v } })} />
          <Toggle label="Suppress Hallucinations" checked={g.suppressHallucinations} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { suppressHallucinations: v } })} />
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Adherence Strength</h5>
        <div className="space-y-4">
          <Slider label="Geometry Preservation" value={g.geometryPreservation} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { geometryPreservation: v } })} />
          <Slider label="Perspective Adherence" value={g.perspectiveAdherence} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { perspectiveAdherence: v } })} />
          <Slider label="Framing Adherence" value={g.framingAdherence} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { framingAdherence: v } })} />
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Edge Control</h5>
        <SegmentedControl 
          value={g.edgeDefinition} 
          options={[{label: 'Sharp', value: 'sharp'}, {label: 'Soft', value: 'soft'}, {label: 'Adaptive', value: 'adaptive'}]}
          onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { edgeDefinition: v } })}
          className="mb-3"
        />
        <Slider label="Edge Strength" value={g.edgeStrength} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { edgeStrength: v } })} />
      </div>
    </div>
  );
};

const CameraBlock = ({ dispatch, state }: any) => {
  const c = state.camera;
  return (
    <div className="space-y-6">
      <div>
        <h5 className="section-header mb-2">Field of View</h5>
        <SegmentedControl 
          value={c.fovMode} 
          options={[{label: 'Narrow', value: 'narrow'}, {label: 'Norm', value: 'normal'}, {label: 'Wide', value: 'wide'}, {label: 'Ultra', value: 'ultra-wide'}]}
          onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { fovMode: v } })}
          className="mb-3"
        />
        {c.fovMode === 'custom' && (
           <Slider label="FOV Value" value={c.fov} min={15} max={120} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { fov: v } })} />
        )}
      </div>

      <div>
        <h5 className="section-header mb-2">View Type</h5>
        <div className="space-y-3">
          <select 
            className="w-full bg-surface-sunken border border-border rounded text-xs p-2"
            value={c.viewType}
            onChange={(e) => dispatch({ type: 'UPDATE_CAMERA', payload: { viewType: e.target.value } })}
          >
            <option value="eye-level">Eye-Level</option>
            <option value="aerial">Aerial</option>
            <option value="drone">Drone</option>
            <option value="worm">Worm's Eye</option>
            <option value="custom">Custom</option>
          </select>
          {c.viewType === 'custom' && (
            <Slider label="Camera Height (m)" value={c.cameraHeight} min={0.5} max={500} step={0.5} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { cameraHeight: v } })} />
          )}
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Projection</h5>
        <SegmentedControl 
          value={c.projection}
          options={[{label: 'Persp', value: 'perspective'}, {label: 'Axon', value: 'axonometric'}, {label: 'Iso', value: 'isometric'}, {label: '2-Pt', value: 'two-point'}]}
          onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { projection: v } })}
        />
      </div>

      <div>
        <h5 className="section-header mb-2">Corrections</h5>
        <div className="space-y-2">
          <Toggle label="Vertical Correction" checked={c.verticalCorrection} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { verticalCorrection: v } })} />
          {c.verticalCorrection && <Slider label="Strength" value={c.verticalCorrectionStrength} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { verticalCorrectionStrength: v } })} />}
          
          <Toggle label="Horizon Lock" checked={c.horizonLock} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { horizonLock: v } })} />
          {c.horizonLock && <Slider label="Horizon Pos" value={c.horizonPosition} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { horizonPosition: v } })} />}
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Depth of Field</h5>
        <div className="space-y-2">
          <Toggle label="Enable DOF" checked={c.depthOfField} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { depthOfField: v } })} />
          {c.depthOfField && (
            <>
              <Slider label="Strength" value={c.dofStrength} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { dofStrength: v } })} />
              <div className="text-xs text-foreground-secondary mb-1">Focal Point</div>
              <select 
                className="w-full bg-surface-sunken border border-border rounded text-xs p-2"
                value={c.focalPoint}
                onChange={(e) => dispatch({ type: 'UPDATE_CAMERA', payload: { focalPoint: e.target.value } })}
              >
                <option value="center">Center</option>
                <option value="subject">Subject</option>
                <option value="foreground">Foreground</option>
                <option value="background">Background</option>
              </select>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const LightingBlock = ({ dispatch, state }: any) => {
  const l = state.lighting;
  return (
    <div className="space-y-6">
      <div>
        <h5 className="section-header mb-2">Time & Sun</h5>
        <div className="grid grid-cols-2 gap-2 mb-3">
           {['morning', 'midday', 'afternoon', 'golden-hour', 'blue-hour', 'night', 'overcast'].map((t: any) => (
             <button 
                key={t}
                onClick={() => dispatch({ type: 'UPDATE_LIGHTING', payload: { timeOfDay: t } })}
                className={cn(
                  "p-2 rounded border text-xs capitalize flex items-center justify-center",
                  l.timeOfDay === t ? "bg-foreground text-background border-foreground" : "bg-surface-elevated border-border hover:border-foreground-muted"
                )}
             >
                {t.replace('-', ' ')}
             </button>
           ))}
        </div>
        {l.timeOfDay === 'custom' && (
           <Slider label="Custom Time (Hr)" value={l.customTime} min={0} max={24} step={0.5} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { customTime: v } })} />
        )}
        
        <div className="mt-4 space-y-4">
           <Slider label="Sun Azimuth" value={l.sunAzimuth} min={0} max={360} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { sunAzimuth: v } })} />
           <Slider label="Sun Altitude" value={l.sunAltitude} min={0} max={90} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { sunAltitude: v } })} />
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Atmosphere</h5>
        <div className="space-y-4">
           <Slider label="Cloud Cover" value={l.cloudCover} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { cloudCover: v } })} />
           <select 
             className="w-full bg-surface-sunken border border-border rounded text-xs p-2"
             value={l.cloudType}
             onChange={(e) => dispatch({ type: 'UPDATE_LIGHTING', payload: { cloudType: e.target.value } })}
           >
             <option value="clear">Clear</option>
             <option value="scattered">Scattered</option>
             <option value="overcast">Overcast</option>
             <option value="dramatic">Dramatic</option>
             <option value="stormy">Stormy</option>
           </select>
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Shadows & GI</h5>
        <div className="space-y-4">
           <Slider label="Shadow Softness" value={l.shadowSoftness} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { shadowSoftness: v } })} />
           <Slider label="Shadow Intensity" value={l.shadowIntensity} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { shadowIntensity: v } })} />
           <Slider label="Ambient GI" value={l.ambientGIStrength} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { ambientGIStrength: v } })} />
           <Toggle label="Bounce Light" checked={l.bounceLight} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { bounceLight: v } })} />
           {l.bounceLight && <Slider label="Bounce Intensity" value={l.bounceLightIntensity} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { bounceLightIntensity: v } })} />}
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Weather Effects</h5>
        <div className="space-y-2">
           <div className="flex items-center gap-2">
              <Toggle label="Fog" checked={l.fog} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { fog: v } })} />
              {l.fog && <input type="number" className="w-12 h-6 text-xs bg-surface-sunken border rounded px-1" value={l.fogDensity} onChange={(e) => dispatch({ type: 'UPDATE_LIGHTING', payload: { fogDensity: Number(e.target.value) } })} />}
           </div>
           <div className="flex items-center gap-2">
              <Toggle label="Haze" checked={l.haze} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { haze: v } })} />
              {l.haze && <input type="number" className="w-12 h-6 text-xs bg-surface-sunken border rounded px-1" value={l.hazeIntensity} onChange={(e) => dispatch({ type: 'UPDATE_LIGHTING', payload: { hazeIntensity: Number(e.target.value) } })} />}
           </div>
           
           <div className="pt-2">
              <div className="text-xs text-foreground-secondary mb-1">Precipitation</div>
              <SegmentedControl 
                 value={l.weather}
                 options={[{label: 'None', value: 'clear'}, {label: 'Rain', value: 'rain'}, {label: 'Snow', value: 'snow'}]}
                 onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { weather: v } })}
              />
           </div>
        </div>
      </div>
      
      <div>
         <h5 className="section-header mb-2">Rules</h5>
         <Toggle label="Physical Plausibility" checked={l.enforcePhysicalPlausibility} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { enforcePhysicalPlausibility: v } })} />
         <Toggle label="Dramatic Lighting" checked={l.allowDramaticLighting} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { allowDramaticLighting: v } })} />
      </div>
    </div>
  );
};

const MaterialBlock = ({ dispatch, state }: any) => {
  const m = state.materials;
  return (
    <div className="space-y-6">
      <div>
        <h5 className="section-header mb-2">Material Emphasis</h5>
        <div className="space-y-4">
           {/* In a real implementation these would be accordions with more controls */}
           <Slider label="Concrete" value={m.concreteEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { concreteEmphasis: v } })} />
           <Slider label="Glass" value={m.glassEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { glassEmphasis: v } })} />
           <Slider label="Metal" value={m.metalEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { metalEmphasis: v } })} />
           <Slider label="Wood" value={m.woodEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { woodEmphasis: v } })} />
           <Slider label="Stone" value={m.stoneEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { stoneEmphasis: v } })} />
           <Slider label="Composite" value={m.compositeEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { compositeEmphasis: v } })} />
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2">Global Settings</h5>
        <div className="space-y-4">
           <Slider label="Texture Sharpness" value={m.textureSharpness} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { textureSharpness: v } })} />
           <Slider label="Reflectivity Bias" value={m.reflectivityBias} min={-50} max={50} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { reflectivityBias: v } })} />
           <Slider label="Aging Level" value={m.agingLevel} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { agingLevel: v } })} />
           <Slider label="Clean vs Raw" value={m.cleanVsRaw} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { cleanVsRaw: v } })} />
        </div>
      </div>
    </div>
  );
};

const ContextBlock = ({ dispatch, state }: any) => {
  const c = state.context;
  return (
    <div className="space-y-6">
      <div>
        <h5 className="section-header mb-2 flex items-center gap-2"><User size={12}/> People</h5>
        <div className="space-y-3">
           <Toggle label="Enable People" checked={c.people} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { people: v } })} />
           {c.people && (
             <div className="pl-2 space-y-3 border-l border-border ml-1">
                <div>
                   <label className="text-xs text-foreground-secondary mb-1 block">Density</label>
                   <SegmentedControl 
                      value={c.peopleDensity} 
                      options={[{label:'Sparse', value:'sparse'}, {label:'Mod', value:'moderate'}, {label:'Busy', value:'busy'}]}
                      onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { peopleDensity: v } })}
                   />
                </div>
                <div>
                   <label className="text-xs text-foreground-secondary mb-1 block">Scale</label>
                   <SegmentedControl 
                      value={c.peopleScale} 
                      options={[{label:'Accurate', value:'accurate'}, {label:'Small', value:'smaller'}, {label:'Large', value:'larger'}]}
                      onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { peopleScale: v } })}
                   />
                </div>
             </div>
           )}
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2 flex items-center gap-2"><TreePine size={12}/> Vegetation</h5>
        <div className="space-y-3">
           <Toggle label="Enable Vegetation" checked={c.vegetation} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { vegetation: v } })} />
           {c.vegetation && (
             <div className="pl-2 space-y-3 border-l border-border ml-1">
                <Slider label="Density" value={c.vegetationDensity} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { vegetationDensity: v } })} />
                <div>
                   <label className="text-xs text-foreground-secondary mb-1 block">Season</label>
                   <SegmentedControl 
                      value={c.season} 
                      options={[{label:'Spr', value:'spring'}, {label:'Sum', value:'summer'}, {label:'Aut', value:'autumn'}, {label:'Win', value:'winter'}]}
                      onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { season: v } })}
                   />
                </div>
             </div>
           )}
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2 flex items-center gap-2"><Car size={12}/> Vehicles</h5>
        <div className="space-y-3">
           <Toggle label="Enable Vehicles" checked={c.vehicles} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { vehicles: v } })} />
           {c.vehicles && (
              <div className="pl-2 border-l border-border ml-1">
                 <SegmentedControl 
                    value={c.vehicleDensity} 
                    options={[{label:'Few', value:'few'}, {label:'Mod', value:'moderate'}, {label:'Traffic', value:'traffic'}]}
                    onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { vehicleDensity: v } })}
                 />
              </div>
           )}
        </div>
      </div>

      <div>
        <h5 className="section-header mb-2 flex items-center gap-2"><Armchair size={12}/> Urban Furniture</h5>
        <Toggle label="Enable Furniture" checked={c.urbanFurniture} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { urbanFurniture: v } })} />
      </div>

      <div>
         <h5 className="section-header mb-2">Context Rules</h5>
         <Toggle label="No Scale Violations" checked={c.scaleCheck} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { scaleCheck: v } })} />
         <Toggle label="No Irrelevant Props" checked={c.noIrrelevantProps} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { noIrrelevantProps: v } })} />
         <Toggle label="Architecture Dominant" checked={c.architectureDominant} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { architectureDominant: v } })} />
         <Slider label="Context Subtlety" value={c.contextSubtlety} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { contextSubtlety: v } })} />
      </div>
    </div>
  );
};

const OutputBlock = ({ dispatch, state }: any) => {
  const o = state.output;
  return (
    <div className="space-y-6">
      <div>
        <h5 className="section-header mb-2">Resolution</h5>
        <SegmentedControl 
           value={o.resolution}
           options={[{label:'2K', value:'2k'}, {label:'4K', value:'4k'}, {label:'8K', value:'8k'}, {label:'Custom', value:'custom'}]}
           onChange={(v) => dispatch({ type: 'UPDATE_OUTPUT', payload: { resolution: v } })}
        />
      </div>

      <div>
        <h5 className="section-header mb-2">Aspect Ratio</h5>
        <SegmentedControl 
           value={o.aspectRatio}
           options={[{label:'1:1', value:'1:1'}, {label:'16:9', value:'16:9'}, {label:'4:5', value:'4:5'}, {label:'9:16', value:'9:16'}]}
           onChange={(v) => dispatch({ type: 'UPDATE_OUTPUT', payload: { aspectRatio: v } })}
        />
      </div>

      <div>
        <h5 className="section-header mb-2">Format</h5>
        <div className="space-y-3">
           <SegmentedControl 
              value={o.format}
              options={[{label:'PNG', value:'png'}, {label:'JPG', value:'jpg'}]}
              onChange={(v) => dispatch({ type: 'UPDATE_OUTPUT', payload: { format: v } })}
           />
           {o.format === 'jpg' && <Slider label="Quality" value={o.jpgQuality} min={1} max={100} onChange={(v) => dispatch({ type: 'UPDATE_OUTPUT', payload: { jpgQuality: v } })} />}
        </div>
      </div>

      <div>
         <h5 className="section-header mb-2">Metadata</h5>
         <Toggle label="Embed Metadata" checked={o.embedMetadata} onChange={(v) => dispatch({ type: 'UPDATE_OUTPUT', payload: { embedMetadata: v } })} />
      </div>
    </div>
  );
};

// --- Feature Specific Panels ---

const VisualEditTools = ({ dispatch, state }: any) => {
  const tool = state.workflow.activeTool;
  const wf = state.workflow;
  
  const update = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

  return (
    <div className="space-y-6">
      <div className="p-3 bg-surface-elevated border border-border rounded-lg flex items-center gap-3">
         <div className="w-8 h-8 bg-surface-sunken rounded flex items-center justify-center text-foreground-secondary">
            {tool === 'select' && <MousePointer2 size={16} />}
            {tool === 'material' && <Palette size={16} />}
            {tool === 'lighting' && <Sun size={16} />}
            {tool === 'object' && <Box size={16} />}
            {tool === 'sky' && <Cloud size={16} />}
            {tool === 'adjust' && <Wrench size={16} />}
            {tool === 'pan' && <Move size={16} />}
            {tool === 'remove' && <EyeOff size={16} />}
         </div>
         <div>
            <div className="text-xs font-bold uppercase">{tool} Tool</div>
            <div className="text-[10px] text-foreground-muted">Configure active tool settings</div>
         </div>
      </div>

      {tool === 'pan' && (
         <div className="space-y-4">
            <div className="p-3 bg-surface-sunken rounded text-xs text-foreground-secondary leading-relaxed">
               Use the canvas controls to navigate your image.
               <ul className="list-disc list-inside mt-2 space-y-1 text-foreground-muted">
                  <li>Click & Drag to Pan</li>
                  <li>Scroll to Zoom</li>
               </ul>
            </div>
            <div>
               <h5 className="section-header mb-2">View Controls</h5>
               <div className="grid grid-cols-2 gap-2">
                  <button 
                     className="p-2 border border-border rounded text-xs hover:bg-surface-sunken transition-colors"
                     onClick={() => dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 })}
                  >
                     100%
                  </button>
                  <button 
                     className="p-2 border border-border rounded text-xs hover:bg-surface-sunken transition-colors"
                     onClick={() => {
                        dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
                        dispatch({ type: 'SET_CANVAS_ZOOM', payload: 0.8 });
                     }}
                  >
                     Fit Screen
                  </button>
               </div>
            </div>
         </div>
      )}

      {tool === 'select' && (
         <>
            <div>
               <h5 className="section-header mb-2">Selection Mode</h5>
               <SegmentedControl 
                  value={wf.visualSelection.mode}
                  options={[{label:'Rect', value:'rect'}, {label:'Lasso', value:'lasso'}, {label:'AI', value:'ai'}]}
                  onChange={(v) => update({ visualSelection: {...wf.visualSelection, mode: v} })}
               />
            </div>
            {wf.visualSelection.mode === 'ai' && (
               <div className="text-xs text-foreground-secondary p-2 bg-surface-sunken rounded">
                  Click on objects to auto-select (facade, windows, sky)
               </div>
            )}
            <Slider label="Feather" value={wf.visualSelection.feather} min={0} max={50} onChange={(v) => update({ visualSelection: {...wf.visualSelection, feather: v} })} />
         </>
      )}

      {tool === 'material' && (
         <>
            <div>
               <h5 className="section-header mb-2">Material Replacement</h5>
               <div className="grid grid-cols-2 gap-2 mb-3">
                  {['Brick', 'Stone', 'Wood', 'Metal'].map(m => (
                     <button key={m} className="p-2 border rounded text-xs hover:bg-surface-sunken">{m}</button>
                  ))}
               </div>
               <Slider label="Intensity" value={wf.visualMaterial.intensity} min={0} max={100} onChange={(v) => update({ visualMaterial: {...wf.visualMaterial, intensity: v} })} />
               <Toggle label="Preserve Lighting" checked={wf.visualMaterial.preserveLight} onChange={(v) => update({ visualMaterial: {...wf.visualMaterial, preserveLight: v} })} />
            </div>
         </>
      )}

      {tool === 'lighting' && (
         <>
            <div>
               <h5 className="section-header mb-2">Adjustment</h5>
               <SegmentedControl 
                  value={wf.visualLighting.mode}
                  options={[{label:'Global', value:'global'}, {label:'Local', value:'local'}]}
                  onChange={(v) => update({ visualLighting: {...wf.visualLighting, mode: v} })}
                  className="mb-3"
               />
               <Slider label="Brightness" value={wf.visualLighting.brightness} min={-50} max={50} onChange={(v) => update({ visualLighting: {...wf.visualLighting, brightness: v} })} />
               <Slider label="Shadows" value={wf.visualLighting.shadows} min={-50} max={50} onChange={(v) => update({ visualLighting: {...wf.visualLighting, shadows: v} })} />
            </div>
         </>
      )}
      
      {tool === 'object' && (
         <>
            <div>
               <h5 className="section-header mb-2">Library</h5>
               <select className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 mb-2">
                  <option>People - Walking</option>
                  <option>People - Standing</option>
                  <option>Vegetation - Trees</option>
                  <option>Vehicles - Cars</option>
               </select>
               <Slider label="Scale" value={wf.visualObject.scale} min={0.1} max={3} step={0.1} onChange={(v) => update({ visualObject: {...wf.visualObject, scale: v} })} />
               <Toggle label="Match Lighting" checked={wf.visualObject.matchLight} onChange={(v) => update({ visualObject: {...wf.visualObject, matchLight: v} })} />
            </div>
         </>
      )}

      {tool === 'sky' && (
         <>
            <div>
               <h5 className="section-header mb-2">Sky Replacement</h5>
               <div className="grid grid-cols-2 gap-2 mb-3">
                  {['Clear', 'Cloudy', 'Sunset', 'Night'].map(s => (
                     <button key={s} className="p-2 border rounded text-xs hover:bg-surface-sunken">{s}</button>
                  ))}
               </div>
               <Slider label="Horizon Blend" value={wf.visualSky.blend} min={0} max={100} onChange={(v) => update({ visualSky: {...wf.visualSky, blend: v} })} />
               <Toggle label="Auto-Detect Sky" checked={wf.visualSky.auto} onChange={(v) => update({ visualSky: {...wf.visualSky, auto: v} })} />
            </div>
         </>
      )}

      {tool === 'remove' && (
         <>
            <div>
               <h5 className="section-header mb-2">Removal Brush</h5>
               <Slider label="Brush Size" value={50} min={5} max={200} onChange={() => {}} />
               <div className="mt-4">
                  <h5 className="section-header mb-2">Mode</h5>
                  <SegmentedControl 
                     value="object"
                     options={[{label: 'Object', value: 'object'}, {label: 'Defect', value: 'defect'}, {label: 'Text', value: 'text'}]}
                     onChange={() => {}}
                  />
               </div>
            </div>
            <div className="mt-4 p-3 bg-surface-sunken rounded text-xs text-foreground-muted">
               Paint over the element you wish to remove. The AI will intelligently fill the gap.
            </div>
         </>
      )}

      {tool === 'adjust' && (
         <>
            <div>
               <h5 className="section-header mb-2">Tone</h5>
               <Slider label="Exposure" value={wf.visualAdjust.exposure} min={-2} max={2} step={0.1} onChange={(v) => update({ visualAdjust: {...wf.visualAdjust, exposure: v} })} />
               <Slider label="Contrast" value={wf.visualAdjust.contrast} min={-100} max={100} onChange={(v) => update({ visualAdjust: {...wf.visualAdjust, contrast: v} })} />
            </div>
            <div>
               <h5 className="section-header mb-2">Color</h5>
               <Slider label="Temperature" value={wf.visualAdjust.temp} min={-100} max={100} onChange={(v) => update({ visualAdjust: {...wf.visualAdjust, temp: v} })} />
               <Slider label="Saturation" value={wf.visualAdjust.saturation} min={-100} max={100} onChange={(v) => update({ visualAdjust: {...wf.visualAdjust, saturation: v} })} />
            </div>
         </>
      )}
    </div>
  );
};

const VideoControls = ({ dispatch, state }: any) => {
   const v = state.workflow.videoState;
   const update = (payload: any) => dispatch({ type: 'UPDATE_VIDEO_STATE', payload });
   const updateCam = (payload: any) => dispatch({ type: 'UPDATE_VIDEO_CAMERA', payload });

   return (
      <div className="space-y-6">
         <div>
            <h5 className="section-header mb-2">Timeline</h5>
            <Slider label="Duration (s)" value={v.duration} min={5} max={60} step={1} onChange={(val) => update({ duration: val })} />
            <div className="mt-3">
               <label className="text-xs text-foreground-secondary mb-1 block">Frame Rate</label>
               <SegmentedControl 
                  value={String(v.fps)}
                  options={[{label:'24', value:'24'}, {label:'30', value:'30'}, {label:'60', value:'60'}]}
                  onChange={(val) => update({ fps: parseInt(val) })}
               />
            </div>
         </div>

         {v.inputMode === 'image-animate' && (
            <div>
               <h5 className="section-header mb-2">Motion</h5>
               <Slider label="Motion Amount" value={v.motionAmount} min={1} max={10} onChange={(val) => update({ motionAmount: val })} />
            </div>
         )}

         {v.inputMode === 'camera-path' && (
            <div>
               <h5 className="section-header mb-2">Camera Path</h5>
               <select 
                  className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 mb-3"
                  value={v.camera.type}
                  onChange={(e) => updateCam({ type: e.target.value })}
               >
                  <option value="orbit">Orbit</option>
                  <option value="dolly">Dolly (Zoom)</option>
                  <option value="pan">Pan</option>
                  <option value="crane">Crane Up/Down</option>
               </select>
               <Slider label="Smoothness" value={v.camera.smoothness} min={0} max={100} onChange={(val) => updateCam({ smoothness: val })} />
            </div>
         )}

         <div>
            <h5 className="section-header mb-2">Output</h5>
            <SegmentedControl 
               value={v.resolution}
               options={[{label:'720p', value:'720p'}, {label:'1080p', value:'1080p'}, {label:'4K', value:'4k'}]}
               onChange={(val) => update({ resolution: val })}
            />
         </div>
      </div>
   );
};

const UpscaleControls = ({ dispatch, state }: any) => {
   const wf = state.workflow;
   return (
      <div className="space-y-6">
         <div>
            <h5 className="section-header mb-2">Scale Factor</h5>
            <SegmentedControl 
               value={wf.upscaleFactor}
               options={[{label:'2x', value:'2x'}, {label:'4x', value:'4x'}, {label:'8x', value:'8x'}]}
               onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { upscaleFactor: v } })}
            />
            <div className="mt-2 text-[10px] text-foreground-muted">
               Target resolution: {wf.upscaleFactor === '2x' ? '4K' : wf.upscaleFactor === '4x' ? '8K' : '16K'}
            </div>
         </div>
         <div>
            <h5 className="section-header mb-2">Enhancement</h5>
            <SegmentedControl 
               value={wf.upscaleMode}
               options={[{label:'General', value:'general'}, {label:'Arch', value:'arch'}, {label:'Photo', value:'photo'}]}
               onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { upscaleMode: v } })}
               className="mb-3"
            />
            <Slider label="Creativity" value={wf.upscaleCreativity} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { upscaleCreativity: v } })} />
         </div>
      </div>
   );
};

const CadInterpretationControls = ({ dispatch, state }: any) => {
   const wf = state.workflow;
   const update = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

   return (
      <div className="space-y-6">
         {wf.cadDrawingType === 'plan' && (
            <div>
               <h5 className="section-header mb-2">Camera Position</h5>
               <Slider label="Height (m)" value={wf.cadCamera.height} min={1} max={10} step={0.1} onChange={(v) => update({ cadCamera: {...wf.cadCamera, height: v} })} />
               <div className="mt-2">
                  <label className="text-xs text-foreground-secondary mb-1 block">Look Angle</label>
                  <SegmentedControl 
                     value={wf.cadCamera.angle}
                     options={[{label:'Level', value:'horizontal'}, {label:'Down', value:'down'}, {label:'Up', value:'up'}]}
                     onChange={(v) => update({ cadCamera: {...wf.cadCamera, angle: v} })}
                  />
               </div>
            </div>
         )}

         <div>
            <h5 className="section-header mb-2">Spatial Interpretation</h5>
            <Slider label="Ceiling Height" value={wf.cadSpatial.ceilingHeight} min={2.4} max={5} step={0.1} onChange={(v) => update({ cadSpatial: {...wf.cadSpatial, ceilingHeight: v} })} />
            <Slider label="Style Creativity" value={wf.cadSpatial.style} min={0} max={100} onChange={(v) => update({ cadSpatial: {...wf.cadSpatial, style: v} })} />
         </div>

         <div>
            <h5 className="section-header mb-2">Furnishing</h5>
            <Toggle label="Auto-furnish" checked={wf.cadFurnishing.auto} onChange={(v) => update({ cadFurnishing: {...wf.cadFurnishing, auto: v} })} />
            {wf.cadFurnishing.auto && (
               <div className="mt-2 pl-2 border-l border-border">
                  <Slider label="Density" value={wf.cadFurnishing.density} min={0} max={100} onChange={(v) => update({ cadFurnishing: {...wf.cadFurnishing, density: v} })} />
               </div>
            )}
         </div>
      </div>
   );
};

const MasterplanControls = ({ dispatch, state }: any) => {
   const wf = state.workflow;
   const update = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

   return (
      <div className="space-y-6">
         <div>
            <h5 className="section-header mb-2">Output Type</h5>
            <select 
               className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
               value={wf.mpOutputType}
               onChange={(e) => update({ mpOutputType: e.target.value })}
            >
               <option value="photorealistic">Photorealistic Aerial</option>
               <option value="diagrammatic">Diagrammatic</option>
               <option value="hybrid">Hybrid</option>
               <option value="illustrative">Illustrative</option>
            </select>
         </div>

         <div>
            <h5 className="section-header mb-2">Building Style</h5>
            <select 
               className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 mb-3"
               value={wf.mpBuildingStyle.style}
               onChange={(e) => update({ mpBuildingStyle: {...wf.mpBuildingStyle, style: e.target.value} })}
            >
               <option value="Contemporary">Contemporary</option>
               <option value="Traditional">Traditional</option>
               <option value="Minimalist">Minimalist</option>
            </select>
            <Slider label="Default Height (m)" value={wf.mpBuildingStyle.defaultHeight} min={5} max={100} onChange={(v) => update({ mpBuildingStyle: {...wf.mpBuildingStyle, defaultHeight: v} })} />
         </div>

         <div>
            <h5 className="section-header mb-2">Multi-View Export</h5>
            <div className="space-y-1">
               <Toggle label="Top-Down Diagram" checked={wf.mpExport.topDown} onChange={(v) => update({ mpExport: {...wf.mpExport, topDown: v} })} />
               <Toggle label="Aerial NE" checked={wf.mpExport.aerialNE} onChange={(v) => update({ mpExport: {...wf.mpExport, aerialNE: v} })} />
               <Toggle label="Aerial SW" checked={wf.mpExport.aerialSW} onChange={(v) => update({ mpExport: {...wf.mpExport, aerialSW: v} })} />
            </div>
         </div>
      </div>
   );
};

const ImageToCadControls = ({ dispatch, state }: any) => {
   const wf = state.workflow;
   const update = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

   return (
      <div className="space-y-6">
         <div>
            <h5 className="section-header mb-2">Line Settings</h5>
            <Slider label="Sensitivity" value={wf.imgToCadLine.sensitivity} min={0} max={100} onChange={(v) => update({ imgToCadLine: {...wf.imgToCadLine, sensitivity: v} })} />
            <Slider label="Simplification" value={wf.imgToCadLine.simplify} min={0} max={100} onChange={(v) => update({ imgToCadLine: {...wf.imgToCadLine, simplify: v} })} />
            <Toggle label="Connect Gaps" checked={wf.imgToCadLine.connect} onChange={(v) => update({ imgToCadLine: {...wf.imgToCadLine, connect: v} })} />
         </div>
         <div>
            <h5 className="section-header mb-2">Output</h5>
            <SegmentedControl 
               value={wf.imgToCadFormat}
               options={[{label:'DXF', value:'dxf'}, {label:'DWG', value:'dwg'}, {label:'SVG', value:'svg'}, {label:'PDF', value:'pdf'}]}
               onChange={(v) => update({ imgToCadFormat: v })}
            />
         </div>
      </div>
   );
};

const ImageTo3DControls = ({ dispatch, state }: any) => {
   const wf = state.workflow;
   const update = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

   return (
      <div className="space-y-6">
         <div>
            <h5 className="section-header mb-2">Geometry</h5>
            <SegmentedControl 
               value={wf.img3dMesh.type}
               options={[{label:'Organic', value:'organic'}, {label:'Arch', value:'arch'}]}
               onChange={(v) => update({ img3dMesh: {...wf.img3dMesh, type: v} })}
               className="mb-3"
            />
            <Slider label="Edge Detection" value={wf.img3dMesh.edges} min={0} max={100} onChange={(v) => update({ img3dMesh: {...wf.img3dMesh, edges: v} })} />
            <Toggle label="Fill Holes" checked={wf.img3dMesh.fill} onChange={(v) => update({ img3dMesh: {...wf.img3dMesh, fill: v} })} />
         </div>
         <div>
            <h5 className="section-header mb-2">Output</h5>
            <SegmentedControl 
               value={wf.img3dOutput.format}
               options={[{label:'OBJ', value:'obj'}, {label:'FBX', value:'fbx'}, {label:'GLTF', value:'gltf'}]}
               onChange={(v) => update({ img3dOutput: {...wf.img3dOutput, format: v} })}
            />
         </div>
      </div>
   );
};

const SectionControls = ({ dispatch, state }: any) => {
   const wf = state.workflow;
   const update = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

   return (
      <div className="space-y-6">
         <div>
            <h5 className="section-header mb-2">Cut Style</h5>
            <div className="grid grid-cols-2 gap-2 mb-3">
               {['Black', 'Gray'].map(c => (
                  <button key={c} onClick={() => update({ sectionStyle: {...wf.sectionStyle, poche: c.toLowerCase()} })} 
                     className={cn("p-2 border rounded text-xs", wf.sectionStyle.poche === c.toLowerCase() ? "bg-foreground text-background" : "hover:bg-surface-sunken")}>
                     {c} Poche
                  </button>
               ))}
            </div>
            <label className="text-xs text-foreground-secondary mb-1 block">Hatch Pattern</label>
            <select className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 mb-3"
               value={wf.sectionStyle.hatch} onChange={(e) => update({ sectionStyle: {...wf.sectionStyle, hatch: e.target.value} })}>
               <option value="solid">Solid</option>
               <option value="diag">Diagonal</option>
               <option value="cross">Cross-hatch</option>
            </select>
            <Slider label="Show Beyond" value={wf.sectionStyle.showBeyond} min={0} max={100} onChange={(v) => update({ sectionStyle: {...wf.sectionStyle, showBeyond: v} })} />
         </div>
      </div>
   );
};

const ExplodedControls = ({ dispatch, state }: any) => {
   const wf = state.workflow;
   const update = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

   return (
      <div className="space-y-6">
         <div>
            <h5 className="section-header mb-2">Visual Style</h5>
            <SegmentedControl 
               value={wf.explodedStyle.render}
               options={[{label:'Photo', value:'photo'}, {label:'Diagram', value:'diagram'}, {label:'Tech', value:'tech'}]}
               onChange={(v) => update({ explodedStyle: {...wf.explodedStyle, render: v} })}
               className="mb-3"
            />
            <Toggle label="Labels" checked={wf.explodedStyle.labels} onChange={(v) => update({ explodedStyle: {...wf.explodedStyle, labels: v} })} />
            <Toggle label="Leader Lines" checked={wf.explodedStyle.leaders} onChange={(v) => update({ explodedStyle: {...wf.explodedStyle, leaders: v} })} />
         </div>
         <div>
            <h5 className="section-header mb-2">Animation</h5>
            <Toggle label="Generate Animation" checked={wf.explodedAnim.generate} onChange={(v) => update({ explodedAnim: {...wf.explodedAnim, generate: v} })} />
            {wf.explodedAnim.generate && (
               <div className="mt-2 pl-2 border-l border-border">
                  <SegmentedControl 
                     value={wf.explodedAnim.type}
                     options={[{label:'Assembly', value:'assembly'}, {label:'Explosion', value:'explosion'}]}
                     onChange={(v) => update({ explodedAnim: {...wf.explodedAnim, type: v} })}
                     className="mb-2"
                  />
                  <Slider label="Duration (s)" value={wf.explodedAnim.duration} min={1} max={10} step={0.5} onChange={(v) => update({ explodedAnim: {...wf.explodedAnim, duration: v} })} />
               </div>
            )}
         </div>
      </div>
   );
};

const SketchControls = ({ dispatch, state }: any) => {
   const wf = state.workflow;
   const update = (payload: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload });

   return (
      <div className="space-y-6">
         <div>
            <h5 className="section-header mb-2">Interpretation</h5>
            <div className="px-1 mb-2 flex justify-between text-[10px] text-foreground-muted">
               <span>Faithful</span>
               <span>Creative</span>
            </div>
            <Slider label="Level" value={wf.sketchInterpretation} min={0} max={100} onChange={(v) => update({ sketchInterpretation: v })} />
         </div>
         <div>
            <h5 className="section-header mb-2">Variations</h5>
            <button className="w-full py-2 bg-surface-elevated border border-border rounded text-xs hover:border-foreground transition-colors">
               Generate 4 Variations
            </button>
         </div>
      </div>
   );
};

// --- Material Validation Controls ---

const MaterialValidationSettings = ({ state, dispatch }: any) => {
  return (
    <div className="space-y-6">
       <div className="flex items-center gap-3 p-3 bg-surface-elevated border border-border rounded-lg shadow-sm">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
             <ClipboardCheck size={16} />
          </div>
          <div>
             <h4 className="text-xs font-bold uppercase tracking-wider">Validation Console</h4>
             <p className="text-[10px] text-foreground-muted">Review items in main view</p>
          </div>
       </div>

       <div>
          <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-2">Filters</h4>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-foreground-muted block mb-1">Building Area</label>
              <select className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2">
                <option>All Areas</option>
                <option>Terminal</option>
                <option>Cargo</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-foreground-muted block mb-1">Category</label>
              <select className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2">
                <option>All Categories</option>
                <option>Floor Finishes (FF)</option>
                <option>Wall Finishes (WF)</option>
                <option>Ceilings (IC)</option>
                <option>Wall Types (WP)</option>
                <option>Lighting (L)</option>
              </select>
            </div>
             <div>
              <label className="text-[10px] text-foreground-muted block mb-1">Status</label>
              <div className="flex gap-2">
                 <button className="flex-1 py-1.5 border border-border rounded bg-surface-elevated text-xs hover:border-foreground transition-colors">All</button>
                 <button className="flex-1 py-1.5 border border-border rounded bg-surface-elevated text-xs hover:border-red-500 text-red-600 transition-colors">Errors</button>
                 <button className="flex-1 py-1.5 border border-border rounded bg-surface-elevated text-xs hover:border-yellow-500 text-yellow-600 transition-colors">Warn</button>
              </div>
            </div>
          </div>
       </div>

       <div className="border-t border-border pt-4">
          <button className="w-full py-2 bg-foreground text-background rounded text-xs font-medium hover:bg-foreground/90 transition-colors shadow-sm">
             Generate Validation Report
          </button>
       </div>
    </div>
  );
};


// --- Main RightPanel Component ---

export const RightPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();

  const renderContent = () => {
    switch (state.mode) {
      case 'video': 
        return <VideoControls dispatch={dispatch} state={state} />;
      
      case 'visual-edit':
        return <VisualEditTools dispatch={dispatch} state={state} />;

      case 'upscale':
        return <UpscaleControls dispatch={dispatch} state={state} />;

      case 'material-validation':
        return <MaterialValidationSettings state={state} dispatch={dispatch} />;

      case 'img-to-cad':
         return <ImageToCadControls dispatch={dispatch} state={state} />;

      case 'img-to-3d':
         return <ImageTo3DControls dispatch={dispatch} state={state} />;

      case 'render-cad':
         return (
            <>
               <StyleSelector state={state} dispatch={dispatch} />
               <Accordion 
                  items={[
                     {id: 'interp', title: 'Interpretation', content: <CadInterpretationControls state={state} dispatch={dispatch}/>},
                     {id: 'geo', title: 'Geometry', content: <GeometryBlock state={state} dispatch={dispatch}/>},
                     {id: 'mat', title: 'Materials', content: <MaterialBlock state={state} dispatch={dispatch}/>},
                     {id: 'light', title: 'Lighting', content: <LightingBlock state={state} dispatch={dispatch}/>},
                     {id: 'out', title: 'Output', content: <OutputBlock state={state} dispatch={dispatch}/>},
                  ]} 
                  defaultValue="interp"
               />
            </>
         );

      case 'masterplan':
        return (
          <>
            <StyleSelector state={state} dispatch={dispatch} />
            <Accordion 
              items={[
                {id: 'mp', title: 'Visualization', content: <MasterplanControls state={state} dispatch={dispatch}/>},
                {id: 'light', title: 'Lighting & Sun', content: <LightingBlock state={state} dispatch={dispatch}/>},
                {id: 'ctx', title: 'Urban Context', content: <ContextBlock state={state} dispatch={dispatch}/>},
                {id: 'out', title: 'Output Settings', content: <OutputBlock state={state} dispatch={dispatch}/>},
              ]} 
              defaultValue="mp"
            />
          </>
        );

      case 'section':
         return (
            <>
               <StyleSelector state={state} dispatch={dispatch} />
               <Accordion 
                  items={[
                     {id: 'sec', title: 'Section Style', content: <SectionControls state={state} dispatch={dispatch}/>},
                     {id: 'geo', title: 'Geometry', content: <GeometryBlock state={state} dispatch={dispatch}/>},
                     {id: 'out', title: 'Output', content: <OutputBlock state={state} dispatch={dispatch}/>},
                  ]} 
                  defaultValue="sec"
               />
            </>
         );

      case 'exploded':
         return (
            <>
               <StyleSelector state={state} dispatch={dispatch} />
               <Accordion 
                  items={[
                     {id: 'exp', title: 'Explosion Controls', content: <ExplodedControls state={state} dispatch={dispatch}/>},
                     {id: 'cam', title: 'Camera', content: <CameraBlock state={state} dispatch={dispatch}/>},
                     {id: 'out', title: 'Output', content: <OutputBlock state={state} dispatch={dispatch}/>},
                  ]} 
                  defaultValue="exp"
               />
            </>
         );

      case 'render-sketch':
         return (
            <>
               <StyleSelector state={state} dispatch={dispatch} />
               <Accordion 
                  items={[
                     {id: 'sketch', title: 'Sketch Controls', content: <SketchControls state={state} dispatch={dispatch}/>},
                     {id: 'geo', title: 'Geometry', content: <GeometryBlock state={state} dispatch={dispatch}/>},
                     {id: 'mat', title: 'Materials', content: <MaterialBlock state={state} dispatch={dispatch}/>},
                     {id: 'light', title: 'Lighting', content: <LightingBlock state={state} dispatch={dispatch}/>},
                     {id: 'out', title: 'Output', content: <OutputBlock state={state} dispatch={dispatch}/>},
                  ]} 
                  defaultValue="sketch"
               />
            </>
         );

      case 'render-3d':
      default: 
        return (
          <>
            <StyleSelector state={state} dispatch={dispatch} />
            <Accordion 
              items={[
                {id: 'geo', title: 'Geometry & Limits', content: <GeometryBlock state={state} dispatch={dispatch}/>},
                {id: 'cam', title: 'Camera & View', content: <CameraBlock state={state} dispatch={dispatch}/>},
                {id: 'light', title: 'Lighting & Atmosphere', content: <LightingBlock state={state} dispatch={dispatch}/>},
                {id: 'mat', title: 'Materials & Finish', content: <MaterialBlock state={state} dispatch={dispatch}/>},
                {id: 'ctx', title: 'Context & Environment', content: <ContextBlock state={state} dispatch={dispatch}/>},
                {id: 'out', title: 'Output Settings', content: <OutputBlock state={state} dispatch={dispatch}/>},
              ]} 
              defaultValue="geo"
            />
          </>
        );
    }
  };

  return (
    <div className={cn("bg-surface-elevated border-l border-border flex flex-col shrink-0 transition-all", state.rightPanelWidth ? `w-[${state.rightPanelWidth}px]` : "w-[320px]")}>
       <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {renderContent()}
       </div>
    </div>
  );
};
