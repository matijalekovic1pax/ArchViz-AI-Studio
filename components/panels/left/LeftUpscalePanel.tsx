
import React, { useCallback, useRef } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { Image as ImageIcon, Check, RefreshCw, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';

export const LeftUpscalePanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;
   const fileInputRef = useRef<HTMLInputElement>(null);

   const updateWf = useCallback(
      (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
      [dispatch, wf]
   );

   const handleAddImages = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      const nextItems = files.map((file) => ({
         id: nanoid(),
         name: file.name,
         status: 'queued' as const,
      }));
      updateWf({ upscaleBatch: [...wf.upscaleBatch, ...nextItems] });
      event.target.value = '';
   }, [updateWf, wf.upscaleBatch]);

   const handleRemove = useCallback((id: string) => {
      updateWf({ upscaleBatch: wf.upscaleBatch.filter((item) => item.id !== id) });
   }, [updateWf, wf.upscaleBatch]);

   const total = wf.upscaleBatch.length;
   const completed = wf.upscaleBatch.filter((item) => item.status === 'done').length;

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
                     {item.status === 'queued' && (
                        <button
                           type="button"
                           className="text-foreground-muted hover:text-red-500"
                           onClick={() => handleRemove(item.id)}
                        >
                           <Trash2 size={14} />
                        </button>
                     )}
                  </div>
               ))}
               <button
                  type="button"
                  className="w-full py-2 border border-dashed border-border text-xs text-foreground-muted rounded hover:bg-surface-elevated transition-colors"
                  onClick={() => fileInputRef.current?.click()}
               >
                  + Add Images
               </button>
               <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleAddImages}
               />
            </div>
         </div>
         
         <div className="bg-surface-sunken p-3 rounded-lg text-[10px] text-foreground-secondary leading-relaxed space-y-1">
            <div className="flex items-center justify-between text-foreground">
               <span className="font-semibold">Progress</span>
               <span>{completed}/{total} completed</span>
            </div>
            <div>Batch processing saves ~30% compared to single-image runs.</div>
         </div>
      </div>
   );
};
