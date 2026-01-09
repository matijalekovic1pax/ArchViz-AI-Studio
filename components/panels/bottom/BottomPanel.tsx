import React from 'react';
import { useAppStore } from '../../../store';
import { generatePrompt } from '../../../engine/promptEngine';
import { ChevronDown, Copy, Terminal, History, Clock, Layers, Play, Pause, SkipForward, List, Wand2, Eye, EyeOff, GripVertical, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GenerationMode } from '../../../types';

export const BottomPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const prompt = generatePrompt(state);

  // Determine available tabs based on mode
  const showTimeline = state.mode === 'video' || state.mode === 'exploded';
  const showLegend = state.mode === 'masterplan';
  const showEditStack = state.mode === 'visual-edit';
  const showCleanup = state.mode === 'render-sketch' || state.mode === 'img-to-cad';

  const renderContent = () => {
    if (state.activeBottomTab === 'prompt') {
      return (
        <div className="absolute inset-0 p-4 overflow-y-auto font-mono text-sm leading-relaxed text-foreground-secondary group">
          {prompt}
          <button 
            className="absolute top-4 right-4 p-2 bg-surface-elevated border border-border rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-sunken"
            title="Copy Prompt"
            onClick={() => navigator.clipboard.writeText(prompt)}
          >
            <Copy size={14} />
          </button>
        </div>
      );
    }

    if (state.activeBottomTab === 'timeline') {
      return (
        <div className="absolute inset-0 flex flex-col">
          {/* Timeline Toolbar */}
          <div className="h-10 border-b border-border flex items-center px-4 gap-4 bg-surface-elevated">
            <div className="flex items-center gap-2 text-foreground-secondary">
               <button className="p-1 hover:text-foreground rounded hover:bg-surface-sunken"><Play size={16} fill="currentColor" /></button>
               <button className="p-1 hover:text-foreground rounded hover:bg-surface-sunken"><Pause size={16} /></button>
               <button className="p-1 hover:text-foreground rounded hover:bg-surface-sunken"><SkipForward size={16} /></button>
            </div>
            <div className="h-4 w-px bg-border-strong" />
            <span className="text-xs font-mono text-foreground-muted">00:00:00 / 00:00:10</span>
          </div>
          {/* Timeline Tracks */}
          <div className="flex-1 bg-surface-sunken relative p-4 overflow-x-auto">
             <div className="w-[800px] h-full relative">
                <div className="absolute top-0 bottom-0 left-[20%] w-px bg-red-500 z-10" /> {/* Playhead */}
                {/* Track 1 */}
                <div className="h-8 bg-accent/20 border border-accent rounded mb-2 w-[40%] absolute left-0 flex items-center px-2 text-[10px] text-accent-hover truncate">
                   Orbit Shot
                </div> 
                {/* Track 2 */}
                <div className="h-8 bg-blue-500/20 border border-blue-500 rounded mb-2 w-[30%] absolute left-[45%] flex items-center px-2 text-[10px] text-blue-700 truncate">
                   Transition
                </div> 
                {/* Ruler */}
                <div className="absolute top-12 left-0 w-full border-t border-border-strong border-dashed flex justify-between text-[9px] text-foreground-muted pt-1 font-mono">
                   <span>0s</span><span>2s</span><span>4s</span><span>6s</span><span>8s</span><span>10s</span>
                </div>
             </div>
          </div>
        </div>
      );
    }
    
    if (state.activeBottomTab === 'legend') {
       return (
         <div className="absolute inset-0 p-4 overflow-y-auto">
           <table className="w-full text-xs text-left">
             <thead className="text-foreground-muted border-b border-border">
               <tr>
                 <th className="pb-2 font-medium pl-2">Zone</th>
                 <th className="pb-2 font-medium">Color</th>
                 <th className="pb-2 font-medium">Area</th>
                 <th className="pb-2 font-medium text-right pr-2">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-border-subtle">
               {state.workflow.mpZones.map((item: any) => (
                 <tr key={item.id} className="group hover:bg-surface-sunken transition-colors">
                   <td className="py-2 pl-2 font-medium">{item.name}</td>
                   <td className="py-2">
                      <div className="w-4 h-4 rounded border border-black/10 shadow-sm" style={{ backgroundColor: item.color }}/>
                   </td>
                   <td className="py-2 font-mono text-foreground-secondary">12,500 m²</td>
                   <td className="py-2 text-right pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-foreground-muted hover:text-foreground px-1">Edit</button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       );
    }

    if (state.activeBottomTab === 'edit-stack') {
       return (
          <div className="absolute inset-0 p-4 overflow-y-auto">
             <div className="space-y-2 max-w-lg">
                {state.workflow.editLayers.map((layer: any, i: number) => (
                   <div key={layer.id} className="flex items-center gap-3 p-2 bg-surface-elevated border border-border rounded shadow-sm group">
                      <GripVertical size={14} className="text-foreground-muted cursor-grab" />
                      <div className="w-8 h-8 bg-surface-sunken rounded flex items-center justify-center text-xs font-mono text-foreground-muted">
                         {i+1}
                      </div>
                      <div className="flex-1">
                         <div className="text-sm font-medium">{layer.name}</div>
                         <div className="text-[10px] text-foreground-muted uppercase tracking-wider">{layer.locked ? 'Locked' : 'Editable'}</div>
                      </div>
                      <button className="text-foreground-muted hover:text-foreground">
                         {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                   </div>
                ))}
             </div>
          </div>
       );
    }

    if (state.activeBottomTab === 'cleanup') {
      return (
         <div className="absolute inset-0 p-4 overflow-y-auto">
            <div className="grid grid-cols-4 gap-4">
               {['Denoise', 'Sharpen Lines', 'Close Gaps', 'Remove Grid'].map(fix => (
                  <button key={fix} className="flex flex-col items-center justify-center p-4 border border-border rounded-lg bg-surface-elevated hover:border-foreground-muted hover:bg-surface-sunken transition-all group">
                     <Wand2 size={20} className="mb-2 text-accent group-hover:text-foreground transition-colors" />
                     <span className="text-xs font-medium">{fix}</span>
                  </button>
               ))}
            </div>
         </div>
      );
    }

    if (state.activeBottomTab === 'history') {
      return (
        <div className="absolute inset-0 p-4 overflow-x-auto flex items-center gap-4 custom-scrollbar">
          {state.history.length === 0 ? (
             <div className="w-full h-full flex flex-col items-center justify-center text-foreground-muted gap-2">
                <Clock size={24} className="opacity-20" />
                <span className="text-xs">No history in this session.</span>
             </div>
          ) : (
             state.history.map((item) => (
               <div 
                  key={item.id} 
                  className="min-w-[140px] aspect-video rounded-lg border border-border bg-surface-elevated flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-foreground transition-colors group relative overflow-hidden"
                  onClick={() => {
                     // In a real app, this would load the history state
                     if (confirm("Load this historical state? Current unsaved changes will be lost.")) {
                        dispatch({ type: 'LOAD_PROJECT', payload: { ...state, workflow: item.settings, uploadedImage: item.thumbnail } });
                     }
                  }}
               >
                  {/* Thumbnail */}
                  <div className="absolute inset-0 bg-surface-sunken">
                     <img src={item.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  {/* Overlay Info */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                     <div className="text-[10px] font-medium truncate">{new Date(item.timestamp).toLocaleTimeString()}</div>
                     <div className="text-[8px] opacity-80 truncate">{item.mode}</div>
                  </div>
               </div>
             ))
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div 
      className={cn(
        "bg-background-secondary border-t border-border transition-all duration-300 flex flex-col z-30",
        state.bottomPanelCollapsed ? "h-9" : "h-[220px]"
      )}
    >
      <div className="h-9 flex items-center justify-between px-0 bg-surface-elevated border-b border-border-subtle shrink-0">
        <div className="flex h-full overflow-x-auto no-scrollbar">
           <button 
             onClick={() => dispatch({ type: 'SET_ACTIVE_BOTTOM_TAB', payload: 'prompt' })}
             className={cn(
               "flex items-center gap-2 px-4 h-full border-r border-border-subtle text-xs font-medium uppercase tracking-wider transition-colors",
               state.activeBottomTab === 'prompt' ? "bg-background-secondary text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
             )}
           >
             <Terminal size={14} />
             Prompt
           </button>
           
           <button 
             onClick={() => dispatch({ type: 'SET_ACTIVE_BOTTOM_TAB', payload: 'history' })}
             className={cn(
               "flex items-center gap-2 px-4 h-full border-r border-border-subtle text-xs font-medium uppercase tracking-wider transition-colors",
               state.activeBottomTab === 'history' ? "bg-background-secondary text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
             )}
           >
             <History size={14} />
             History
           </button>

           {showTimeline && (
              <button 
                onClick={() => dispatch({ type: 'SET_ACTIVE_BOTTOM_TAB', payload: 'timeline' })}
                className={cn(
                  "flex items-center gap-2 px-4 h-full border-r border-border-subtle text-xs font-medium uppercase tracking-wider transition-colors",
                  state.activeBottomTab === 'timeline' ? "bg-background-secondary text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                <Clock size={14} />
                Timeline
              </button>
           )}

           {showLegend && (
              <button 
                onClick={() => dispatch({ type: 'SET_ACTIVE_BOTTOM_TAB', payload: 'legend' })}
                className={cn(
                  "flex items-center gap-2 px-4 h-full border-r border-border-subtle text-xs font-medium uppercase tracking-wider transition-colors",
                  state.activeBottomTab === 'legend' ? "bg-background-secondary text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                <Layers size={14} />
                Legend
              </button>
           )}

           {showEditStack && (
              <button 
                onClick={() => dispatch({ type: 'SET_ACTIVE_BOTTOM_TAB', payload: 'edit-stack' })}
                className={cn(
                  "flex items-center gap-2 px-4 h-full border-r border-border-subtle text-xs font-medium uppercase tracking-wider transition-colors",
                  state.activeBottomTab === 'edit-stack' ? "bg-background-secondary text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                <List size={14} />
                Edit Stack
              </button>
           )}
           
           {showCleanup && (
              <button 
                onClick={() => dispatch({ type: 'SET_ACTIVE_BOTTOM_TAB', payload: 'cleanup' })}
                className={cn(
                  "flex items-center gap-2 px-4 h-full border-r border-border-subtle text-xs font-medium uppercase tracking-wider transition-colors",
                  state.activeBottomTab === 'cleanup' ? "bg-background-secondary text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                <Wand2 size={14} />
                Quick Fixes
              </button>
           )}
        </div>
        
        <div 
          className="h-full flex items-center px-4 cursor-pointer hover:bg-surface-sunken border-l border-border-subtle"
          onClick={() => dispatch({ type: 'TOGGLE_BOTTOM_PANEL' })}
        >
          <ChevronDown 
            size={16} 
            className={cn(
              "text-foreground-muted transition-transform duration-300", 
              state.bottomPanelCollapsed ? "rotate-180" : "rotate-0"
            )} 
          />
        </div>
      </div>

      {!state.bottomPanelCollapsed && (
        <div className="flex-1 overflow-hidden relative">
           {renderContent()}
        </div>
      )}
    </div>
  );
};