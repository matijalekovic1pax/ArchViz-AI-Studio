

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { generatePrompt } from '../../../engine/promptEngine';
import { ChevronDown, Copy, Terminal, History, Clock, Layers, Play, Pause, SkipForward, List, Wand2, Eye, EyeOff, GripVertical, Check, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Slider } from '../../ui/Slider';
import type { HistoryItem } from '../../../types';
import { VideoLockBanner } from '../../video/VideoLockBanner';

export const BottomPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const prompt = generatePrompt(state);
  const [historySelectMode, setHistorySelectMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(() => new Set());

  const showTimeline = state.mode === 'video' || state.mode === 'exploded';
  const showLegend = state.mode === 'masterplan';
  const showEditStack = state.mode === 'visual-edit';
  const showCleanup = state.mode === 'img-to-cad';
  const isGenerateTextMode = state.mode === 'generate-text';
  const isUpscaleMode = state.mode === 'upscale';
  const isMultiAngleMode = state.mode === 'multi-angle';
  const isSelectableHistoryMode = isUpscaleMode || isMultiAngleMode;
  const isVideoLocked = state.mode === 'video' && !state.workflow.videoState.accessUnlocked;
  const resolvedBottomTab = isGenerateTextMode
    ? 'history'
    : (!showCleanup && state.activeBottomTab === 'cleanup' ? 'prompt' : state.activeBottomTab);

  useEffect(() => {
    if (!isSelectableHistoryMode || resolvedBottomTab !== 'history') {
      setHistorySelectMode(false);
      setSelectedHistoryIds(new Set());
    }
  }, [isSelectableHistoryMode, resolvedBottomTab]);

  const toggleHistorySelection = useCallback((id: string) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const getHistoryExtension = useCallback((dataUrl: string) => {
    const match = dataUrl.match(/^data:([^;]+);/);
    const mimeType = match?.[1] || '';
    switch (mimeType) {
      case 'image/png':
        return 'png';
      case 'image/jpeg':
        return 'jpg';
      case 'image/webp':
        return 'webp';
      case 'image/tiff':
        return 'tiff';
      default:
        return 'png';
    }
  }, []);

  const downloadHistoryItem = useCallback(async (item: HistoryItem, index: number) => {
    const source = item.thumbnail;
    if (!source) return;
    const filename = `archviz-history-${index + 1}-${item.timestamp}.png`;

    const exportAsPng = () => new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No canvas context');
          ctx.drawImage(img, 0, 0, img.width, img.height);
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = source;
    });

    try {
      await exportAsPng();
    } catch (error) {
      console.error('History PNG export failed, falling back to original.', error);
      const ext = getHistoryExtension(source);
      const fallbackName = `archviz-history-${index + 1}-${item.timestamp}.${ext}`;
      try {
        const response = await fetch(source);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fallbackName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (fallbackError) {
        console.error('History download failed, falling back to direct link.', fallbackError);
        const link = document.createElement('a');
        link.href = source;
        link.download = fallbackName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [getHistoryExtension]);

  const downloadHistoryItems = useCallback((items: HistoryItem[]) => {
    items.forEach((item, index) => {
      window.setTimeout(() => {
        void downloadHistoryItem(item, index);
      }, index * 120);
    });
  }, [downloadHistoryItem]);

  const historyItems = useMemo(() => {
    if (!isMultiAngleMode) return state.history;
    return state.history.filter((item) => item.mode === 'multi-angle');
  }, [isMultiAngleMode, state.history]);
  const selectedHistoryItems = useMemo(
    () => historyItems.filter((item) => selectedHistoryIds.has(item.id)),
    [historyItems, selectedHistoryIds]
  );

  const renderContent = () => {
    if (isVideoLocked) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <VideoLockBanner compact className="max-w-md w-full" />
        </div>
      );
    }

    if (!isGenerateTextMode && resolvedBottomTab === 'prompt') {
      return (
        <div className="absolute inset-0 p-4 overflow-y-auto font-mono text-sm leading-relaxed text-foreground-secondary group">
          {prompt}
          <button 
            className="absolute top-4 right-4 p-2 bg-surface-elevated border border-border rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-sunken"
            title={t('bottomPanel.copyPrompt')}
            onClick={() => navigator.clipboard.writeText(prompt)}
          >
            <Copy size={14} />
          </button>
        </div>
      );
    }

    if (resolvedBottomTab === 'timeline') {
      const duration = state.workflow.videoState?.duration || 10;
      
      return (
        <div className="absolute inset-0 flex flex-col">
          {/* Timeline Toolbar */}
          <div className="h-10 border-b border-border flex items-center px-4 gap-4 bg-surface-elevated">
            <div className="flex items-center gap-2 text-foreground-secondary">
               <button className="p-1 hover:text-foreground rounded hover:bg-surface-sunken transition-colors"><Play size={16} fill="currentColor" /></button>
               <button className="p-1 hover:text-foreground rounded hover:bg-surface-sunken transition-colors"><Pause size={16} /></button>
               <button className="p-1 hover:text-foreground rounded hover:bg-surface-sunken transition-colors"><SkipForward size={16} /></button>
            </div>
            <div className="h-4 w-px bg-border-strong" />
            <span className="text-xs font-mono text-foreground-muted">00:00:00 / 00:00:{duration.toString().padStart(2, '0')}</span>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
               <button className="p-1 text-foreground-muted hover:text-foreground"><ZoomOut size={14} /></button>
               <Slider className="w-24" value={50} min={0} max={100} onChange={()=>{}} />
               <button className="p-1 text-foreground-muted hover:text-foreground"><ZoomIn size={14} /></button>
            </div>
          </div>
          
          {/* Timeline Tracks */}
          <div className="flex-1 bg-[#1e1e1e] relative overflow-x-auto overflow-y-hidden custom-scrollbar">
             <div className="min-w-full h-full relative" style={{ width: '150%' }}>
                {/* Time Ruler */}
                <div className="h-6 border-b border-white/10 bg-[#252525] flex items-end text-[9px] text-white/50 font-mono select-none sticky top-0 z-10">
                   {[...Array(duration + 1)].map((_, i) => (
                      <div key={i} className="flex-1 border-l border-white/10 pl-1 pb-1 relative">
                         {i}s
                         <div className="absolute bottom-0 left-[50%] h-1 w-px bg-white/10" />
                      </div>
                   ))}
                </div>

                {/* Tracks Container */}
                <div className="p-2 space-y-1">
                   {/* Video Track */}
                   <div className="h-16 relative bg-[#2a2a2a] rounded border border-white/5 flex items-center">
                      <div className="absolute left-0 top-0 bottom-0 bg-blue-500/20 border-l-2 border-r-2 border-blue-500/50 w-full">
                         <div className="p-2 text-[10px] text-blue-200 font-medium truncate">{t('bottomPanel.timeline.mainSequence')}</div>
                         <div className="flex h-full w-full absolute top-0 left-0 opacity-20 gap-px">
                            {[...Array(10)].map((_, i) => <div key={i} className="flex-1 bg-white/10" />)}
                         </div>
                      </div>
                   </div>
                   
                   {/* Camera Track */}
                   <div className="h-8 relative bg-[#2a2a2a] rounded border border-white/5 flex items-center">
                      <div className="absolute left-0 w-full h-full flex items-center px-4">
                         <div className="w-full h-0.5 bg-white/10 relative">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-yellow-500 hover:scale-125 transition-transform cursor-pointer" title={t('bottomPanel.timeline.start')} />
                            <div className="absolute left-[30%] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-yellow-500/50 hover:bg-yellow-500 hover:scale-125 transition-all cursor-pointer" title={t('bottomPanel.timeline.keyframe')} />
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-yellow-500 hover:scale-125 transition-transform cursor-pointer" title={t('bottomPanel.timeline.end')} />
                         </div>
                      </div>
                   </div>
                   
                   {/* Audio Track */}
                   <div className="h-8 relative bg-[#2a2a2a] rounded border border-white/5">
                      {/* Fake waveform */}
                      <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-30 px-2">
                         {[...Array(100)].map((_, i) => (
                            <div key={i} className="w-1 bg-green-500 rounded-full" style={{ height: `${Math.random() * 80}%` }} />
                         ))}
                      </div>
                   </div>
                </div>

                {/* Playhead */}
                <div className="absolute top-0 bottom-0 left-[30%] w-px bg-red-500 z-20 pointer-events-none">
                   <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rotate-45 rounded-sm" />
                </div>
             </div>
          </div>
        </div>
      );
    }
    
    // ... (Keep existing handlers for legend, edit-stack, cleanup, history)
    if (resolvedBottomTab === 'history') {
        if (!isSelectableHistoryMode) {
          return (
            <div className="absolute inset-0 p-4 overflow-x-auto flex items-center gap-4 custom-scrollbar">
              {historyItems.length === 0 ? (
                 <div className="w-full h-full flex flex-col items-center justify-center text-foreground-muted gap-2">
                    <Clock size={24} className="opacity-20" />
                    <span className="text-xs">{t('bottomPanel.history.empty')}</span>
                  </div>
              ) : (
                 historyItems.map((item) => (
                   <button 
                      key={item.id}
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'SET_IMAGE', payload: item.thumbnail });
                        if (item.settings?.kind === 'source') {
                          dispatch({ type: 'SET_SOURCE_IMAGE', payload: item.thumbnail });
                        }
                        dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
                        dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
                      }}
                      className="min-w-[140px] aspect-video rounded-lg border border-border bg-surface-elevated flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-foreground transition-colors group relative overflow-hidden"
                   >
                      <div className="absolute inset-0 bg-surface-sunken">
                         <img src={item.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="text-[10px] font-medium truncate">{new Date(item.timestamp).toLocaleTimeString()}</div>
                         <div className="text-[8px] opacity-80 truncate">{item.mode}</div>
                      </div>
                   </button>
                 ))
              )}
            </div>
          );
        }

        return (
          <div className="absolute inset-0 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                {t('bottomPanel.tabs.history')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadHistoryItems(historyItems)}
                  disabled={historyItems.length === 0}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    historyItems.length === 0
                      ? "border-border text-foreground-muted/60 cursor-not-allowed"
                      : "border-border text-foreground-muted hover:text-foreground hover:bg-surface-sunken"
                  )}
                >
                  <Download size={12} />
                  Download All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (historySelectMode) {
                      setSelectedHistoryIds(new Set());
                    }
                    setHistorySelectMode((prev) => !prev);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    historySelectMode
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-foreground-muted hover:text-foreground hover:bg-surface-sunken"
                  )}
                >
                  <Check size={12} />
                  {historySelectMode ? 'Cancel' : 'Select'}
                </button>
                {historySelectMode && (
                  <button
                    type="button"
                    onClick={() => downloadHistoryItems(selectedHistoryItems)}
                    disabled={selectedHistoryItems.length === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
                      selectedHistoryItems.length === 0
                        ? "border-border text-foreground-muted/60 cursor-not-allowed"
                        : "border-accent text-white bg-accent hover:bg-accent/90"
                    )}
                  >
                    <Download size={12} />
                    Download Selected {selectedHistoryItems.length > 0 ? `(${selectedHistoryItems.length})` : ''}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-x-auto flex items-center gap-4 custom-scrollbar">
              {historyItems.length === 0 ? (
                 <div className="w-full h-full flex flex-col items-center justify-center text-foreground-muted gap-2">
                    <Clock size={24} className="opacity-20" />
                    <span className="text-xs">{t('bottomPanel.history.empty')}</span>
                  </div>
              ) : (
                 historyItems.map((item) => {
                   const isSelected = selectedHistoryIds.has(item.id);
                   return (
                     <button 
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (historySelectMode) {
                            toggleHistorySelection(item.id);
                            return;
                          }
                          dispatch({ type: 'SET_IMAGE', payload: item.thumbnail });
                          if (item.settings?.kind === 'source') {
                            dispatch({ type: 'SET_SOURCE_IMAGE', payload: item.thumbnail });
                          }
                          dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
                          dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
                        }}
                        className={cn(
                          "min-w-[140px] aspect-video rounded-lg border bg-surface-elevated flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group relative overflow-hidden",
                          isSelected ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-foreground"
                        )}
                     >
                        <div className="absolute inset-0 bg-surface-sunken">
                           <img src={item.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                           <div className="text-[10px] font-medium truncate">{new Date(item.timestamp).toLocaleTimeString()}</div>
                           <div className="text-[8px] opacity-80 truncate">{item.mode}</div>
                        </div>
                        {historySelectMode && (
                          <div className={cn(
                            "absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center border text-white",
                            isSelected ? "bg-accent border-accent" : "bg-black/40 border-white/30"
                          )}>
                            {isSelected ? <Check size={12} /> : null}
                          </div>
                        )}
                     </button>
                   );
                 })
              )}
            </div>
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
           {[
             ...(isGenerateTextMode ? [] : ['prompt']),
             'history',
             ...(showTimeline ? ['timeline'] : []),
             ...(showLegend ? ['legend'] : []),
             ...(showEditStack ? ['edit-stack'] : []),
             ...(showCleanup ? ['cleanup'] : [])
           ].map(tab => (
             <button 
               key={tab}
               onClick={() => dispatch({ type: 'SET_ACTIVE_BOTTOM_TAB', payload: tab })}
               className={cn(
                 "flex items-center gap-2 px-4 h-full border-r border-border-subtle text-xs font-medium uppercase tracking-wider transition-colors",
                 resolvedBottomTab === tab ? "bg-background-secondary text-foreground" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
               )}
             >
               {tab === 'prompt' && <Terminal size={14} />}
               {tab === 'history' && <History size={14} />}
               {tab === 'timeline' && <Clock size={14} />}
               {tab === 'legend' && <Layers size={14} />}
               {tab === 'edit-stack' && <List size={14} />}
               {tab === 'cleanup' && <Wand2 size={14} />}
               {t(`bottomPanel.tabs.${tab}`)}
             </button>
           ))}
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
