import React, { useState, useMemo, useRef } from 'react';
import { useAppStore } from '../../../store';
import { BUILT_IN_STYLES } from '../../../engine/promptEngine';
import { StyleBrowserDialog } from '../../modals/StyleBrowserDialog';
import { 
  Palette, FileCode, Map, Eraser, Layers, RectangleVertical, 
  Pencil, Maximize, PenTool, Cuboid, Video, Hand, MousePointer, 
  Paintbrush, Sun, Home, Cloud, Trash2, Wrench, Plus, RotateCw, Grid, Check,
  ZoomIn, ZoomOut, MoveRight, MoveLeft, MoveUp, MoveDown, RotateCcw, RotateCw as RotateCwIcon, Sliders, Image as ImageIcon, Camera,
  RefreshCw, MousePointerClick, ClipboardCheck, Zap, Sparkles,
  Layout as LayoutIcon, Scissors as ScissorsIcon, Building as BuildingIcon, Map as MapIcon, Box as BoxIcon,
  PlayCircle, Film, Wand2, Eye, EyeOff, FileDigit, ScanLine, Expand,
  FileText, FileSpreadsheet, UploadCloud, MoreHorizontal, FileCheck,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GenerationMode, VideoInputMode, ZoneItem } from '../../../types';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { nanoid } from 'nanoid';

