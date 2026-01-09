import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { 
  Palette, FileCode, Map, Eraser, Layers, RectangleVertical, 
  Pencil, Maximize, PenTool, Cuboid, Video, Hand, MousePointer, 
  Paintbrush, Sun, Home, Cloud, Trash2, Wrench, Plus, RotateCw, Grid, Check
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GenerationMode, StyleConfiguration } from '../../../types';
import { Slider } from '../../ui/Slider';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { nanoid } from 'nanoid/non-secure';

// --- Workflow Navigation ---
const WORKFLOWS: { id: GenerationMode; label: string; icon: React.ElementType }[] = [
  { id: 'render-3d', label: '3D to Render', icon: Palette },
  { id: 'render-cad', label: 'CAD to Render', icon: FileCode },
  { id: 'masterplan', label: 'Masterplans', icon: Map },
  { id: 'visual-edit', label: 'Visual Editor', icon: Eraser },
  { id: 'exploded', label: 'Exploded Views', icon: Layers },
  { id: 'section', label: 'Render to Section', icon: RectangleVertical },
  { id: 'render-sketch', label: 'Sketch to Render', icon: Pencil },
  { id: 'upscale', label: 'Image Upscaler', icon: Maximize },
  { id: 'img-to-cad', label: 'Image to CAD', icon: PenTool },
  { id: 'img-to-3d', label: 'Image to 3D', icon: Cuboid },
  { id: 'video', label: 'Video Studio', icon: Video },
];

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-[10px] font-bold text-foreground-muted mb-2 uppercase tracking-widest">{title}</h3>
);

// --- Shared: Style Grid (Updated for dynamic selection & visibility) ---
const StyleGrid: React.FC<{ activeId: string; onSelect: (id: string) => void; onBrowse: () => void }> = ({ activeId, onSelect, onBrowse }) => {
  // Logic to always show the active style, swapping the last item if necessary
  const displayStyles = useMemo(() => {
    const defaultStyles = BUILT_IN_STYLES.slice(0, 4);
    const activeStyle = BUILT_IN_STYLES.find(s => s.id === activeId);
    
    // If active style exists and is not in the default list
    if (activeStyle && !defaultStyles.find(s => s.id === activeId)) {
       return [...defaultStyles.slice(0, 3), activeStyle];
    }
    
    return defaultStyles;
  }, [activeId]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {displayStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => onSelect(style.id)}
            className={cn(
              "relative h-14 rounded-md overflow-hidden border transition-all duration-200 text-left flex items-center group",
              activeId === style.id 
                 ? "border-foreground ring-2 ring-foreground shadow-md opacity-100 z-10 scale-[1.02]" 
                 : "border-border opacity-90 hover:opacity-100 hover:border-foreground-muted hover:scale-[1.01]"
            )}
          >
            {/* Background Preview */}
            <div className="absolute inset-0 z-0 transition-transform duration-500 group-hover:scale-105" style={{ background: style.previewUrl }} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent z-0" />
            
            <div className="relative z-10 px-2 py-1 w-full">
              <p className="text-white text-[10px] font-bold leading-tight truncate w-full shadow-sm group-hover:text-accent-muted transition-colors">{style.name}</p>
              <p className="text-white/80 text-[8px] truncate shadow-sm font-medium">{style.category}</p>
            </div>
            
            {activeId === style.id && (
               <div className="absolute top-1 right-1 w-4 h-4 bg-foreground text-background rounded-full flex items-center justify-center z-20 shadow-sm animate-scale-in">
                  <Check size={8} strokeWidth={3} />
               </div>
            )}
          </button>
        ))}
      </div>
      <button 
        onClick={onBrowse}
        className="w-full h-8 flex items-center justify-center gap-2 rounded border border-dashed border-border text-xs text-foreground-muted hover:text-foreground hover:border-foreground-muted hover:bg-surface-elevated transition-all"
      >
        <Grid size={12} />
        <span>Browse All Styles</span>
      </button>
    </div>
  );
};

