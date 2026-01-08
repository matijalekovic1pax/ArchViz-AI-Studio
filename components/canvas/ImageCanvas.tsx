import React, { useRef, useState } from 'react';
import { useAppStore } from '../../../store';
import { UploadCloud, Image as ImageIcon, Columns, Minimize2, MoveHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

export const ImageCanvas: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [comparePos, setComparePos] = useState(50);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        dispatch({ type: 'SET_IMAGE', payload: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
       const reader = new FileReader();
      reader.onload = (ev) => {
        dispatch({ type: 'SET_IMAGE', payload: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // Determine if dual view logic should be active
  const isDualView = state.mode === 'render-3d' || state.mode === 'render-cad' || state.mode === 'render-sketch';
  const isCompare = state.mode === 'upscale';

  return (
    <div className="flex-1 bg-[#E5E5E5] relative overflow-hidden flex flex-col">
       {/* Canvas Toolbar - Only showing contextual tools, Zoom is in TopBar */}
       <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-surface-elevated/90 backdrop-blur border border-border rounded-lg p-1 shadow-sm">
          <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium hover:bg-surface-sunken rounded text-foreground-secondary" title="Fit to Screen">
             <Minimize2 size={14} /> Fit
          </button>
          
          {isDualView && (
             <>
               <div className="w-px h-4 bg-border" />
               <button 
                 className="flex items-center gap-1 px-2 py-1 text-xs font-medium hover:bg-surface-sunken rounded text-foreground-secondary"
                 onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { canvasSync: !state.workflow.canvasSync } })}
               >
                  <Columns size={14} /> {state.workflow.canvasSync ? 'Split' : 'Single'}
               </button>
             </>
          )}
          
          {isCompare && (
             <>
               <div className="w-px h-4 bg-border" />
               <button 
                 className={cn(
                   "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors",
                   state.workflow.compareMode ? "bg-accent text-white" : "hover:bg-surface-sunken text-foreground-secondary"
                 )}
                 onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { compareMode: !state.workflow.compareMode } })}
               >
                  <MoveHorizontal size={14} /> Compare
               </button>
             </>
          )}
       </div>

      <div className="flex-1 relative flex items-center justify-center bg-checkerboard">
         {/* Grid Pattern Background */}
         <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
            style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
         />

         {state.uploadedImage ? (
         <div className="relative shadow-2xl max-h-[calc(100vh-160px)] max-w-[calc(100vw-650px)] group">
            {isDualView ? (
               // Mock Dual View
               <div className="flex gap-1 h-[60vh] bg-background border border-border p-1">
                  <div className="flex-1 bg-surface-sunken relative overflow-hidden flex items-center justify-center">
                     <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted bg-surface-elevated px-2 py-1 rounded shadow-sm z-10">Source</span>
                     <img src={state.uploadedImage} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="w-px bg-border-strong cursor-col-resize hover:bg-accent transition-colors" />
                  <div className="flex-1 bg-surface-elevated relative overflow-hidden flex items-center justify-center">
                     <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider text-accent bg-surface-elevated px-2 py-1 rounded shadow-sm border border-accent/20 z-10">Preview</span>
                     <div className="text-foreground-muted text-xs flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-foreground-muted animate-spin" />
                        Waiting for render...
                     </div>
                  </div>
               </div>
            ) : isCompare ? (
               // Mock Comparison Slider
               <div className="relative overflow-hidden rounded-sm select-none">
                  <img src={state.uploadedImage} className="max-h-[70vh] object-contain pointer-events-none" />
                  <div className="absolute inset-0 bg-black/5 flex items-center justify-center">
                     <div 
                        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10 flex items-center justify-center" 
                        style={{ left: `${comparePos}%` }}
                        onMouseDown={() => { /* Mock interaction */ }}
                     >
                        <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-black">
                           <MoveHorizontal size={16} />
                        </div>
                     </div>
                  </div>
                  <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 text-xs rounded backdrop-blur">
                     Upscale Preview
                  </div>
               </div>
            ) : (
               // Standard Single View
               <>
                  <img src={state.uploadedImage} alt="Upload" className="max-h-[calc(100vh-250px)] max-w-full object-contain rounded-sm" />
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                     onClick={() => dispatch({ type: 'SET_IMAGE', payload: null })}
                     className="bg-black/50 text-white px-3 py-1.5 rounded-md text-xs backdrop-blur-sm hover:bg-black/70 shadow-sm"
                     >
                     Clear Image
                     </button>
                  </div>
               </>
            )}
         </div>
         ) : (
         <div 
            className={cn(
               "w-[400px] h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 transition-all cursor-pointer bg-surface-elevated/50 backdrop-blur-sm",
               isDragging ? "border-accent bg-accent/5" : "border-border-strong hover:border-foreground/30"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
         >
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <div className="w-16 h-16 rounded-full bg-surface-sunken flex items-center justify-center">
               <UploadCloud className="text-foreground-muted" size={32} />
            </div>
            <div className="text-center space-y-1">
               <p className="font-medium text-foreground">Click or drop image</p>
               <p className="text-xs text-foreground-muted">Support for PNG, JPG (Max 50MB)</p>
            </div>
         </div>
         )}
      </div>
    </div>
  );
};