// --- Workflow Navigation ---
const WORKFLOWS: { id: GenerationMode; label: string; icon: React.ElementType }[] = [
  { id: 'generate-text', label: 'Generate', icon: Sparkles },
  { id: 'render-3d', label: '3D to Render', icon: Palette },
  { id: 'render-cad', label: 'CAD to Render', icon: FileCode },
  { id: 'masterplan', label: 'Masterplans', icon: Map },
  { id: 'visual-edit', label: 'Visual Editor', icon: Eraser },
  { id: 'material-validation', label: 'Material Validation', icon: ClipboardCheck },
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

// --- Shared: Style Grid ---
const StyleGrid: React.FC<{ activeId: string; onSelect: (id: string) => void; onBrowse: () => void }> = ({ activeId, onSelect, onBrowse }) => {
  const displayStyles = useMemo(() => {
    const defaultStyles = BUILT_IN_STYLES.slice(0, 4);
    const activeStyle = BUILT_IN_STYLES.find(s => s.id === activeId);
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
            <div 
              className="absolute inset-0 z-0 transition-transform duration-500 group-hover:scale-105 bg-cover bg-center" 
              style={{ backgroundImage: `url(${style.previewUrl})` }} 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-0" />
            
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

// --- FEATURE PANELS ---

// NOTE: GenerateTextPanel is effectively unused in layout now as we hide the sidebar content in this mode, 
// but keeping it for potential future restoration or reference.
const GenerateTextPanel = () => {
  return null; 
};

const Render3DPanel = () => {
    const { state, dispatch } = useAppStore();
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const wf = state.workflow;
    
    const updateWf = (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload });
  
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
                onChange={(e) => updateWf({ sourceType: e.target.value as any })}
              >
                <option value="rhino">Rhino</option>
                <option value="revit">Revit</option>
                <option value="sketchup">SketchUp</option>
                <option value="blender">Blender</option>
                <option value="3dsmax">3ds Max</option>
                <option value="archicad">ArchiCAD</option>
                <option value="cinema4d">Cinema 4D</option>
                <option value="clay">Clay Render</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
               <label className="text-xs text-foreground-muted mb-1 block">View Type</label>
               <SegmentedControl 
                 value={wf.viewType}
                 onChange={(v) => updateWf({ viewType: v })}
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
                   updateWf({ detectedElements: newElements });
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

const RenderCADPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;
    const updateWf = (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload });
  
    const toggleLayer = (id: string) => {
      const newLayers = wf.cadLayers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
      updateWf({ cadLayers: newLayers });
    };
  
    return (
      <div className="space-y-6">
        <div>
          <SectionHeader title="Drawing Type" />
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { id: 'plan', label: 'Floor Plan', icon: LayoutIcon },
              { id: 'section', label: 'Section', icon: ScissorsIcon },
              { id: 'elevation', label: 'Elevation', icon: BuildingIcon },
              { id: 'site', label: 'Site Plan', icon: MapIcon }
            ].map(t => (
              <button 
                key={t.id}
                onClick={() => updateWf({ cadDrawingType: t.id as any })}
                className={cn(
                  "text-xs py-2 px-2 rounded border transition-all flex flex-col items-center gap-1.5 h-16 justify-center", 
                  wf.cadDrawingType === t.id 
                    ? "bg-foreground text-background border-foreground shadow-sm" 
                    : "bg-surface-elevated border-border hover:border-foreground-muted hover:bg-surface-sunken"
                )}
              >
                <t.icon size={16} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-foreground-muted mb-1 block">Scale</label>
              <select 
                className="w-full h-8 bg-surface-elevated border border-border rounded text-xs px-2"
                value={wf.cadScale}
                onChange={(e) => updateWf({ cadScale: e.target.value })}
              >
                <option value="1:50">1:50</option>
                <option value="1:100">1:100</option>
                <option value="1:200">1:200</option>
                <option value="1:500">1:500</option>
                <option value="custom">Custom...</option>
              </select>
            </div>
            
            <div>
               <label className="text-xs text-foreground-muted mb-1 block">Orientation</label>
               <div className="flex gap-1 bg-surface-sunken p-1 rounded-lg border border-border-subtle justify-between">
                 {[0, 90, 180, 270].map(deg => (
                   <button
                    key={deg}
                    onClick={() => updateWf({ cadOrientation: deg })}
                    className={cn(
                      "w-7 h-7 rounded text-[10px] font-mono flex items-center justify-center transition-colors",
                      wf.cadOrientation === deg 
                        ? "bg-foreground text-background font-bold" 
                        : "hover:bg-surface-elevated text-foreground-muted"
                    )}
                   >
                     {deg}°
                   </button>
                 ))}
               </div>
            </div>
          </div>
        </div>
  
        <div>
          <SectionHeader title="Layer Detection" />
          <div className="space-y-1">
             {wf.cadLayers.map(layer => (
               <div key={layer.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded hover:border-foreground-muted transition-colors">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: layer.color }} />
                  <span className="text-xs flex-1 font-medium">{layer.name}</span>
                  <Toggle label="" checked={layer.visible} onChange={() => toggleLayer(layer.id)} />
               </div>
             ))}
          </div>
        </div>
      </div>
    );
};

const MasterplanPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;

    const [isAdding, setIsAdding] = useState(false);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneColor, setNewZoneColor] = useState('#CCCCCC');

    const handleAddZone = () => {
        if (!newZoneName.trim()) return;
        
        const newZone: ZoneItem = {
            id: nanoid(),
            name: newZoneName,
            color: newZoneColor,
            type: 'mixed',
            selected: true
        };
        dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: [...wf.mpZones, newZone] } });
        
        setIsAdding(false);
        setNewZoneName('');
        setNewZoneColor('#CCCCCC');
    };

    const cancelAdd = () => {
        setIsAdding(false);
        setNewZoneName('');
        setNewZoneColor('#CCCCCC');
    };

    const toggleZone = (id: string) => {
        const newZones = wf.mpZones.map(z => z.id === id ? { ...z, selected: !z.selected } : z);
        dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpZones: newZones } });
    };
    
    return (
      <div className="space-y-6">
        <div>
           <SectionHeader title="Plan Type" />
           <div className="grid grid-cols-2 gap-2">
              {[
                {id: 'site', label: 'Site Plan'}, 
                {id: 'urban', label: 'Urban'}, 
                {id: 'zoning', label: 'Zoning'}, 
                {id: 'massing', label: 'Massing'}
              ].map(t => (
                 <button 
                   key={t.id}
                   onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpPlanType: t.id as any } })}
                   className={cn(
                     "py-2 px-3 text-xs rounded border text-center transition-colors",
                     wf.mpPlanType === t.id ? "bg-foreground text-background border-foreground" : "bg-surface-elevated border-border hover:bg-surface-sunken"
                   )}
                 >
                   {t.label}
                 </button>
              ))}
           </div>
        </div>

        <div>
           <SectionHeader title="Zone Detection" />
           <div className="space-y-2">
              {wf.mpZones.map(zone => (
                 <div key={zone.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded">
                    <div className="w-4 h-4 rounded shadow-sm border border-black/10" style={{ backgroundColor: zone.color }} />
                    <span className="text-xs font-medium flex-1">{zone.name}</span>
                    <Toggle label="" checked={zone.selected} onChange={() => toggleZone(zone.id)} />
                 </div>
              ))}
              
              {isAdding ? (
                  <div className="p-2 bg-surface-elevated border border-border rounded animate-fade-in space-y-2">
                      <div className="flex items-center gap-2">
                          <div className="relative w-6 h-6 rounded overflow-hidden shadow-sm border border-border">
                             <input 
                                 type="color" 
                                 value={newZoneColor}
                                 onChange={(e) => setNewZoneColor(e.target.value)}
                                 className="absolute -top-1 -left-1 w-8 h-8 p-0 border-0 cursor-pointer" 
                             />
                          </div>
                          <input 
                              type="text" 
                              value={newZoneName}
                              onChange={(e) => setNewZoneName(e.target.value)}
                              placeholder="Zone Name" 
                              className="flex-1 text-xs bg-surface-sunken border border-border rounded px-2 h-7 focus:outline-none focus:border-accent transition-colors"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleAddZone()}
                          />
                      </div>
                      <div className="flex gap-2">
                          <button onClick={handleAddZone} className="flex-1 py-1.5 bg-foreground text-background text-[10px] font-medium rounded hover:bg-foreground/90 transition-colors">Confirm</button>
                          <button onClick={cancelAdd} className="flex-1 py-1.5 bg-surface-sunken text-foreground-secondary text-[10px] font-medium rounded hover:bg-border transition-colors">Cancel</button>
                      </div>
                  </div>
              ) : (
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="w-full py-2 border border-dashed border-border text-xs text-foreground-muted rounded hover:bg-surface-elevated transition-colors"
                  >
                     + Add Zone
                  </button>
              )}
           </div>
        </div>

        <div>
           <SectionHeader title="Context Loading" />
           <div className="bg-surface-sunken p-3 rounded-lg space-y-3 border border-border-subtle">
              <button className="w-full flex items-center justify-center gap-2 py-2 bg-surface-elevated border border-border rounded text-xs font-medium hover:border-foreground transition-colors">
                 <MapIcon size={14} /> Load from Location
              </button>
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                 <Toggle label="Surrounding Buildings" checked={wf.mpContext.loadBuildings} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadBuildings: v } } })} />
                 <Toggle label="Road Network" checked={wf.mpContext.loadRoads} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadRoads: v } } })} />
                 <Toggle label="Water Bodies" checked={wf.mpContext.loadWater} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadWater: v } } })} />
                 <Toggle label="Terrain Elevation" checked={wf.mpContext.loadTerrain} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { mpContext: { ...wf.mpContext, loadTerrain: v } } })} />
              </div>
           </div>
        </div>
      </div>
    );
};

const VisualEditPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;
    
    const tools = [
       { id: 'pan', icon: Hand, label: 'Pan' },
       { id: 'select', icon: MousePointer, label: 'Select' },
       { id: 'material', icon: Paintbrush, label: 'Material' },
       { id: 'lighting', icon: Sun, label: 'Lighting' },
       { id: 'object', icon: Home, label: 'Object' },
       { id: 'sky', icon: Cloud, label: 'Sky' },
       { id: 'remove', icon: Trash2, label: 'Remove' },
       { id: 'adjust', icon: Wrench, label: 'Adjust' },
       { id: 'extend', icon: Expand, label: 'Extend' },
    ];

    return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Tool Palette" />
            <div className="flex flex-col gap-2">
               {tools.map(tool => (
                  <button 
                     key={tool.id}
                     onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { activeTool: tool.id as any } })}
                     className={cn(
                        "flex items-center gap-4 px-3 py-3 rounded-lg border transition-all group",
                        wf.activeTool === tool.id 
                           ? "bg-foreground text-background border-foreground shadow-md" 
                           : "bg-surface-elevated border-border text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
                     )}
                  >
                     <tool.icon size={20} strokeWidth={1.5} />
                     <span className={cn("text-xs font-medium", wf.activeTool !== tool.id && "opacity-80")}>{tool.label}</span>
                     
                     {wf.activeTool === tool.id && (
                        <div className="ml-auto w-1.5 h-1.5 bg-background rounded-full animate-pulse" />
                     )}
                  </button>
               ))}
            </div>
         </div>

         <div className="pt-4 border-t border-border-subtle">
            <div className="flex items-center justify-between mb-3">
               <SectionHeader title="Layers" />
               <button className="p-1 hover:bg-surface-sunken rounded hover:text-foreground text-foreground-muted transition-colors"><Plus size={14}/></button>
            </div>
            <div className="space-y-2">
               {wf.editLayers.map(layer => (
                  <div key={layer.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded group hover:border-foreground-muted transition-colors relative">
                     <button className="text-foreground-muted hover:text-foreground">
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                     </button>
                     
                     <div className="w-8 h-8 rounded bg-surface-sunken shrink-0 flex items-center justify-center">
                        <Layers size={14} className="opacity-20" />
                     </div>
                     
                     <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{layer.name}</div>
                        <div className="text-[9px] text-foreground-muted uppercase tracking-wider">{layer.type}</div>
                     </div>
                     
                     {layer.locked && <span className="text-foreground-muted"><ScanLine size={12} /></span>}
                  </div>
               ))}
            </div>
         </div>
      </div>
    );
};

const ExplodedViewPanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Component Setup" />
            <div className="space-y-3 mb-4">
               <button className="w-full py-2 bg-surface-elevated border border-dashed border-border rounded text-xs text-foreground-muted hover:text-foreground transition-colors">
                  Upload Source Model
               </button>
            </div>
            
            <SectionHeader title="Explosion Order" />
            <div className="space-y-2">
               {wf.explodedComponents.sort((a,b) => a.order - b.order).map((comp) => (
                  <div key={comp.id} className="flex items-center gap-2 p-2 bg-surface-elevated border border-border rounded cursor-grab active:cursor-grabbing hover:shadow-sm transition-all">
                     <div className="flex flex-col gap-0.5 text-foreground-muted cursor-grab">
                        <div className="w-3 h-0.5 bg-current rounded-full" />
                        <div className="w-3 h-0.5 bg-current rounded-full" />
                        <div className="w-3 h-0.5 bg-current rounded-full" />
                     </div>
                     <span className="text-xs font-medium flex-1">{comp.name}</span>
                     <Toggle label="" checked={comp.active} onChange={()=>{}} />
                  </div>
               ))}
               <button className="w-full py-1.5 border border-dashed border-border text-[10px] text-foreground-muted rounded hover:bg-surface-elevated transition-colors">
                  + Add Component
               </button>
            </div>
         </div>
      </div>
   );
};

const SectionPanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Cut Definition" />
            <div className="space-y-4">
               <div>
                  <label className="text-xs text-foreground-muted mb-2 block">Cut Type</label>
                  <SegmentedControl 
                     value={wf.sectionCut.type}
                     options={[{label: 'Vertical', value: 'vertical'}, {label: 'Horizontal', value: 'horizontal'}, {label: 'Diagonal', value: 'diagonal'}]}
                     onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sectionCut: { ...wf.sectionCut, type: v } } })}
                  />
               </div>
               
               <Slider label="Cut Plane Position" value={wf.sectionCut.plane} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sectionCut: { ...wf.sectionCut, plane: v } } })} />
               
               <Slider label="View Depth" value={wf.sectionCut.depth} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sectionCut: { ...wf.sectionCut, depth: v } } })} />
               
               <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground-secondary">Look Direction</span>
                  <div className="flex gap-1 bg-surface-sunken p-1 rounded">
                     <button className="px-3 py-1 bg-surface-elevated rounded shadow-sm text-xs font-medium">Forward</button>
                     <button className="px-3 py-1 text-foreground-muted hover:text-foreground text-xs font-medium">Backward</button>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

const SketchPanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Sketch Analysis" />
            <div className="space-y-4">
               <div>
                  <label className="text-xs text-foreground-muted mb-2 block">Sketch Type</label>
                  <SegmentedControl 
                     value={wf.sketchType}
                     options={[{label: 'Exterior', value: 'exterior'}, {label: 'Interior', value: 'interior'}, {label: 'Detail', value: 'detail'}]}
                     onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sketchType: v } })}
                  />
               </div>
               
               <Slider label="Line Confidence" value={wf.sketchConfidence} min={0} max={100} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sketchConfidence: v } })} />
               
               <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <Toggle label="Clean Noise" checked={wf.sketchCleanup.clean} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sketchCleanup: { ...wf.sketchCleanup, clean: v } } })} />
                  <Toggle label="Enhance Lines" checked={wf.sketchCleanup.lines} onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { sketchCleanup: { ...wf.sketchCleanup, lines: v } } })} />
               </div>
            </div>
         </div>

         <div>
            <SectionHeader title="References" />
            <div className="grid grid-cols-3 gap-2 mb-2">
               <div className="aspect-square bg-surface-sunken rounded-lg border border-dashed border-border flex items-center justify-center hover:bg-surface-elevated cursor-pointer transition-colors text-foreground-muted hover:text-foreground">
                  <Plus size={20} />
               </div>
               {/* Placeholders for added refs */}
               <div className="aspect-square bg-surface-elevated rounded-lg border border-border relative group">
                  <div className="absolute inset-0 bg-black/10 rounded-lg" />
                  <button className="absolute top-1 right-1 p-1 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-sm"><Trash2 size={10} /></button>
               </div>
            </div>
         </div>
      </div>
   );
};

const UpscalePanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Batch Queue" />
            <div className="space-y-2">
               {wf.upscaleBatch.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-2 bg-surface-elevated border border-border rounded">
                     <div className="w-8 h-8 bg-surface-sunken rounded flex items-center justify-center">
                        <ImageIcon size={14} className="text-foreground-muted" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{item.name}</div>
                        <div className="text-[10px] text-foreground-muted capitalize flex items-center gap-1">
                           {item.status === 'done' && <Check size={10} className="text-green-500" />}
                           {item.status === 'processing' && <RefreshCw size={10} className="animate-spin text-blue-500" />}
                           {item.status}
                        </div>
                     </div>
                     {item.status === 'queued' && <button className="text-foreground-muted hover:text-red-500"><Trash2 size={14} /></button>}
                  </div>
               ))}
               <button className="w-full py-2 border border-dashed border-border text-xs text-foreground-muted rounded hover:bg-surface-elevated transition-colors">
                  + Add Images
               </button>
            </div>
         </div>
         
         <div className="bg-surface-sunken p-3 rounded-lg text-[10px] text-foreground-secondary leading-relaxed">
            <span className="font-bold">Note:</span> Upscaling large batches may take several minutes. You can continue working in other tabs while processing.
         </div>
      </div>
   );
};

const ImageToCADPanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Image Setup" />
            <div className="space-y-4">
               <div>
                  <label className="text-xs text-foreground-muted mb-2 block">Image Type</label>
                  <SegmentedControl 
                     value={wf.imgToCadType}
                     options={[{label: 'Photo', value: 'photo'}, {label: 'Render', value: 'render'}]}
                     onChange={(v) => dispatch({ type: 'UPDATE_WORKFLOW', payload: { imgToCadType: v } })}
                  />
               </div>
               
               <div className="flex items-center justify-between p-2 bg-surface-elevated border border-border rounded">
                  <span className="text-xs">Perspective Correction</span>
                  <div className="flex gap-2 text-[10px]">
                     <button className="px-2 py-1 bg-surface-sunken rounded hover:bg-background-tertiary">Auto</button>
                     <button className="px-2 py-1 text-foreground-muted hover:text-foreground">Manual</button>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

const ImageTo3DPanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Input Images" />
            <div className="space-y-3">
               {wf.img3dInputs.map((input, idx) => (
                  <div key={input.id} className="relative group">
                     <div className="aspect-[4/3] bg-surface-elevated border border-border rounded-lg flex items-center justify-center overflow-hidden">
                        <ImageIcon size={24} className="text-foreground-muted opacity-20" />
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                           Img {idx + 1}
                        </div>
                        {input.isPrimary && (
                           <div className="absolute top-2 right-2 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">
                              Primary
                           </div>
                        )}
                     </div>
                     <div className="mt-1 flex items-center gap-2">
                        <select className="flex-1 h-6 text-[10px] bg-surface-sunken border border-border rounded px-1">
                           <option>Front View</option>
                           <option>Side View</option>
                           <option>Perspective</option>
                        </select>
                        <button className="p-1 hover:bg-red-50 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                     </div>
                  </div>
               ))}
               <button className="w-full py-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-foreground-muted hover:border-foreground-muted hover:bg-surface-sunken transition-all">
                  <Plus size={24} />
                  <span className="text-xs">Add Reference Image</span>
               </button>
            </div>
         </div>
      </div>
   );
};

