
import React, { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const LeftImageTo3DPanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;
   const fileInputRef = useRef<HTMLInputElement>(null);

   const updateWf = useCallback(
      (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
      [dispatch, wf]
   );

   const readFileAsDataUrl = useCallback((file: File) => (
      new Promise<string>((resolve, reject) => {
         const reader = new FileReader();
         reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
         reader.onerror = () => reject(new Error('Failed to read file'));
         reader.readAsDataURL(file);
      })
   ), []);

   const handleAddImages = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      try {
         const results = await Promise.all(
            files.map(async (file, idx) => {
               const url = await readFileAsDataUrl(file);
               return {
                  id: nanoid(),
                  view: `View ${wf.img3dInputs.length + idx + 1}`,
                  isPrimary: wf.img3dInputs.length === 0 && idx === 0,
                  url,
               };
            })
         );
         updateWf({ img3dInputs: [...wf.img3dInputs, ...results] });
      } catch (error) {
         console.error('Failed to add 3D inputs', error);
      } finally {
         event.target.value = '';
      }
   }, [readFileAsDataUrl, updateWf, wf.img3dInputs]);

   const handleSelect = useCallback((url?: string) => {
      if (!url) return;
      dispatch({ type: 'SET_IMAGE', payload: url });
      dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
      dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
   }, [dispatch]);

   const handleRemove = useCallback((id: string) => {
      updateWf({ img3dInputs: wf.img3dInputs.filter((input) => input.id !== id) });
   }, [updateWf, wf.img3dInputs]);

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Input Images" />
            <div className="space-y-3">
               {wf.img3dInputs.map((input, idx) => {
                  const isSelected = !!input.url && input.url === state.uploadedImage;
                  return (
                     <div key={input.id} className="relative group">
                        <div
                           className={cn(
                              "aspect-[4/3] border rounded-lg flex items-center justify-center overflow-hidden transition-colors cursor-pointer",
                              isSelected
                                 ? "border-accent bg-accent/10"
                                 : "bg-surface-elevated border-border hover:border-foreground/40"
                           )}
                           role="button"
                           tabIndex={0}
                           onClick={() => handleSelect(input.url)}
                           onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                 event.preventDefault();
                                 handleSelect(input.url);
                              }
                           }}
                        >
                           {input.url ? (
                              <img src={input.url} alt={input.view} className="h-full w-full object-cover" />
                           ) : null}
                           <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                              Img {idx + 1}
                           </div>
                           {input.isPrimary && (
                              <div className="absolute top-2 right-2 bg-accent text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">
                                 Primary
                              </div>
                           )}
                           <button
                              type="button"
                              className="absolute bottom-2 right-2 text-white/80 hover:text-white bg-black/50 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(event) => {
                                 event.stopPropagation();
                                 handleRemove(input.id);
                              }}
                           >
                              <Trash2 size={12} />
                           </button>
                        </div>
                     </div>
                  );
               })}
               <button
                  type="button"
                  className="w-full py-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-foreground-muted hover:border-foreground-muted hover:bg-surface-sunken transition-all"
                  onClick={() => fileInputRef.current?.click()}
               >
                  <Plus size={24} />
                  <span className="text-xs">Add Reference Image</span>
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
      </div>
   );
};
