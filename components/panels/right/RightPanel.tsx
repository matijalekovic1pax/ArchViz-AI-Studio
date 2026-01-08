import React from 'react';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { cn } from '../../../lib/utils';
import { 
  Box, Camera, Sun, Palette, Users, Shield, Sparkles, SlidersHorizontal, Target, Lightbulb,
  Eye, EyeOff
} from 'lucide-react';

// --- Reusable Blocks ---

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

// --- Detailed Control Blocks (Merged from previous version) ---

const GeometryBlock = ({ dispatch, state }: any) => (
   <div className="space-y-4">
      {/* Constraints / Locks moved from Left Sidebar */}
      <div className="bg-surface-sunken p-3 rounded-lg space-y-2 border border-border-subtle">
         <h5 className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mb-1">Constraints</h5>
         <Toggle 
            label="Lock Geometry" 
            checked={state.geometry.lockGeometry} 
            onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { lockGeometry: v, geometryPreservation: v ? 100 : state.geometry.geometryPreservation } })} 
         />
         <Toggle 
            label="Lock Perspective" 
            checked={state.geometry.lockPerspective} 
            onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { lockPerspective: v, perspectiveAdherence: v ? 100 : state.geometry.perspectiveAdherence } })} 
         />
         <Toggle 
            label="Lock Framing" 
            checked={state.geometry.lockFraming} 
            onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { lockFraming: v, framingAdherence: v ? 100 : state.geometry.framingAdherence } })} 
         />
         <Toggle 
            label="Lock Camera" 
            checked={state.geometry.lockCameraPosition} 
            onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { lockCameraPosition: v } })} 
         />
      </div>

      <div className="space-y-3 pt-2">
         <Slider 
            label="Geometry Preservation" 
            value={state.geometry.geometryPreservation} 
            min={0} max={100} 
            disabled={state.geometry.lockGeometry}
            onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { geometryPreservation: v } })} 
         />
         <Slider 
            label="Perspective Adherence" 
            value={state.geometry.perspectiveAdherence} 
            min={0} max={100} 
            disabled={state.geometry.lockPerspective}
            onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { perspectiveAdherence: v } })} 
         />
         <Slider 
            label="Framing Adherence" 
            value={state.geometry.framingAdherence} 
            min={0} max={100} 
            disabled={state.geometry.lockFraming}
            onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { framingAdherence: v } })} 
         />
      </div>

      <div className="bg-surface-sunken p-3 rounded border border-border-subtle">
         <label className="text-xs text-foreground-secondary block mb-2">Edge Control</label>
         <SegmentedControl value={state.geometry.edgeDefinition} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { edgeDefinition: v } })} options={[{label:'Sharp', value:'sharp'}, {label:'Adapt', value:'adaptive'}, {label:'Soft', value:'soft'}]} />
         <div className="mt-3">
            <Toggle label="Suppress Hallucinations" checked={state.geometry.suppressHallucinations} onChange={(v) => dispatch({ type: 'UPDATE_GEOMETRY', payload: { suppressHallucinations: v } })} />
         </div>
      </div>
   </div>
);

const CameraBlock = ({ dispatch, state }: any) => (
   <div className="space-y-4">
      <div>
        <label className="text-xs text-foreground-secondary block mb-2">FOV Mode</label>
        <SegmentedControl value={state.camera.fovMode} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { fovMode: v } })} options={[{label:'Narrow', value:'narrow'}, {label:'Normal', value:'normal'}, {label:'Wide', value:'wide'}, {label:'Ultra', value:'ultra-wide'}]} />
      </div>
      <div>
        <label className="text-xs text-foreground-secondary block mb-2">View Type</label>
        <SegmentedControl value={state.camera.viewType} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { viewType: v } })} options={[{label:'Eye', value:'eye-level'}, {label:'Aerial', value:'aerial'}, {label:'Drone', value:'drone'}, {label:'Worm', value:'worm'}]} />
      </div>
      <div>
        <label className="text-xs text-foreground-secondary block mb-2">Projection</label>
        <SegmentedControl value={state.camera.projection} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { projection: v } })} options={[{label:'Persp', value:'perspective'}, {label:'Axon', value:'axonometric'}, {label:'Iso', value:'isometric'}]} />
      </div>
      <div className="bg-surface-sunken p-3 rounded-lg space-y-2">
         <Toggle label="Vertical Correction" checked={state.camera.verticalCorrection} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { verticalCorrection: v } })} />
         <Toggle label="Horizon Lock" checked={state.camera.horizonLock} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { horizonLock: v } })} />
         <Toggle label="Depth of Field" checked={state.camera.depthOfField} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { depthOfField: v } })} />
         {state.camera.depthOfField && <Slider label="Strength" value={state.camera.dofStrength} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_CAMERA', payload: { dofStrength: v } })} />}
      </div>
   </div>
);