// --- 1. 3D to Render Panel ---
const Render3DPanel = () => {
  const { state, dispatch } = useAppStore();
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const wf = state.workflow;

  return (
    <div className="space-y-6">
      <StyleBrowserDialog 
         isOpen={isBrowserOpen} 
         onClose={() => setIsBrowserOpen(false)} 
         activeStyleId={state.activeStyleId}
         onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })}
      />

      <div>
        <SectionHeader title="Source Analysis" />
        <div className="space-y-3">
          <div>
            <label className="text-xs text-foreground-muted mb-1 block">Source Type</label>
            <select 
              className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2 text-foreground focus:outline-none focus:border-accent"
              value={wf.sourceType}
              onChange={(e) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sourceType: e.target.value as any } })}
            >
              <option value="rhino">Rhino</option>
              <option value="revit">Revit</option>
              <option value="sketchup">SketchUp</option>
              <option value="blender">Blender</option>
              <option value="clay">Clay Render</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
             <label className="text-xs text-foreground-muted mb-1 block">View Type</label>
             <SegmentedControl 
               value={wf.viewType}
               onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { viewType: v } })}
               options={[{label:'Exterior', value:'exterior'}, {label:'Interior', value:'interior'}, {label:'Aerial', value:'aerial'}]}
             />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
           <SectionHeader title="Style" />
           <span className="text-[9px] text-foreground-muted font-mono">{state.activeStyleId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}</span>
        </div>
        <StyleGrid 
          activeId={state.activeStyleId} 
          onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })} 
          onBrowse={() => setIsBrowserOpen(true)}
        />
      </div>

      <div>
        <SectionHeader title="Detected Elements" />
        <div className="space-y-1">
          {wf.detectedElements.map(el => (
             <div 
               key={el.id} 
               onClick={() => {
                 const newElements = wf.detectedElements.map(e => e.id === el.id ? { ...e, selected: !e.selected } : e);
                 dispatch({ type: 'UPDATE_WORKFLOW', payload: { detectedElements: newElements } });
               }}
               className={cn(
                 "flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-colors",
                 el.selected ? "bg-surface-elevated border-border" : "bg-transparent border-transparent opacity-50 hover:bg-surface-sunken"
               )}
             >
                <div className="flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full", el.confidence > 0.8 ? "bg-green-500" : "bg-yellow-500")} />
                   <span>{el.name}</span>
                </div>
                <div className={cn("w-3 h-3 rounded border flex items-center justify-center", el.selected ? "bg-foreground border-foreground" : "border-border-strong")}>
                  {el.selected && <div className="w-1.5 h-1.5 bg-background rounded-sm" />}
                </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- 2. CAD to Render Panel ---
const RenderCADPanel = () => {
  const { state, dispatch } = useAppStore();
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const wf = state.workflow;

  const toggleLayer = (id: string) => {
    const newLayers = wf.cadLayers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { cadLayers: newLayers } });
  };

  return (
    <div className="space-y-6">
      <StyleBrowserDialog 
         isOpen={isBrowserOpen} 
         onClose={() => setIsBrowserOpen(false)} 
         activeStyleId={state.activeStyleId}
         onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })}
      />
      <div>
        <SectionHeader title="Drawing Setup" />
        <div className="grid grid-cols-2 gap-2 mb-3">
          {['Plan', 'Section', 'Elevation', 'Site'].map(t => (
            <button 
              key={t}
              onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { cadDrawingType: t.toLowerCase() as any } })}
              className={cn("text-xs py-2 rounded border transition-colors", 
                wf.cadDrawingType === t.toLowerCase() ? "bg-foreground text-background border-foreground" : "bg-surface-elevated border-border hover:border-foreground-muted"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <SegmentedControl 
             value={wf.cadScale}
             onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { cadScale: v } })}
             options={[{label:'1:50', value:'1:50'}, {label:'1:100', value:'1:100'}, {label:'1:200', value:'1:200'}]}
          />
          <div className="flex items-center justify-between bg-surface-sunken p-2 rounded">
             <span className="text-xs text-foreground-secondary">Orientation</span>
             <button 
               className="p-1 hover:bg-surface-elevated rounded active:bg-border transition-colors"
               onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { cadOrientation: (wf.cadOrientation + 90) % 360 } })}
             >
               <RotateCw size={14} className="text-foreground-secondary" />
             </button>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Style" />
        <StyleGrid 
          activeId={state.activeStyleId} 
          onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })} 
          onBrowse={() => setIsBrowserOpen(true)}
        />
      </div>

      <div>
        <SectionHeader title="Layer Detection" />
        <div className="space-y-1">
           {wf.cadLayers.map(layer => (
             <div key={layer.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: layer.color }} />
                <span className="text-xs flex-1">{layer.name}</span>
                <Toggle label="" checked={layer.visible} onChange={() => toggleLayer(layer.id)} />
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

// --- 3. Masterplan Panel ---
const MasterplanPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const handleAddZone = () => {
    const newZone: any = { 
      id: nanoid(), 
      name: 'New Zone', 
      color: '#cccccc', 
      type: 'mixed', 
      selected: true 
    };
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: [...wf.mpZones, newZone] } });
  };

  const handleRemoveZone = (id: string) => {
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: wf.mpZones.filter(z => z.id !== id) } });
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title="Detected Zones" />
        <div className="space-y-2">
           {wf.mpZones.map(zone => (
              <div key={zone.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded group hover:border-foreground-muted transition-colors">
                 <div className="w-3 h-3 rounded shadow-sm cursor-pointer" style={{ backgroundColor: zone.color }} />
                 <span className="text-xs font-medium flex-1 text-foreground">{zone.name}</span>
                 <select className="text-[10px] h-5 bg-transparent border-none text-right focus:outline-none text-foreground-muted cursor-pointer">
                    <option>{zone.type}</option>
                 </select>
                 <button onClick={() => handleRemoveZone(zone.id)} className="opacity-0 group-hover:opacity-100 text-foreground-muted hover:text-red-500">
                    <Trash2 size={12} />
                 </button>
              </div>
           ))}
           <button 
             onClick={handleAddZone}
             className="w-full py-2 border border-dashed border-border rounded text-xs text-foreground-muted hover:text-foreground hover:border-foreground-muted flex items-center justify-center gap-1 transition-all"
           >
             <Plus size={12} /> Add Zone
           </button>
        </div>
      </div>

      <div>
        <SectionHeader title="Context Loading" />
        <div className="bg-surface-sunken p-3 rounded-lg space-y-2">
           <button className="w-full py-2 bg-foreground text-background rounded text-xs font-medium mb-2 hover:bg-foreground/90 transition-colors">
              Locate Site
           </button>
           <Toggle label="Surrounding Buildings" checked={wf.mpContext.loadBuildings} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadBuildings: v } } })} />
           <Toggle label="Roads" checked={wf.mpContext.loadRoads} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadRoads: v } } })} />
           <Toggle label="Water Bodies" checked={wf.mpContext.loadWater} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadWater: v } } })} />
           <Toggle label="Terrain" checked={wf.mpContext.loadTerrain} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadTerrain: v } } })} />
        </div>
      </div>
    </div>
  );
};

