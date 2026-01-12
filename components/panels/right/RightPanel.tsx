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
  Move3d, Focus, MousePointer2, Layers, Grid, Sparkle, Brush, Type, Crop, Expand, Trash2, MoveLeft, MoveRight,
  ChevronsLeft, ChevronsRight
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

const VisualPromptBlock = ({ state, dispatch, label = "Or Describe:" }: any) => (
  <div className="space-y-2 mt-4">
    <label className="text-xs text-foreground-secondary font-medium">{label}</label>
    <textarea 
      className="w-full h-24 bg-surface-sunken border border-border rounded-lg p-3 text-xs focus:border-accent outline-none resize-none"
      placeholder="E.g., A modern concrete house in a forest during sunset..."
      value={state.prompt}
      onChange={(e) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { visualPrompt: e.target.value } })}
    />
  </div>
);

// --- Sections ---

const GeometrySection = () => {
  const { state, dispatch } = useAppStore();
  const { geometry } = state;
  const updateGeo = (payload: any) => dispatch({ type: 'UPDATE_GEOMETRY', payload });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
         <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-muted">Preservation</span>
            <span className="text-xs font-mono">{geometry.geometryPreservation}%</span>
         </div>
         <Slider value={geometry.geometryPreservation} min={0} max={100} onChange={(v) => updateGeo({ geometryPreservation: v })} />
      </div>
      
      <Toggle label="Lock Geometry" checked={geometry.lockGeometry} onChange={(v) => updateGeo({ lockGeometry: v })} />
      <Toggle label="Suppress Hallucinations" checked={geometry.suppressHallucinations} onChange={(v) => updateGeo({ suppressHallucinations: v })} />
      
      <div className="pt-2 border-t border-border-subtle space-y-3">
         <div className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">Edge Control</div>
         <SegmentedControl 
            value={geometry.edgeDefinition}
            options={[{label: 'Soft', value: 'soft'}, {label: 'Adaptive', value: 'adaptive'}, {label: 'Sharp', value: 'sharp'}]}
            onChange={(v) => updateGeo({ edgeDefinition: v })}
         />
         <Slider label="Edge Strength" value={geometry.edgeStrength} min={0} max={100} onChange={(v) => updateGeo({ edgeStrength: v })} />
      </div>
    </div>
  );
};

const CameraSection = () => {
  const { state, dispatch } = useAppStore();
  const { camera } = state;
  const updateCam = (payload: any) => dispatch({ type: 'UPDATE_CAMERA', payload });

  return (
    <div className="space-y-4">
       <div>
          <label className="text-xs text-foreground-muted mb-2 block">View Type</label>
          <div className="grid grid-cols-3 gap-2">
             {['eye-level', 'aerial', 'drone'].map(t => (
                <button 
                  key={t}
                  onClick={() => updateCam({ viewType: t as any })}
                  className={cn(
                     "py-1.5 text-[10px] border rounded transition-colors uppercase font-medium",
                     camera.viewType === t ? "bg-foreground text-background border-foreground" : "bg-surface-elevated border-border hover:bg-surface-sunken"
                  )}
                >
                   {t}
                </button>
             ))}
          </div>
       </div>

       <Slider label="Field of View" value={camera.fov} min={15} max={120} onChange={(v) => updateCam({ fov: v })} />
       
       <div className="pt-2 border-t border-border-subtle space-y-2">
          <Toggle label="Vertical Correction" checked={camera.verticalCorrection} onChange={(v) => updateCam({ verticalCorrection: v })} />
          <Toggle label="Depth of Field" checked={camera.depthOfField} onChange={(v) => updateCam({ depthOfField: v })} />
       </div>
    </div>
  );
};