const LightingBlock = ({ dispatch, state }: any) => (
  <div className="space-y-4">
    <select 
       className="w-full h-9 bg-surface-elevated border border-border rounded px-2 text-sm"
       value={state.lighting.timeOfDay}
       onChange={(e) => dispatch({ type: 'UPDATE_LIGHTING', payload: { timeOfDay: e.target.value } })}
    >
       <option value="morning">Morning</option>
       <option value="midday">Midday</option>
       <option value="afternoon">Afternoon</option>
       <option value="golden-hour">Golden Hour</option>
       <option value="blue-hour">Blue Hour</option>
       <option value="night">Night</option>
       <option value="overcast">Overcast</option>
    </select>
    
    <div className="space-y-3">
      <Slider label="Sun Azimuth" value={state.lighting.sunAzimuth} min={0} max={360} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { sunAzimuth: v } })} />
      <Slider label="Sun Altitude" value={state.lighting.sunAltitude} min={0} max={90} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { sunAltitude: v } })} />
    </div>
    
    <div className="space-y-3">
      <Slider label="Shadow Softness" value={state.lighting.shadowSoftness} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { shadowSoftness: v } })} />
      <Slider label="Shadow Intensity" value={state.lighting.shadowIntensity} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { shadowIntensity: v } })} />
    </div>
    
    <div className="bg-surface-sunken p-3 rounded-lg space-y-2">
       <Toggle label="Fog / Haze" checked={state.lighting.fog} onChange={(v) => dispatch({ type: 'UPDATE_LIGHTING', payload: { fog: v } })} />
       <div className="flex items-center justify-between">
          <label className="text-sm text-foreground-secondary">Weather</label>
          <select 
             className="h-7 bg-surface-elevated border border-border rounded text-xs px-2"
             value={state.lighting.weather}
             onChange={(e) => dispatch({ type: 'UPDATE_LIGHTING', payload: { weather: e.target.value } })}
          >
             <option value="clear">Clear</option>
             <option value="cloudy">Cloudy</option>
             <option value="rain">Rain</option>
             <option value="snow">Snow</option>
          </select>
       </div>
    </div>
  </div>
);

const MaterialBlock = ({ dispatch, state }: any) => (
   <div className="space-y-4">
      <div>
         <h4 className="text-xs font-semibold text-foreground-secondary mb-3">Material Emphasis</h4>
         <Slider className="mb-3" label="Concrete" value={state.materials.concreteEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { concreteEmphasis: v } })} />
         <Slider className="mb-3" label="Glass" value={state.materials.glassEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { glassEmphasis: v } })} />
         <Slider className="mb-3" label="Wood" value={state.materials.woodEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { woodEmphasis: v } })} />
         <Slider className="mb-3" label="Metal" value={state.materials.metalEmphasis} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { metalEmphasis: v } })} />
      </div>
      <div className="bg-surface-sunken p-3 rounded-lg space-y-3">
         <h4 className="text-xs font-semibold text-foreground-secondary">Global Settings</h4>
         <Slider label="Texture Sharpness" value={state.materials.textureSharpness} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { textureSharpness: v } })} />
         <Slider label="Aging / Weathering" value={state.materials.agingLevel} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { agingLevel: v } })} />
         <Slider label="Reflectivity Bias" value={state.materials.reflectivityBias} min={-50} max={50} onChange={(v) => dispatch({ type: 'UPDATE_MATERIALS', payload: { reflectivityBias: v } })} />
      </div>
   </div>
);