// --- 4. Visual Edit Panel (Tool Palette) ---
const VisualEditPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  
  const tools = [
    { id: 'pan', icon: Hand, label: 'Pan' },
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'material', icon: Palette, label: 'Material' },
    { id: 'lighting', icon: Sun, label: 'Lighting' },
    { id: 'object', icon: Home, label: 'Object' },
    { id: 'sky', icon: Cloud, label: 'Sky' },
    { id: 'remove', icon: Trash2, label: 'Remove' },
    { id: 'adjust', icon: Wrench, label: 'Adjust' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title="Tools" />
        <div className="grid grid-cols-2 gap-2">
           {tools.map(t => (
             <button 
               key={t.id}
               onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { activeTool: t.id as any } })}
               className={cn("flex flex-col items-center justify-center p-3 rounded-lg border transition-all active:scale-95", 
                 wf.activeTool === t.id 
                   ? "bg-foreground text-background border-foreground shadow-md" 
                   : "bg-surface-elevated border-border text-foreground-muted hover:border-foreground-secondary hover:bg-surface-sunken"
               )}
             >
               <t.icon size={20} className="mb-1.5" />
               <span className="text-[10px] font-medium uppercase tracking-wide">{t.label}</span>
             </button>
           ))}
        </div>
      </div>
      
      <div className="bg-surface-sunken p-3 rounded text-xs text-foreground-muted leading-relaxed border border-border-subtle">
         Select a tool above to configure its specific options in the Right Panel. Use masks to isolate edits.
      </div>
    </div>
  );
};