const VideoPanel = () => {
   const { state, dispatch } = useAppStore();
   const video = state.workflow.videoState;
   const updateVideo = (payload: Partial<typeof video>) => dispatch({ type: 'UPDATE_VIDEO_STATE', payload });
   const fileInputRef = useRef<HTMLInputElement>(null);

   const handleAddKeyframe = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
         const reader = new FileReader();
         reader.onload = (ev) => {
            if (ev.target?.result) {
               const newKeyframe = {
                  id: nanoid(),
                  url: ev.target.result as string,
                  duration: 2
               };
               updateVideo({ keyframes: [...video.keyframes, newKeyframe] });
            }
         };
         reader.readAsDataURL(e.target.files[0]);
      }
   };

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Video Mode" />
            <div className="space-y-2">
               {[
                  {id: 'image-animate', label: 'Image Animate', icon: Wand2},
                  {id: 'camera-path', label: 'Camera Path', icon: Camera},
                  {id: 'image-morph', label: 'Morph Sequence', icon: Layers},
                  {id: 'multi-shot', label: 'Multi-Shot', icon: Film},
               ].map(m => (
                  <button 
                     key={m.id}
                     onClick={() => updateVideo({ inputMode: m.id as any })}
                     className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                        video.inputMode === m.id 
                           ? "bg-surface-elevated border-foreground shadow-sm" 
                           : "bg-background-tertiary border-transparent hover:bg-surface-elevated hover:border-border"
                     )}
                  >
                     <div className={cn("p-2 rounded-full", video.inputMode === m.id ? "bg-foreground text-background" : "bg-surface-sunken text-foreground-muted")}>
                        <m.icon size={16} />
                     </div>
                     <div>
                        <div className="text-xs font-bold">{m.label}</div>
                        <div className="text-[10px] text-foreground-muted">
                           {m.id === 'image-animate' && "Add motion to still image"}
                           {m.id === 'camera-path' && "Flythrough from 3D/Image"}
                           {m.id === 'image-morph' && "Transition between views"}
                           {m.id === 'multi-shot' && "Assembly of clips"}
                        </div>
                     </div>
                  </button>
               ))}
            </div>
         </div>

         {video.inputMode !== 'image-animate' && (
            <div>
               <SectionHeader title="Input Sequence" />
               <div className="grid grid-cols-2 gap-2">
                  {video.keyframes.map((frame, i) => (
                     <div key={frame.id} className="relative group aspect-video bg-black rounded overflow-hidden border border-border">
                        <img src={frame.url} className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                           <button 
                              onClick={() => updateVideo({ keyframes: video.keyframes.filter(k => k.id !== frame.id) })}
                              className="p-1 bg-red-500/80 text-white rounded hover:bg-red-500"
                           >
                              <Trash2 size={12} />
                           </button>
                        </div>
                        <div className="absolute bottom-1 left-1 px-1 bg-black/50 text-[9px] text-white rounded">{i+1}</div>
                     </div>
                  ))}
                  <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="aspect-video border-2 border-dashed border-border rounded flex flex-col items-center justify-center gap-1 hover:bg-surface-elevated hover:border-foreground-muted transition-colors text-foreground-muted"
                  >
                     <Plus size={16} />
                     <span className="text-[10px]">Add Frame</span>
                  </button>
               </div>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAddKeyframe} />
            </div>
         )}
      </div>
   );
};