const LightingSection = () => {
  const { state, dispatch } = useAppStore();
  const { lighting } = state;
  const updateLight = (payload: any) => dispatch({ type: 'UPDATE_LIGHTING', payload });

  return (
    <div className="space-y-4">
       <div>
          <label className="text-xs text-foreground-muted mb-2 block">Time of Day</label>
          <select 
             className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 mb-2"
             value={lighting.timeOfDay}
             onChange={(e) => updateLight({ timeOfDay: e.target.value })}
          >
             <option value="morning">Morning</option>
             <option value="midday">Midday</option>
             <option value="afternoon">Afternoon</option>
             <option value="golden-hour">Golden Hour</option>
             <option value="blue-hour">Blue Hour</option>
             <option value="night">Night</option>
             <option value="overcast">Overcast</option>
          </select>
          <Slider value={lighting.customTime} min={0} max={24} onChange={(v) => updateLight({ customTime: v })} />
       </div>

       <div className="grid grid-cols-2 gap-4">
          <Slider label="Sun Azimuth" value={lighting.sunAzimuth} min={0} max={360} onChange={(v) => updateLight({ sunAzimuth: v })} />
          <Slider label="Sun Altitude" value={lighting.sunAltitude} min={0} max={90} onChange={(v) => updateLight({ sunAltitude: v })} />
       </div>
       
       <div className="pt-2 border-t border-border-subtle space-y-2">
          <label className="text-xs text-foreground-muted block">Weather</label>
          <div className="flex gap-2">
             {['clear', 'cloudy', 'rain', 'snow'].map(w => (
                <button 
                   key={w}
                   onClick={() => updateLight({ weather: w as any })}
                   className={cn(
                      "flex-1 py-1.5 text-[10px] border rounded transition-colors capitalize",
                      lighting.weather === w ? "bg-surface-elevated border-accent text-accent shadow-sm" : "bg-transparent border-border hover:bg-surface-sunken"
                   )}
                >
                   {w}
                </button>
             ))}
          </div>
       </div>
    </div>
  );
};

const MaterialsSection = () => {
  const { state, dispatch } = useAppStore();
  const { materials } = state;
  const updateMat = (payload: any) => dispatch({ type: 'UPDATE_MATERIALS', payload });

  return (
    <div className="space-y-4">
       <div className="grid grid-cols-2 gap-4">
          <Slider label="Concrete" value={materials.concreteEmphasis} min={0} max={100} onChange={(v) => updateMat({ concreteEmphasis: v })} />
          <Slider label="Glass" value={materials.glassEmphasis} min={0} max={100} onChange={(v) => updateMat({ glassEmphasis: v })} />
          <Slider label="Wood" value={materials.woodEmphasis} min={0} max={100} onChange={(v) => updateMat({ woodEmphasis: v })} />
          <Slider label="Vegetation" value={materials.agingLevel} min={0} max={100} onChange={(v) => updateMat({ agingLevel: v })} />
       </div>
       <div className="pt-2 border-t border-border-subtle">
          <Slider label="Reflectivity Bias" value={materials.reflectivityBias} min={-50} max={50} onChange={(v) => updateMat({ reflectivityBias: v })} />
       </div>
    </div>
  );
};

const ContextSection = () => {
  const { state, dispatch } = useAppStore();
  const { context } = state;
  const updateCtx = (payload: any) => dispatch({ type: 'UPDATE_CONTEXT', payload });

  return (
     <div className="space-y-3">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Users size={14} className="text-foreground-muted" />
              <span className="text-xs font-medium">People</span>
           </div>
           <Toggle label="" checked={context.people} onChange={(v) => updateCtx({ people: v })} />
        </div>
        
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <TreePine size={14} className="text-foreground-muted" />
              <span className="text-xs font-medium">Vegetation</span>
           </div>
           <Toggle label="" checked={context.vegetation} onChange={(v) => updateCtx({ vegetation: v })} />
        </div>
        
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Car size={14} className="text-foreground-muted" />
              <span className="text-xs font-medium">Vehicles</span>
           </div>
           <Toggle label="" checked={context.vehicles} onChange={(v) => updateCtx({ vehicles: v })} />
        </div>

        {context.vegetation && (
           <div className="pt-2">
              <Slider label="Vegetation Density" value={context.vegetationDensity} min={0} max={100} onChange={(v) => updateCtx({ vegetationDensity: v })} />
           </div>
        )}
     </div>
  );
};

// --- Video Specific Panel ---