// --- 5. Exploded View Panel ---
const ExplodedViewPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const handleAddComponent = () => {
    const newComp = { id: nanoid(), name: 'New Component', order: wf.explodedComponents.length, active: true };
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { explodedComponents: [...wf.explodedComponents, newComp] } });
  };

  return (
    <div className="space-y-6">
       <div>
         <SectionHeader title="Explosion Order" />
         <div className="space-y-1">
            {wf.explodedComponents.map((comp, i) => (
               <div key={comp.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded cursor-grab active:cursor-grabbing hover:border-foreground-muted transition-colors">
                  <div className="text-foreground-muted font-mono text-[10px] w-4">{i+1}</div>
                  <div className="flex-1 text-xs font-medium">{comp.name}</div>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
               </div>
            ))}
            <button 
               onClick={handleAddComponent}
               className="w-full py-2 text-xs text-foreground-muted border border-dashed border-border rounded mt-2 hover:text-foreground hover:border-foreground-muted transition-all"
            >
               + Add Component
            </button>
         </div>
       </div>
    </div>
  );
};

// --- 6. Section Panel ---
const SectionPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  return (
    <div className="space-y-6">
       <div>
          <SectionHeader title="Cut Definition" />
          <div className="bg-surface-sunken p-3 rounded-lg space-y-4">
             <div>
                <label className="text-xs text-foreground-muted mb-2 block">Cut Type</label>
                <SegmentedControl 
                   value={wf.sectionCut.type}
                   onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sectionCut: { ...wf.sectionCut, type: v } } })}
                   options={[{label:'Vert', value:'vertical'}, {label:'Horiz', value:'horizontal'}, {label:'Diag', value:'diagonal'}]}
                />
             </div>
             <Slider 
               label="Cut Plane Position" 
               value={wf.sectionCut.plane} min={0} max={100} 
               onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sectionCut: { ...wf.sectionCut, plane: v } } })} 
             />
             <Slider 
               label="Cut Depth" 
               value={wf.sectionCut.depth} min={0} max={100} 
               onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sectionCut: { ...wf.sectionCut, depth: v } } })} 
             />
             <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-secondary">Look Direction</span>
                <div className="flex bg-surface-elevated rounded border border-border">
                   <button 
                     onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sectionCut: { ...wf.sectionCut, direction: 'fwd' } } })}
                     className={cn("px-2 py-1 border-r border-border transition-colors", wf.sectionCut.direction === 'fwd' ? "bg-surface-sunken text-foreground" : "text-foreground-muted hover:text-foreground")}
                   >
                     Fwd
                   </button>
                   <button 
                     onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sectionCut: { ...wf.sectionCut, direction: 'bwd' } } })}
                     className={cn("px-2 py-1 transition-colors", wf.sectionCut.direction === 'bwd' ? "bg-surface-sunken text-foreground" : "text-foreground-muted hover:text-foreground")}
                   >
                     Bwd
                   </button>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

