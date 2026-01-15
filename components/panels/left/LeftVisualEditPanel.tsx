
import React from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { MousePointer, Paintbrush, Sun, Home, Cloud, Trash2, Wrench, Expand, Plus, Eye, EyeOff, Layers, ScanLine, Shuffle } from 'lucide-react';

export const LeftVisualEditPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;
    
    const selectionTool = { id: 'select', icon: MousePointer, label: 'Select' };
    const operationTools = [
       { id: 'material', icon: Paintbrush, label: 'Material' },
       { id: 'lighting', icon: Sun, label: 'Lighting' },
       { id: 'object', icon: Home, label: 'Object' },
       { id: 'sky', icon: Cloud, label: 'Sky' },
       { id: 'remove', icon: Trash2, label: 'Remove' },
       { id: 'replace', icon: Shuffle, label: 'Replace' },
       { id: 'adjust', icon: Wrench, label: 'Adjust' },
       { id: 'extend', icon: Expand, label: 'Extend' },
    ];

    return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Selection" />
            <div className="flex flex-col gap-2">
               {[selectionTool].map(tool => (
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

         <div>
            <SectionHeader title="Operations" />
            <div className="flex flex-col gap-2">
               {operationTools.map(tool => (
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
