
import React, { useCallback, useRef } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { Image as ImageIcon, Check, RefreshCw, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { nanoid } from 'nanoid';
import { cn } from '../../../lib/utils';

export const LeftUpscalePanel = () => {
   const { state, dispatch } = useAppStore();
   const wf = state.workflow;
   const fileInputRef = useRef<HTMLInputElement>(null);
   const maxBatchSize = 20;

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
      const remainingSlots = Math.max(0, maxBatchSize - wf.upscaleBatch.length);
      if (remainingSlots === 0) {
         event.target.value = '';
         return;
      }
      try {
         const results = await Promise.all(
            files.slice(0, remainingSlots).map(async (file) => {
               const url = await readFileAsDataUrl(file);
               return {
                  id: nanoid(),
                  name: file.name,
                  status: 'queued' as const,
                  url,
               };
            })
         );
         updateWf({ upscaleBatch: [...wf.upscaleBatch, ...results] });
      } catch (error) {
         console.error('Failed to add images', error);
      } finally {
         event.target.value = '';
      }
   }, [maxBatchSize, readFileAsDataUrl, updateWf, wf.upscaleBatch.length]);

   const handleRemove = useCallback((id: string) => {
      updateWf({ upscaleBatch: wf.upscaleBatch.filter((item) => item.id !== id) });
   }, [updateWf, wf.upscaleBatch]);

   const handleSelect = useCallback((itemUrl?: string) => {
      if (!itemUrl) return;
      dispatch({ type: 'SET_IMAGE', payload: itemUrl });
      dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
      dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
   }, [dispatch]);

   const handleRetryFailed = useCallback((id: string) => {
      // Reset the failed item to queued status so it will be retried
      updateWf({
         upscaleBatch: wf.upscaleBatch.map((item) =>
            item.id === id ? { ...item, status: 'queued' as const, retryCount: 0, error: undefined } : item
         )
      });
   }, [updateWf, wf.upscaleBatch]);

   const total = wf.upscaleBatch.length;
   const remainingSlots = Math.max(0, maxBatchSize - total);
   const completed = wf.upscaleBatch.filter((item) => item.status === 'done').length;
   const failed = wf.upscaleBatch.filter((item) => item.status === 'failed').length;

   return (
      <div className="space-y-6">
         <div>
            <SectionHeader title="Batch Queue" />
            <div className="space-y-2">
               {wf.upscaleBatch.map(item => {
                  const isSelected = !!item.url && item.url === state.uploadedImage;
                  return (
                  <div
                     key={item.id}
                     onClick={() => handleSelect(item.url)}
                     className={cn(
                        "flex w-full items-center gap-3 p-2 rounded border text-left transition-colors",
                        isSelected
                           ? "border-accent bg-accent/10"
                           : "bg-surface-elevated border-border hover:border-foreground/40"
                     )}
                     role="button"
                     tabIndex={0}
                     onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                           event.preventDefault();
                           handleSelect(item.url);
                        }
                     }}
                  >
                     <div className="w-8 h-8 bg-surface-sunken rounded flex items-center justify-center">
                        <ImageIcon size={14} className="text-foreground-muted" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{item.name}</div>
                        <div className="text-[10px] text-foreground-muted capitalize flex items-center gap-1">
                           {item.status === 'done' && <Check size={10} className="text-green-500" />}
                           {item.status === 'processing' && <RefreshCw size={10} className="animate-spin text-blue-500" />}
                           {item.status === 'failed' && <AlertTriangle size={10} className="text-red-500" />}
                           {item.status === 'processing' && item.retryCount && item.retryCount > 0
                              ? `retry ${item.retryCount}/3`
                              : item.status}
                        </div>
                        {item.status === 'failed' && item.error && (
                           <div className="text-[9px] text-red-400 truncate" title={item.error}>
                              {item.error.length > 40 ? item.error.slice(0, 40) + '...' : item.error}
                           </div>
                        )}
                     </div>
                     {item.status === 'failed' && (
                        <button
                           type="button"
                           className="text-foreground-muted hover:text-blue-500"
                           title="Retry this image"
                           onClick={(event) => {
                              event.stopPropagation();
                              handleRetryFailed(item.id);
                           }}
                        >
                           <RotateCcw size={14} />
                        </button>
                     )}
                     {(item.status === 'queued' || item.status === 'failed') && (
                        <button
                           type="button"
                           className="text-foreground-muted hover:text-red-500"
                           onClick={(event) => {
                              event.stopPropagation();
                              handleRemove(item.id);
                           }}
                        >
                           <Trash2 size={14} />
                        </button>
                     )}
                  </div>
               )})}
               <button
                  type="button"
                  disabled={remainingSlots === 0}
                  className={cn(
                     "w-full py-2 border border-dashed text-xs rounded transition-colors",
                     remainingSlots === 0
                        ? "border-border text-foreground-muted/60 cursor-not-allowed"
                        : "border-border text-foreground-muted hover:bg-surface-elevated"
                  )}
                  onClick={() => fileInputRef.current?.click()}
               >
                  {remainingSlots === 0 ? `Queue Full (${maxBatchSize} max)` : `+ Add Images (${remainingSlots} left)`}
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
         
         {total > 0 && (
            <div className="bg-surface-elevated border border-border p-3 rounded-lg">
               <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">
                     {completed}/{total} completed
                     {failed > 0 && <span className="text-red-400 ml-1">({failed} failed)</span>}
                  </span>
                  {completed === total && total > 0 && failed === 0 && (
                     <Check size={14} className="text-green-500" />
                  )}
                  {completed + failed === total && total > 0 && failed > 0 && (
                     <AlertTriangle size={14} className="text-yellow-500" />
                  )}
               </div>
               <div className="w-full bg-surface-sunken rounded-full h-1.5 relative overflow-hidden">
                  <div
                     className="bg-accent h-1.5 rounded-full transition-all duration-300 absolute left-0"
                     style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                  />
                  {failed > 0 && (
                     <div
                        className="bg-red-500 h-1.5 rounded-full transition-all duration-300 absolute"
                        style={{
                           left: `${total > 0 ? (completed / total) * 100 : 0}%`,
                           width: `${total > 0 ? (failed / total) * 100 : 0}%`
                        }}
                     />
                  )}
               </div>
            </div>
         )}

         <div className="bg-surface-sunken p-3 rounded-lg text-[10px] text-foreground-secondary leading-relaxed">
            Batch processing saves ~30% compared to single-image runs.
         </div>
      </div>
   );
};