// --- 7. Sketch Panel ---
const SketchPanel = () => {
  const { state, dispatch } = useAppStore();
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const wf = state.workflow;

  return (
    <div className="space-y-6">
      <StyleBrowserDialog 
         isOpen={isBrowserOpen} 
         onClose={() => setIsBrowserOpen(false)} 
         activeStyleId={state.activeStyleId}
         onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })}
      />
       <div>
          <SectionHeader title="Sketch Analysis" />
          <div className="space-y-3">
             <SegmentedControl 
               value={wf.sketchType}
               onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sketchType: v } })}
               options={[{label:'Ext', value:'exterior'}, {label:'Int', value:'interior'}, {label:'Det', value:'detail'}]}
             />
             <Slider label="Line Confidence" value={wf.sketchConfidence} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sketchConfidence: v } })} />
             <div className="bg-surface-sunken p-2 rounded space-y-2">
                <Toggle label="Clean Noise" checked={wf.sketchCleanup.clean} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sketchCleanup: { ...wf.sketchCleanup, clean: v } } })} />
                <Toggle label="Enhance Lines" checked={wf.sketchCleanup.lines} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sketchCleanup: { ...wf.sketchCleanup, lines: v } } })} />
             </div>
          </div>
       </div>
       <div>
        <SectionHeader title="Style" />
        <StyleGrid 
          activeId={state.activeStyleId} 
          onSelect={(id) => dispatch({ type: 'SET_STYLE', payload: id })} 
          onBrowse={() => setIsBrowserOpen(true)}
        />
      </div>
       <div>
          <SectionHeader title="References" />
          <div className="grid grid-cols-3 gap-2">
             <div className="aspect-square border border-dashed border-border rounded flex items-center justify-center text-foreground-muted hover:text-foreground cursor-pointer hover:border-accent transition-colors">
                <Plus size={16} />
             </div>
             {/* Placeholder refs */}
             <div className="aspect-square bg-surface-elevated rounded border border-border" />
          </div>
       </div>
    </div>
  );
};

// --- 8. Upscale Panel (Empty Left, Focus on Right) ---
const UpscalePanel = () => (
   <div className="flex flex-col items-center justify-center h-40 text-center p-4">
      <div className="w-12 h-12 bg-surface-sunken rounded-full flex items-center justify-center text-foreground-muted mb-2">
         <Maximize size={24} />
      </div>
      <p className="text-xs text-foreground-secondary">
         Drag and drop images onto the canvas to begin batch upscaling.
      </p>
   </div>
);

// --- 9. Image to CAD Panel ---
const ImageToCADPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  return (
    <div className="space-y-6">
       <div>
          <SectionHeader title="Image Setup" />
          <div className="space-y-3">
             <SegmentedControl 
               value={wf.imgToCadType}
               onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { imgToCadType: v } })}
               options={[{label:'Photo', value:'photo'}, {label:'Render', value:'render'}]}
             />
             <button className="w-full py-2 border border-border bg-surface-elevated rounded text-xs hover:border-foreground transition-colors">
                Auto-Correct Perspective
             </button>
          </div>
       </div>
    </div>
  );
};

// --- 10. Image to 3D Panel ---
const ImageTo3DPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const handleAddView = () => {
     const newView = { id: nanoid(), view: 'New View', isPrimary: false };
     dispatch({ type: 'UPDATE_WORKFLOW', payload: { img3dInputs: [...wf.img3dInputs, newView] } });
  };

  return (
    <div className="space-y-6">
       <div>
          <SectionHeader title="Input Images" />
          <div className="space-y-2">
             {wf.img3dInputs.map(img => (
                <div key={img.id} className="flex gap-2 p-2 bg-surface-elevated border border-border rounded">
                   <div className="w-10 h-10 bg-surface-sunken rounded shrink-0" />
                   <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{img.id}</div>
                      <div className="text-[10px] text-foreground-muted truncate">{img.view}</div>
                   </div>
                   {img.isPrimary && <div className="text-[10px] bg-accent text-white px-1.5 rounded self-start">Primary</div>}
                </div>
             ))}
             <button 
                onClick={handleAddView}
                className="w-full py-2 border border-dashed border-border text-foreground-muted text-xs rounded hover:text-foreground hover:border-foreground-muted transition-colors"
             >
                + Add View
             </button>
          </div>
       </div>
    </div>
  );
};