const ContextBlock = ({ dispatch, state }: any) => (
   <div className="space-y-4">
      <div className="bg-surface-sunken p-3 rounded-lg space-y-3">
         <div className="flex items-center justify-between">
            <Toggle label="People" checked={state.context.people} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { people: v } })} />
            {state.context.people && (
               <select 
                  className="h-7 bg-surface-elevated border border-border rounded text-xs px-2"
                  value={state.context.peopleDensity}
                  onChange={(e) => dispatch({ type: 'UPDATE_CONTEXT', payload: { peopleDensity: e.target.value } })}
               >
                  <option value="sparse">Sparse</option>
                  <option value="moderate">Moderate</option>
                  <option value="busy">Busy</option>
               </select>
            )}
         </div>
         <Toggle label="Vegetation" checked={state.context.vegetation} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { vegetation: v } })} />
         <Toggle label="Vehicles" checked={state.context.vehicles} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { vehicles: v } })} />
         <Toggle label="Urban Furniture" checked={state.context.urbanFurniture} onChange={(v) => dispatch({ type: 'UPDATE_CONTEXT', payload: { urbanFurniture: v } })} />
      </div>
   </div>
);

// --- Feature Specific Right Panels ---

// 1. 3D to Render
const Render3DControls = ({ state, dispatch }: any) => {
   const items = [
      { id: 'geometry', title: 'Geometry', content: <GeometryBlock state={state} dispatch={dispatch} /> },
      { id: 'camera', title: 'Camera', content: <CameraBlock state={state} dispatch={dispatch} /> },
      { id: 'lighting', title: 'Lighting', content: <LightingBlock state={state} dispatch={dispatch} /> },
      { id: 'materials', title: 'Materials', content: <MaterialBlock state={state} dispatch={dispatch} /> },
      { id: 'context', title: 'Context', content: <ContextBlock state={state} dispatch={dispatch} /> },
   ];

   return (
      <>
         <StyleSelector state={state} dispatch={dispatch} />
         <Accordion items={items} defaultValue="geometry" />
      </>
   );
};

// 2. CAD to Render
const RenderCADControls = ({ state, dispatch }: any) => {
   const wf = state.workflow;
   const update = (key: string, val: any) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { cadSpatial: { ...wf.cadSpatial, [key]: val } } });
   
   return (
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Camera Position</h4>
            <div className="bg-surface-sunken p-3 rounded space-y-3">
               <div className="h-24 border border-dashed border-border rounded flex items-center justify-center text-xs text-foreground-muted">
                  [Interactive Plan Cam]
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span>Height</span>
                  <input className="w-16 bg-transparent text-right font-mono" value={wf.cadCamera.height + "m"} readOnly />
               </div>
            </div>
         </div>
         
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Spatial Interpretation</h4>
            <div className="space-y-3">
               <Slider label="Ceiling Height" value={wf.cadSpatial.ceilingHeight} min={2} max={5} step={0.1} onChange={(v) => update('ceilingHeight', v)} />
               <Slider label="Interpretation Style" labelRight="Creative" value={wf.cadSpatial.style} min={0} max={100} onChange={(v) => update('style', v)} />
            </div>
         </div>

         {/* Re-use Lighting Block for CAD workflow */}
         <div className="border-t border-border pt-4">
            <Accordion items={[{ id: 'lighting', title: 'Lighting Setup', content: <LightingBlock state={state} dispatch={dispatch} /> }]} />
         </div>
      </div>
   );
};