const MaterialValidationPanel = () => {
    // Mock Documents
    const documents = [
       { id: '1', name: 'Terminal_Materials.pdf', type: 'pdf', items: 26, status: 'synced', date: 'Today, 10:23 AM' },
       { id: '2', name: 'Cargo_Materials.pdf', type: 'pdf', items: 12, status: 'synced', date: 'Yesterday, 4:15 PM' },
       { id: '3', name: 'MQT_BoQ.xlsx', type: 'xls', items: 89, status: 'synced', date: 'Jan 8, 2024' },
    ];

    return (
      <div className="space-y-6">
        <div>
           <SectionHeader title="Project Documents" />
           <div className="space-y-2 mb-4">
              {documents.map(doc => (
                 <div key={doc.id} className="p-2.5 bg-surface-elevated border border-border rounded-lg group hover:border-foreground-muted transition-colors relative">
                    <div className="flex items-start gap-3">
                       <div className={cn(
                          "w-8 h-8 rounded flex items-center justify-center text-xs font-bold uppercase",
                          doc.type === 'pdf' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                       )}>
                          {doc.type === 'pdf' ? <FileText size={14} /> : <FileSpreadsheet size={14} />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate text-foreground">{doc.name}</div>
                          <div className="text-[10px] text-foreground-muted flex items-center gap-1.5 mt-0.5">
                             <span>{doc.items} items</span>
                             <span className="w-0.5 h-0.5 rounded-full bg-border-strong" />
                             <span>{doc.date}</span>
                          </div>
                       </div>
                       <button className="text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal size={14} />
                       </button>
                    </div>
                    {/* Status Indicator */}
                    <div className="absolute top-2 right-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 ring-2 ring-white" title="Synced" />
                    </div>
                 </div>
              ))}
           </div>

           <button className="w-full py-3 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1 text-foreground-muted hover:text-foreground hover:bg-surface-elevated hover:border-foreground-muted transition-all">
              <UploadCloud size={20} className="mb-1" />
              <span className="text-xs font-medium">Upload Document</span>
              <span className="text-[9px] text-foreground-muted/80">PDF, Excel, CSV</span>
           </button>
        </div>

        <div>
           <SectionHeader title="Validation Scope" />
           <div className="bg-surface-sunken p-3 rounded-lg space-y-3 border border-border-subtle">
              <label className="flex items-center gap-2 cursor-pointer group">
                 <Toggle label="" checked={true} onChange={()=>{}} />
                 <div className="flex-1">
                    <div className="text-xs font-medium group-hover:text-foreground">Cross-Reference BoQ</div>
                    <div className="text-[10px] text-foreground-muted">Compare against Bill of Quantities</div>
                 </div>
              </label>
              <div className="h-px bg-border-subtle" />
              <label className="flex items-center gap-2 cursor-pointer group">
                 <Toggle label="" checked={true} onChange={()=>{}} />
                 <div className="flex-1">
                    <div className="text-xs font-medium group-hover:text-foreground">Tech. Specification</div>
                    <div className="text-[10px] text-foreground-muted">Validate norms & standards</div>
                 </div>
              </label>
           </div>
        </div>
      </div>
    );
};


// --- Main LeftSidebar Component ---
export const LeftSidebar: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { leftSidebarOpen } = state;
  const isGenerateTextMode = state.mode === 'generate-text';
  const showPanel = !isGenerateTextMode;

  const renderPanel = () => {
    switch (state.mode) {
      case 'generate-text': return <GenerateTextPanel />;
      case 'render-3d': return <Render3DPanel />;
      case 'render-cad': return <RenderCADPanel />;
      case 'material-validation': return <MaterialValidationPanel />;
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
      {/* Feature Switcher Rail - Always visible for navigation */}
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
              <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 ml-3 transition-opacity duration-200 delay-75">
                {workflow.label}
              </span>
              
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />}
            </button>
          );
        })}
      </div>

      {/* Specific Workflow Content Panel - HIDDEN in generate-text mode */}
      {showPanel && (leftSidebarOpen ? (
        <div className={cn(
          "bg-background-tertiary border-r border-border flex flex-col overflow-hidden transition-all relative",
          state.leftSidebarWidth ? `w-[${state.leftSidebarWidth}px]` : "w-[280px]"
        )}>
           {/* Fixed Header */}
           <div className="shrink-0 p-5 pb-3 bg-background-tertiary border-b border-border-subtle z-10 flex justify-between items-center">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{activeWorkflowLabel}</h2>
              <button 
                onClick={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })}
                className="text-foreground-muted hover:text-foreground hover:bg-surface-sunken p-1 rounded-md transition-colors"
                title="Collapse Sidebar"
              >
                <ChevronsLeft size={16} />
              </button>
           </div>
           
           {/* Scrollable Content */}
           <div className="flex-1 overflow-y-auto p-5 pt-4 custom-scrollbar">
             {renderPanel()}
           </div>
        </div>
      ) : (
        <div className="w-10 bg-background-tertiary border-r border-border relative flex flex-col items-center">
           <button 
             onClick={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })}
             className="mt-4 p-1 text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-md transition-all z-30"
             title="Expand Sidebar"
           >
             <ChevronsRight size={16} />
           </button>
           <div className="flex-1 flex items-center justify-center">
              <div 
                className="whitespace-nowrap text-xs font-bold text-foreground-muted uppercase tracking-wider" 
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {activeWorkflowLabel}
              </div>
           </div>
        </div>
      ))}
    </div>
  );
};