// --- 11. Video Panel ---
const VideoPanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  return (
    <div className="space-y-6">
       <div>
          <SectionHeader title="Video Mode" />
          <div className="space-y-1">
             {[
               {id:'animate', label:'Image Animate'}, 
               {id:'path', label:'Camera Path'}, 
               {id:'morph', label:'Morph'}, 
               {id:'assembly', label:'Assembly'}
             ].map(m => (
                <div 
                  key={m.id}
                  onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { videoMode: m.id as any } })}
                  className={cn("flex items-center gap-3 p-2 rounded border cursor-pointer transition-all", 
                    wf.videoMode === m.id ? "bg-surface-elevated border-foreground shadow-sm" : "border-transparent hover:bg-surface-elevated"
                  )}
                >
                   <div className={cn("w-3 h-3 rounded-full border", wf.videoMode === m.id ? "border-accent bg-accent" : "border-foreground-muted")} />
                   <span className="text-xs font-medium">{m.label}</span>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
};


// --- Main LeftSidebar Component ---
export const LeftSidebar: React.FC = () => {
  const { state, dispatch } = useAppStore();

  const renderPanel = () => {
    switch (state.mode) {
      case 'render-3d': return <Render3DPanel />;
      case 'render-cad': return <RenderCADPanel />;
      case 'masterplan': return <MasterplanPanel />;
      case 'visual-edit': return <VisualEditPanel />;
      case 'exploded': return <ExplodedViewPanel />;
      case 'section': return <SectionPanel />;
      case 'render-sketch': return <SketchPanel />;
      case 'upscale': return <UpscalePanel />;
      case 'img-to-cad': return <ImageToCADPanel />;
      case 'img-to-3d': return <ImageTo3DPanel />;
      case 'video': return <VideoPanel />;
      default: return <Render3DPanel />;
    }
  };

  const activeWorkflowLabel = WORKFLOWS.find(w => w.id === state.mode)?.label;

  return (
    <div className="flex shrink-0 h-full">
      {/* Feature Switcher Rail */}
      <div className="w-14 bg-surface-elevated border-r border-border flex flex-col items-center py-4 gap-4 z-20 shadow-subtle overflow-y-auto no-scrollbar group hover:w-[200px] transition-all duration-300 ease-out">
        {WORKFLOWS.map((workflow) => {
          const Icon = workflow.icon;
          const isActive = state.mode === workflow.id;
          return (
            <button
              key={workflow.id}
              onClick={() => dispatch({ type: 'SET_MODE', payload: workflow.id })}
              className={cn(
                "w-full h-10 flex items-center px-3 rounded-xl transition-all duration-200 relative shrink-0 overflow-hidden",
                isActive 
                  ? "bg-surface-sunken text-foreground" 
                  : "text-foreground-muted hover:bg-background-secondary hover:text-foreground"
              )}
              title={workflow.label}
            >
              <div className="min-w-[24px] flex items-center justify-center">
                <Icon size={20} strokeWidth={1.5} />
              </div>
              <span className={cn(
                "ml-3 text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75",
                !isActive && "text-foreground-secondary"
              )}>
                {workflow.label}
              </span>
              
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />}
            </button>
          );
        })}
      </div>

      {/* Specific Workflow Content - Structure fixed for scrolling */}
      <div className={cn(
        "bg-background-tertiary border-r border-border flex flex-col overflow-hidden transition-all",
        state.leftSidebarWidth ? `w-[${state.leftSidebarWidth}px]` : "w-[280px]"
      )}>
         {/* Fixed Header */}
         <div className="shrink-0 p-5 pb-3 bg-background-tertiary border-b border-border-subtle z-10">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{activeWorkflowLabel}</h2>
         </div>
         
         {/* Scrollable Content */}
         <div className="flex-1 overflow-y-auto p-5 pt-4 custom-scrollbar">
           {renderPanel()}
         </div>
      </div>
    </div>
  );
};