const VideoSettingsPanel = () => {
  const { state, dispatch } = useAppStore();
  const video = state.workflow.videoState;
  const updateVideo = (payload: any) => dispatch({ type: 'UPDATE_VIDEO_STATE', payload });
  const updateCam = (payload: any) => dispatch({ type: 'UPDATE_VIDEO_CAMERA', payload });

  return (
    <div className="space-y-6">
      <div>
         <h4 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-3">Motion Control</h4>
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
               {['static', 'pan', 'orbit', 'dolly', 'crane', 'drone'].map(t => (
                  <button
                     key={t}
                     onClick={() => updateCam({ type: t as any })}
                     className={cn(
                        "py-2 px-1 text-[10px] uppercase font-medium border rounded transition-colors text-center truncate",
                        video.camera.type === t ? "bg-foreground text-background border-foreground" : "bg-surface-elevated border-border hover:bg-surface-sunken"
                     )}
                  >
                     {t}
                  </button>
               ))}
            </div>
            
            <Slider label="Motion Amount" value={video.motionAmount} min={1} max={10} onChange={(v) => updateVideo({ motionAmount: v })} />
            <Slider label="Smoothness" value={video.camera.smoothness} min={0} max={100} onChange={(v) => updateCam({ smoothness: v })} />
         </div>
      </div>

      <div className="pt-4 border-t border-border-subtle">
         <h4 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-3">Output Settings</h4>
         <div className="space-y-4">
            <div>
               <label className="text-xs text-foreground-secondary mb-1 block">Duration</label>
               <SegmentedControl 
                  value={video.duration.toString()}
                  options={[{label: '5s', value: '5'}, {label: '10s', value: '10'}, {label: '15s', value: '15'}]}
                  onChange={(v) => updateVideo({ duration: parseInt(v) })}
               />
            </div>
            <div>
               <label className="text-xs text-foreground-secondary mb-1 block">FPS</label>
               <SegmentedControl 
                  value={video.fps.toString()}
                  options={[{label: '24', value: '24'}, {label: '30', value: '30'}, {label: '60', value: '60'}]}
                  onChange={(v) => updateVideo({ fps: parseInt(v) })}
               />
            </div>
         </div>
      </div>
    </div>
  );
};

export const RightPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { rightPanelOpen, rightPanelWidth } = state;
  const isVideo = state.mode === 'video';

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
              {isVideo ? 'Studio' : 'Settings'}
            </span>
        </div>
      </div>
    );
  }

  const accordionItems = isVideo ? [
     { id: 'video-settings', title: 'Video Configuration', content: <VideoSettingsPanel /> },
     { id: 'visual-prompt', title: 'Prompting', content: <VisualPromptBlock state={state} dispatch={dispatch} /> }
  ] : [
     { id: 'geometry', title: 'Geometry & Structure', content: <GeometrySection /> },
     { id: 'camera', title: 'Camera & View', content: <CameraSection /> },
     { id: 'lighting', title: 'Lighting & Atmosphere', content: <LightingSection /> },
     { id: 'materials', title: 'Materials & Finishes', content: <MaterialsSection /> },
     { id: 'context', title: 'Environment & Context', content: <ContextSection /> },
     { id: 'prompt', title: 'Manual Prompt', content: <VisualPromptBlock state={state} dispatch={dispatch} label="Additional Details" /> },
  ];

  return (
    <div 
      className={cn(
        "bg-background-tertiary border-l border-border flex flex-col overflow-hidden transition-all relative z-10",
        rightPanelWidth ? `w-[${rightPanelWidth}px]` : "w-[320px]"
      )}
    >
      <div className="shrink-0 p-5 pb-3 bg-background-tertiary border-b border-border-subtle flex justify-between items-center">
          <button 
            onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
            className="text-foreground-muted hover:text-foreground hover:bg-surface-sunken p-1 rounded-md transition-colors"
          >
            <ChevronsRight size={16} />
          </button>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
             {isVideo ? 'Video Studio' : 'Render Settings'}
          </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
         {/* Generation Mode Selector (Top of Right Panel) */}
         {!isVideo && <StyleSelector state={state} dispatch={dispatch} />}

         <Accordion items={accordionItems} defaultValue={accordionItems[0].id} />
      </div>
    </div>
  );
};