// 3. Masterplan
const MasterplanGeneralBlock = ({ state, dispatch }: any) => {
    const wf = state.workflow;
    return (
        <div className="space-y-6">
             <div>
                <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Visualization Style</h4>
                <SegmentedControl 
                   value={wf.mpOutputType} 
                   onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpOutputType: v } })}
                   options={[{label:'Photo', value:'photorealistic'}, {label:'Diagram', value:'diagrammatic'}, {label:'Hybrid', value:'hybrid'}]}
                />
             </div>
             <div>
                <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Building Style</h4>
                <div className="space-y-3">
                   <div className="flex justify-between text-xs">
                      <span>Style</span>
                      <span className="text-foreground-secondary">{wf.mpBuildingStyle.style}</span>
                   </div>
                   <div className="bg-surface-sunken p-2 rounded">
                      <label className="text-xs block mb-2">Height Interpretation</label>
                      <div className="flex gap-2">
                         {['Uniform', 'Color', 'Random'].map(m => (
                            <button key={m} className={cn("flex-1 text-[10px] py-1 rounded border", wf.mpBuildingStyle.heightMode === m.toLowerCase() ? "bg-foreground text-background" : "bg-surface-elevated")}>
                               {m}
                            </button>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
        </div>
    );
};

const MasterplanControls = ({ state, dispatch }: any) => {
   const items = [
      { id: 'general', title: 'General Settings', content: <MasterplanGeneralBlock state={state} dispatch={dispatch} /> },
      { id: 'lighting', title: 'Lighting', content: <LightingBlock state={state} dispatch={dispatch} /> },
      { id: 'context', title: 'Context', content: <ContextBlock state={state} dispatch={dispatch} /> },
   ];

   return (
      <Accordion items={items} defaultValue="general" />
   );
};

// 4. Visual Edit (Dynamic Panel)
const VisualEditControls = ({ state, dispatch }: any) => {
   const tool = state.workflow.activeTool;
   const wf = state.workflow;

   const renderToolOptions = () => {
      switch (tool) {
         case 'select': return (
            <div className="space-y-4">
               <SegmentedControl value={wf.visualSelection.mode} onChange={() => {}} options={[{label:'Rect', value:'rect'}, {label:'Lasso', value:'lasso'}, {label:'AI', value:'ai'}]} />
               <Slider label="Feather" value={wf.visualSelection.feather} min={0} max={50} onChange={() => {}} />
               <div className="grid grid-cols-3 gap-2">
                  <button className="py-1 text-xs border rounded bg-surface-elevated">Add</button>
                  <button className="py-1 text-xs border rounded bg-surface-elevated">Sub</button>
                  <button className="py-1 text-xs border rounded bg-surface-elevated">Inv</button>
               </div>
            </div>
         );
         case 'material': return (
            <div className="space-y-4">
               <div className="text-xs p-2 bg-surface-sunken rounded">Current: {wf.visualMaterial.current}</div>
               <div className="grid grid-cols-2 gap-2">
                  {['Brick', 'Stone', 'Wood', 'Metal'].map(m => <button key={m} className="text-xs py-2 border rounded hover:border-accent">{m}</button>)}
               </div>
               <Slider label="Intensity" value={wf.visualMaterial.intensity} min={0} max={100} onChange={() => {}} />
               <Toggle label="Preserve Lighting" checked={wf.visualMaterial.preserveLight} onChange={() => {}} />
            </div>
         );
         case 'lighting': return (
            <div className="space-y-4">
               <SegmentedControl value={wf.visualLighting.mode} onChange={() => {}} options={[{label:'Global', value:'global'}, {label:'Local', value:'local'}]} />
               <Slider label="Brightness" value={wf.visualLighting.brightness} min={-50} max={50} onChange={() => {}} />
               <Slider label="Shadows" value={wf.visualLighting.shadows} min={-50} max={50} onChange={() => {}} />
            </div>
         );
         default: return <div className="text-xs text-foreground-muted">Select a tool to configure options.</div>;
      }
   };

   return (
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Tool Options: {tool}</h4>
            <div className="bg-surface-sunken p-3 rounded-lg border border-border-subtle">
               {renderToolOptions()}
            </div>
         </div>
         <div>
            <h4 className="flex justify-between items-center text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">
               Layers <span className="text-[10px] bg-surface-sunken px-1 rounded cursor-pointer">+</span>
            </h4>
            <div className="space-y-1">
               {wf.editLayers.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded text-xs">
                     <button>{l.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>
                     <span className="flex-1">{l.name}</span>
                     {l.locked && <span className="text-[10px]">🔒</span>}
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
};

// 5. Exploded
const ExplodedControls = ({ state, dispatch }: any) => {
   const wf = state.workflow;
   return (
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">View Settings</h4>
            <SegmentedControl value={wf.explodedView.type} onChange={() => {}} options={[{label:'Axonometric', value:'axon'}, {label:'Perspective', value:'perspective'}]} />
            <div className="mt-4">
               <Slider label="Separation" value={wf.explodedView.separation} min={0} max={100} onChange={() => {}} />
            </div>
         </div>
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Visual Style</h4>
            <div className="space-y-2">
               <SegmentedControl value={wf.explodedStyle.render} onChange={() => {}} options={[{label:'Photo', value:'photo'}, {label:'Diagram', value:'diagram'}, {label:'Tech', value:'tech'}]} />
               <div className="bg-surface-sunken p-3 rounded space-y-2">
                  <Toggle label="Labels" checked={wf.explodedStyle.labels} onChange={() => {}} />
                  <Toggle label="Leader Lines" checked={wf.explodedStyle.leaders} onChange={() => {}} />
               </div>
            </div>
         </div>
      </div>
   );
};

// 6. Section
const SectionControls = ({ state, dispatch }: any) => {
   const wf = state.workflow;
   return (
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Cut Style</h4>
            <div className="space-y-3">
               <div className="grid grid-cols-2 gap-2">
                  <button className="p-2 border border-foreground bg-black text-white text-xs rounded">Black Poche</button>
                  <button className="p-2 border border-border bg-gray-300 text-xs rounded">Gray Poche</button>
               </div>
               <Slider label="Show Beyond" value={wf.sectionStyle.showBeyond} min={0} max={100} onChange={() => {}} />
            </div>
         </div>
      </div>
   );
};

// 7. Sketch
const SketchControls = ({ state, dispatch }: any) => (
   <div className="space-y-6">
      <StyleSelector state={state} dispatch={dispatch} />
      <div>
         <Slider label="Interpretation Level" labelRight="Creative" value={state.workflow.sketchInterpretation} min={0} max={100} onChange={() => {}} />
         <div className="bg-surface-sunken p-3 rounded text-center mt-3">
            <button className="text-xs bg-foreground text-background px-4 py-2 rounded">Generate 4 Variations</button>
         </div>
      </div>
      <div className="border-t border-border pt-4">
         <Accordion items={[
            { id: 'lighting', title: 'Lighting', content: <LightingBlock state={state} dispatch={dispatch} /> },
            { id: 'materials', title: 'Materials', content: <MaterialBlock state={state} dispatch={dispatch} /> }
         ]} />
      </div>
   </div>
);

// 8. Upscale
const UpscaleControls = ({ state, dispatch }: any) => {
   const wf = state.workflow;
   return (
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Scale Factor</h4>
            <div className="flex gap-2 mb-4">
               {['2x', '4x', '8x'].map(x => (
                  <button key={x} className={cn("flex-1 py-2 text-sm font-bold border rounded", wf.upscaleFactor === x ? "bg-foreground text-background" : "bg-surface-elevated")}>
                     {x}
                  </button>
               ))}
            </div>
            <div className="text-xs text-foreground-muted font-mono mb-4">
               Input: 1024x576 → Output: 4096x2304
            </div>
         </div>
         <div className="space-y-4">
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Enhancement</h4>
            <SegmentedControl value={wf.upscaleMode} onChange={() => {}} options={[{label:'General', value:'general'}, {label:'Arch', value:'arch'}, {label:'Photo', value:'photo'}]} />
            <Slider label="Detail Creativity" value={wf.upscaleCreativity} min={0} max={50} onChange={() => {}} />
         </div>
      </div>
   );
};

// 9. Image to CAD
const ImageToCadControls = ({ state, dispatch }: any) => {
   const wf = state.workflow;
   return (
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Line Settings</h4>
            <Slider label="Sensitivity" value={wf.imgToCadLine.sensitivity} min={0} max={100} onChange={() => {}} />
            <Slider label="Simplification" value={wf.imgToCadLine.simplify} min={0} max={50} onChange={() => {}} />
            <Toggle label="Connect Gaps" checked={wf.imgToCadLine.connect} onChange={() => {}} />
         </div>
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Layers</h4>
            <div className="bg-surface-sunken p-3 rounded space-y-2">
               <Toggle label="Walls (Thick)" checked={wf.imgToCadLayers.walls} onChange={() => {}} />
               <Toggle label="Windows (Med)" checked={wf.imgToCadLayers.windows} onChange={() => {}} />
               <Toggle label="Details (Thin)" checked={wf.imgToCadLayers.details} onChange={() => {}} />
            </div>
         </div>
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Output</h4>
            <SegmentedControl value={wf.imgToCadFormat} onChange={() => {}} options={[{label:'DXF', value:'dxf'}, {label:'DWG', value:'dwg'}, {label:'SVG', value:'svg'}, {label:'PDF', value:'pdf'}]} />
         </div>
      </div>
   );
};

// 10. Image to 3D
const ImageTo3DControls = ({ state, dispatch }: any) => {
   const wf = state.workflow;
   return (
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Geometry</h4>
            <SegmentedControl value={wf.img3dMesh.type} onChange={() => {}} options={[{label:'Organic', value:'organic'}, {label:'Architectural', value:'arch'}]} />
            <div className="mt-4 space-y-3">
               <Slider label="Edge Sharpness" value={wf.img3dMesh.edges} min={0} max={100} onChange={() => {}} />
               <Toggle label="Fill Holes" checked={wf.img3dMesh.fill} onChange={() => {}} />
            </div>
         </div>
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Output</h4>
            <SegmentedControl value={wf.img3dOutput.format} onChange={() => {}} options={[{label:'OBJ', value:'obj'}, {label:'FBX', value:'fbx'}, {label:'GLTF', value:'gltf'}]} />
         </div>
      </div>
   );
};

// 11. Video
const VideoControls = ({ state, dispatch }: any) => {
   const wf = state.workflow;
   
   const renderModeOptions = () => {
      if (wf.videoMode === 'animate') {
         return (
            <div className="space-y-3">
               <SegmentedControl value={wf.videoMotion.type} onChange={() => {}} options={[{label:'Cinematic', value:'cinematic'}, {label:'Ken Burns', value:'ken-burns'}, {label:'Parallax', value:'parallax'}]} />
               <div className="grid grid-cols-2 gap-2 text-xs">
                  <button className="border rounded py-1">Zoom In</button>
                  <button className="border rounded py-1">Orbit</button>
               </div>
            </div>
         );
      } else if (wf.videoMode === 'path') {
         return (
            <div className="space-y-3">
               <select className="w-full text-xs border rounded h-7"><option>Exterior Flyaround</option></select>
               <Slider label="Smoothness" value={wf.videoPath.smoothness} min={0} max={100} onChange={() => {}} />
            </div>
         );
      }
      return null;
   };

   return (
      <div className="space-y-6">
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Motion Settings</h4>
            {renderModeOptions()}
         </div>
         <div>
            <h4 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Output</h4>
            <div className="space-y-3">
               <SegmentedControl value={wf.videoOutput.res} onChange={() => {}} options={[{label:'1080p', value:'1080p'}, {label:'4K', value:'4k'}]} />
               <Slider label="Quality" value={wf.videoOutput.quality} min={0} max={100} onChange={() => {}} />
            </div>
         </div>
      </div>
   );
};

// --- Main RightPanel Component ---

export const RightPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();

  const renderContent = () => {
    switch (state.mode) {
      case 'render-3d': return <Render3DControls state={state} dispatch={dispatch} />;
      case 'render-cad': return <RenderCADControls state={state} dispatch={dispatch} />;
      case 'masterplan': return <MasterplanControls state={state} dispatch={dispatch} />;
      case 'visual-edit': return <VisualEditControls state={state} dispatch={dispatch} />;
      case 'exploded': return <ExplodedControls state={state} dispatch={dispatch} />;
      case 'section': return <SectionControls state={state} dispatch={dispatch} />;
      case 'render-sketch': return <SketchControls state={state} dispatch={dispatch} />;
      case 'upscale': return <UpscaleControls state={state} dispatch={dispatch} />;
      case 'img-to-cad': return <ImageToCadControls state={state} dispatch={dispatch} />;
      case 'img-to-3d': return <ImageTo3DControls state={state} dispatch={dispatch} />;
      case 'video': return <VideoControls state={state} dispatch={dispatch} />;
      default: return <div />;
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