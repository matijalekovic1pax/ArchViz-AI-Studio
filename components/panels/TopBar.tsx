
import React, { useEffect, useRef, useState } from 'react';
import { Undo, Redo, ZoomIn, ZoomOut, FolderOpen, RotateCcw, FileJson, Video, Download, Sparkles, Loader2, X, ChevronDown, CheckCircle2, FileDown, Image as ImageIcon, Maximize2, Minimize2, Film, MonitorPlay, Trash2, AlertTriangle, Columns } from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { Toggle } from '../ui/Toggle';
import { Slider } from '../ui/Slider';
import { generatePrompt } from '../../engine/promptEngine';
import { nanoid } from 'nanoid';
import { VisualSelectionShape } from '../../types';

const drawSelectionOverlay = (
  ctx: CanvasRenderingContext2D,
  shapes: VisualSelectionShape[],
  selectionCanvasSize: { width: number; height: number } | null,
  outputWidth: number,
  outputHeight: number,
  brushFallback: number
) => {
  if (!selectionCanvasSize || shapes.length === 0) return;

  const canvasWidth = selectionCanvasSize.width;
  const canvasHeight = selectionCanvasSize.height;
  if (canvasWidth < 2 || canvasHeight < 2 || outputWidth < 2 || outputHeight < 2) return;

  const imageAspect = outputWidth / outputHeight;
  const canvasAspect = canvasWidth / canvasHeight;
  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imageAspect > canvasAspect) {
    drawHeight = canvasWidth / imageAspect;
    offsetY = (canvasHeight - drawHeight) / 2;
  } else {
    drawWidth = canvasHeight * imageAspect;
    offsetX = (canvasWidth - drawWidth) / 2;
  }

  const scaleX = outputWidth / drawWidth;
  const scaleY = outputHeight / drawHeight;
  const scale = (scaleX + scaleY) / 2;

  const mapPoint = (point: { x: number; y: number }) => ({
    x: (point.x - offsetX) * scaleX,
    y: (point.y - offsetY) * scaleY,
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outputWidth, outputHeight);
  ctx.clip();

  ctx.fillStyle = 'rgba(56, 189, 248, 0.07)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  shapes.forEach((shape) => {
    if (shape.type === 'rect') {
      const x = Math.min(shape.start.x, shape.end.x);
      const y = Math.min(shape.start.y, shape.end.y);
      const w = Math.abs(shape.end.x - shape.start.x);
      const h = Math.abs(shape.end.y - shape.start.y);
      if (w > 0 && h > 0) {
        const start = mapPoint({ x, y });
        const end = mapPoint({ x: x + w, y: y + h });
        ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.lineWidth = Math.max(1, 2);
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      }
      return;
    }

    if (shape.type === 'lasso') {
      if (shape.points.length < 2) return;
      ctx.beginPath();
      const mapped = shape.points.map(mapPoint);
      ctx.moveTo(mapped[0].x, mapped[0].y);
      mapped.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(1, 2);
      ctx.stroke();
      return;
    }

    if (shape.points.length < 2) return;
    ctx.lineWidth = (shape.brushSize || brushFallback) * scale;
    ctx.beginPath();
    const mapped = shape.points.map(mapPoint);
    ctx.moveTo(mapped[0].x, mapped[0].y);
    mapped.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  });

  ctx.restore();
};

export const TopBar: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showSaveInfo, setShowSaveInfo] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const latestStateRef = useRef(state);

  const selectionUndoStack = state.workflow.visualSelectionUndoStack;
  const selectionRedoStack = state.workflow.visualSelectionRedoStack;
  const canUndoSelection = state.mode === 'visual-edit' && selectionUndoStack.length > 0;
  const canRedoSelection = state.mode === 'visual-edit' && selectionRedoStack.length > 0;

  const handleUndoSelection = () => {
    if (!canUndoSelection) return;
    const previous = selectionUndoStack[selectionUndoStack.length - 1];
    const nextUndo = selectionUndoStack.slice(0, -1);
    const nextRedo = [...selectionRedoStack, state.workflow.visualSelections];
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        visualSelections: previous,
        visualSelectionUndoStack: nextUndo,
        visualSelectionRedoStack: nextRedo,
      },
    });
  };

  const handleRedoSelection = () => {
    if (!canRedoSelection) return;
    const next = selectionRedoStack[selectionRedoStack.length - 1];
    const nextRedo = selectionRedoStack.slice(0, -1);
    const nextUndo = [...selectionUndoStack, state.workflow.visualSelections];
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        visualSelections: next,
        visualSelectionUndoStack: nextUndo,
        visualSelectionRedoStack: nextRedo,
      },
    });
  };
  
  // Download options state
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg' | 'mp4'>('png');
  const [downloadResolution, setDownloadResolution] = useState<'full' | 'medium'>('full');
  
  const isVideoMode = state.mode === 'video';
  const isDisabled = !state.uploadedImage && state.mode !== 'material-validation'; // Material validation doesn't need an image

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  // --- Handlers ---

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.1, Math.min(8, state.canvas.zoom + delta));
    dispatch({ type: 'SET_CANVAS_ZOOM', payload: newZoom });
  };

  const handleFitToScreen = () => {
    dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
    dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
  };

  const handleToggleSplit = () => {
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { canvasSync: !state.workflow.canvasSync } });
  };

  const handleClearImage = () => {
      if (!state.uploadedImage) return;
      setShowClearConfirm(true);
  };

  const handleGenerate = () => {
    if ((!state.uploadedImage && state.mode !== 'material-validation') || state.isGenerating) return;
    
    dispatch({ type: 'SET_GENERATING', payload: true });
    
    // Simulate generation
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      dispatch({ type: 'SET_PROGRESS', payload: progress });
      if (progress >= 100) {
        clearInterval(interval);
        dispatch({ type: 'SET_GENERATING', payload: false });
        dispatch({ type: 'SET_PROGRESS', payload: 0 });
        const latestState = latestStateRef.current;
        if (latestState.uploadedImage) {
          dispatch({ 
            type: 'ADD_HISTORY', 
            payload: {
              id: nanoid(),
              timestamp: Date.now(),
              thumbnail: latestState.uploadedImage,
              prompt: generatePrompt(latestState),
              attachments: [],
              mode: latestState.mode
            }
          });
        }
      }
    }, 50);
  };

  const handleExportProject = () => {
    setShowSaveInfo(true);
  };

  const confirmExportProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `archviz-project-${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setShowSaveInfo(false);
  };

  const handleDownloadClick = () => {
    if (!state.uploadedImage) return;
    setShowDownloadMenu(!showDownloadMenu);
  };

  const performDownload = () => {
    if (!state.uploadedImage) return;
    
    // Determine extension and filename parts based on mode
    let ext = downloadFormat;
    let resSuffix = downloadResolution === 'medium' ? '-med' : '-full';
    
    // Enforce logic if modes switched but state lingered
    if (isVideoMode) {
      ext = 'mp4';
      resSuffix = downloadResolution === 'medium' ? '-1080p' : '-4k';
    } else {
      if (ext === 'mp4') ext = 'png'; // Fallback if stuck
    }

    const prefix = isVideoMode ? 'archviz-video' : 'archviz-render';
    const filename = `${prefix}-${Date.now()}${resSuffix}.${ext}`;

    const selectionShapes = state.workflow.visualSelections;
    const selectionCanvasSize = state.workflow.visualSelectionMaskSize;
    const shouldBakeSelections = state.mode === 'visual-edit' && selectionShapes.length > 0;
    const useCompositeSource = shouldBakeSelections && !!state.workflow.visualSelectionComposite;

    const downloadSource = useCompositeSource
      ? state.workflow.visualSelectionComposite!
      : state.uploadedImage;

    // For video mode, we download the source URL directly
    if (isVideoMode) {
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadSource;
        downloadLink.download = filename;
        downloadLink.target = "_blank";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setShowDownloadMenu(false);
        return;
    }

    // Process Image for Resolution/Format
    const img = new Image();
    // Enable CORS to allow canvas export of external images (e.g. Unsplash)
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (downloadResolution === 'medium') {
                width *= 0.5;
                height *= 0.5;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                if (shouldBakeSelections && !useCompositeSource) {
                    drawSelectionOverlay(
                        ctx,
                        selectionShapes,
                        selectionCanvasSize,
                        width,
                        height,
                        state.workflow.visualSelection.brushSize
                    );
                }
                
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                const quality = ext === 'jpg' ? 0.85 : undefined;
                const dataUrl = canvas.toDataURL(mimeType, quality);

                const downloadLink = document.createElement('a');
                downloadLink.href = dataUrl;
                downloadLink.download = filename;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                setShowDownloadMenu(false);
            }
        } catch (e) {
            console.error("Canvas export failed (likely CORS restrictions), falling back to blob fetch.", e);
            
            // Fallback: Fetch as blob to bypass canvas tainting for simple downloads
            fetch(downloadSource)
                .then(response => response.blob())
                .then(blob => {
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                    setShowDownloadMenu(false);
                })
                .catch(fetchErr => {
                    console.error("Fallback fetch failed", fetchErr);
                    // Ultimate fallback: open in new tab
                    window.open(downloadSource, '_blank');
                    setShowDownloadMenu(false);
                });
        }
    };

    img.onerror = () => {
         console.error("Image failed to load for download processing.");
         // Fallback if image object fails
         window.open(downloadSource, '_blank');
         setShowDownloadMenu(false);
    };

    // Set src after handlers
    img.src = downloadSource;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        dispatch({ type: 'LOAD_PROJECT', payload: json });
      } catch (err) {
        alert('Failed to load project file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    if (confirm("Reset project? All unsaved data will be lost.")) {
      dispatch({ type: 'RESET_PROJECT' });
    }
  };

  const getGenerateLabel = () => {
    switch (state.mode) {
      case 'masterplan': return 'Generate Masterplan';
      case 'exploded': return 'Generate Exploded View';
      case 'section': return 'Generate Section';
      case 'upscale': return 'Upscale Image';
      case 'img-to-cad': return 'Convert to CAD';
      case 'img-to-3d': return 'Generate 3D Model';
      case 'video': return 'Generate Video';
      case 'visual-edit': return 'Apply Edits';
      case 'material-validation': return 'Run Validation';
      case 'render-sketch': return 'Render Sketch';
      default: return 'Generate Render';
    }
  };

  return (
    <>
    <header className="h-16 bg-surface-elevated border-b border-border flex items-center justify-between px-6 shrink-0 z-40 shadow-sm relative">
      {/* Left: Branding & Utility */}
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div className="flex items-center gap-2 select-none shrink-0">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-md shrink-0">
            <span className="text-surface-elevated font-bold text-sm">AV</span>
          </div>
          <div className="flex flex-col shrink-0">
            <h1 className="font-bold text-sm leading-tight whitespace-nowrap">ArchViz Studio</h1>
            <p className="text-[10px] text-foreground-muted whitespace-nowrap">Stateless Session</p>
          </div>
        </div>

        <div className="h-6 w-px bg-border-strong shrink-0" />

          <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-lg border border-border-subtle shrink-0">
            <button
              onClick={handleUndoSelection}
              disabled={!canUndoSelection}
              className={cn(
                "p-1.5 text-foreground-secondary rounded-md transition-all",
                canUndoSelection
                  ? "hover:text-foreground hover:bg-surface-elevated"
                  : "opacity-40 cursor-not-allowed"
              )}
              title="Undo"
            >
              <Undo size={14} />
            </button>
            <button
              onClick={handleRedoSelection}
              disabled={!canRedoSelection}
              className={cn(
                "p-1.5 text-foreground-secondary rounded-md transition-all",
                canRedoSelection
                  ? "hover:text-foreground hover:bg-surface-elevated"
                  : "opacity-40 cursor-not-allowed"
              )}
              title="Redo"
            >
              <Redo size={14} />
            </button>
          
          <div className="w-px h-3 bg-border mx-1" />

          {/* Clear Image Button */}
          <button 
             onClick={handleClearImage}
             disabled={!state.uploadedImage}
             className={cn(
               "p-1.5 rounded-md transition-all",
               !state.uploadedImage 
                 ? "text-foreground-muted/30 cursor-not-allowed" 
                 : "text-foreground-secondary hover:text-red-600 hover:bg-surface-elevated"
             )}
             title="Clear Image"
          >
             <Trash2 size={14} />
          </button>

          <div className="w-px h-3 bg-border mx-1" />

          {/* Canvas Controls: Fit & Split */}
          <button 
            onClick={handleFitToScreen}
            disabled={!state.uploadedImage}
            className={cn(
               "p-1.5 rounded-md transition-all",
               !state.uploadedImage
                  ? "text-foreground-muted/30 cursor-not-allowed"
                  : "text-foreground-secondary hover:text-foreground hover:bg-surface-elevated"
            )}
            title="Fit to Screen"
          >
            <Minimize2 size={14} />
          </button>

          {!isVideoMode && (
            <button
               onClick={handleToggleSplit}
               disabled={!state.uploadedImage}
               className={cn(
                  "p-1.5 rounded-md transition-all",
                  !state.uploadedImage
                     ? "text-foreground-muted/30 cursor-not-allowed"
                     : state.workflow.canvasSync
                        ? "text-foreground bg-surface-elevated shadow-sm"
                        : "text-foreground-secondary hover:text-foreground hover:bg-surface-elevated"
               )}
               title="Toggle Split View"
            >
               <Columns size={14} />
            </button>
          )}

          <div className="w-px h-3 bg-border mx-1" />

          <button 
            className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-md transition-all"
            onClick={() => handleZoom(-0.25)}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-mono w-10 text-center text-foreground-muted select-none">
             {Math.round(state.canvas.zoom * 100)}%
          </span>
          <button 
            className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-md transition-all"
            onClick={() => handleZoom(0.25)}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* Center: Generate Button (Hidden in generate-text mode) */}
      <div className="flex items-center justify-center shrink-0 mx-4">
        {state.mode !== 'generate-text' && (
          <button
            aria-label="generate-trigger"
            onClick={handleGenerate}
            disabled={isDisabled || state.isGenerating}
            className={cn(
              "relative group flex items-center gap-3 px-8 py-2.5 rounded-full transition-all duration-300 border border-transparent overflow-hidden",
              isDisabled 
                ? "bg-surface-sunken text-foreground-muted cursor-not-allowed" 
                : "bg-foreground text-background shadow-lg hover:scale-105 active:scale-95 hover:shadow-xl hover:border-accent/50"
            )}
          >
            {/* Animated Background Gradient for Active State */}
            {!isDisabled && !state.isGenerating && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
            )}

            {state.isGenerating ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <div className="flex flex-col items-start leading-none">
                  <span className="font-bold text-xs">Generating</span>
                  <span className="text-[9px] opacity-80 font-mono">{state.progress}%</span>
                </div>
              </>
            ) : (
              <>
                <Sparkles size={18} className={cn(!isDisabled && "group-hover:text-accent transition-colors")} />
                <span className="font-bold text-sm tracking-wide">{getGenerateLabel()}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center justify-end gap-3 flex-1 min-w-0 relative">
        {/* Subtle Project Management Tools */}
        <div className="flex items-center gap-1 mr-2 shrink-0">
            <button 
              onClick={handleReset}
              className="p-2 text-foreground-muted hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Reset Project"
            >
              <RotateCcw size={16} />
            </button>
            
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept="application/json" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-full transition-colors"
              title="Load Project"
            >
              <FolderOpen size={16} />
            </button>

            {/* Save Project Button */}
            <button 
              onClick={handleExportProject}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-full transition-colors"
              title="Save Project State (JSON)"
            >
              <FileJson size={14} />
              <span className="hidden lg:inline">Save Project</span>
            </button>
        </div>

        {/* Download Button Group */}
        <div className="relative shrink-0">
          <button 
            onClick={handleDownloadClick}
            disabled={!state.uploadedImage}
            className={cn(
              "h-9 px-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-xs font-bold border",
              state.uploadedImage 
                ? "bg-surface-elevated text-foreground border-border hover:bg-surface-sunken hover:border-foreground-muted shadow-sm" 
                : "bg-surface-sunken text-foreground-muted border-transparent cursor-not-allowed"
            )}
            title={!state.uploadedImage ? "Generate output first" : "Download options"}
          >
            {isVideoMode ? <Video size={14} /> : <Download size={14} />}
            <span className="hidden sm:inline">Download</span>
            {state.uploadedImage && <ChevronDown size={12} className={cn("transition-transform", showDownloadMenu && "rotate-180")} />}
          </button>

          {/* Download Pop-up Menu */}
          {showDownloadMenu && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-surface-elevated rounded-xl shadow-elevated border border-border p-4 z-50 animate-fade-in origin-top-right">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-subtle">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Download Settings</span>
                <button onClick={() => setShowDownloadMenu(false)} className="text-foreground-muted hover:text-foreground"><X size={14}/></button>
              </div>
              
              <div className="space-y-4">
                 {isVideoMode ? (
                   /* VIDEO SPECIFIC OPTIONS */
                   <>
                      <div className="space-y-2">
                        <label className="text-xs text-foreground-secondary font-medium">Video Resolution</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => setDownloadResolution('full')} 
                              className={cn(
                                "flex flex-col items-center justify-center p-2 border rounded transition-all",
                                downloadResolution === 'full' 
                                  ? "bg-foreground text-background border-foreground shadow-sm" 
                                  : "bg-surface-sunken border-transparent hover:border-border text-foreground-secondary"
                              )}
                            >
                              <span className="flex items-center gap-1">
                                  <Film size={10} />
                                  <span className="text-xs font-bold">4K UHD</span>
                              </span>
                              <span className={cn("text-[9px]", downloadResolution === 'full' ? "text-white/70" : "text-foreground-muted")}>2160p</span>
                            </button>
                            <button 
                              onClick={() => setDownloadResolution('medium')} 
                              className={cn(
                                "flex flex-col items-center justify-center p-2 border rounded transition-all",
                                downloadResolution === 'medium' 
                                  ? "bg-foreground text-background border-foreground shadow-sm" 
                                  : "bg-surface-sunken border-transparent hover:border-border text-foreground-secondary"
                              )}
                            >
                              <span className="flex items-center gap-1">
                                  <MonitorPlay size={10} />
                                  <span className="text-xs font-bold">HD</span>
                              </span>
                              <span className={cn("text-[9px]", downloadResolution === 'medium' ? "text-white/70" : "text-foreground-muted")}>1080p</span>
                            </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                         <label className="text-xs text-foreground-secondary font-medium">Format</label>
                         <div className="grid grid-cols-1 gap-2">
                            <div className="p-2 border border-foreground bg-surface-sunken rounded text-center opacity-70 cursor-not-allowed">
                               <span className="text-xs font-bold">MP4</span>
                               <span className="block text-[9px] text-foreground-muted">Universal Video Format</span>
                            </div>
                         </div>
                      </div>
                   </>
                 ) : (
                   /* IMAGE SPECIFIC OPTIONS */
                   <>
                    <div className="space-y-2">
                        <label className="text-xs text-foreground-secondary font-medium">Format</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                              onClick={() => setDownloadFormat('png')} 
                              className={cn(
                                "flex flex-col items-center justify-center p-2 border rounded transition-all",
                                downloadFormat === 'png' 
                                  ? "bg-foreground text-background border-foreground shadow-sm" 
                                  : "bg-surface-sunken border-transparent hover:border-border text-foreground-secondary"
                              )}
                          >
                              <span className="text-xs font-bold">PNG</span>
                              <span className={cn("text-[9px]", downloadFormat === 'png' ? "text-white/70" : "text-foreground-muted")}>Lossless</span>
                          </button>
                          <button 
                              onClick={() => setDownloadFormat('jpg')} 
                              className={cn(
                                "flex flex-col items-center justify-center p-2 border rounded transition-all",
                                downloadFormat === 'jpg' 
                                  ? "bg-foreground text-background border-foreground shadow-sm" 
                                  : "bg-surface-sunken border-transparent hover:border-border text-foreground-secondary"
                              )}
                          >
                              <span className="text-xs font-bold">JPG</span>
                              <span className={cn("text-[9px]", downloadFormat === 'jpg' ? "text-white/70" : "text-foreground-muted")}>Compact</span>
                          </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-foreground-secondary font-medium">Resolution</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                              onClick={() => setDownloadResolution('full')} 
                              className={cn(
                                "flex flex-col items-center justify-center p-2 border rounded transition-all",
                                downloadResolution === 'full' 
                                  ? "bg-foreground text-background border-foreground shadow-sm" 
                                  : "bg-surface-sunken border-transparent hover:border-border text-foreground-secondary"
                              )}
                          >
                              <span className="flex items-center gap-1">
                                <Maximize2 size={10} />
                                <span className="text-xs font-bold">Full Res</span>
                              </span>
                              <span className={cn("text-[9px]", downloadResolution === 'full' ? "text-white/70" : "text-foreground-muted")}>Original Size</span>
                          </button>
                          <button 
                              onClick={() => setDownloadResolution('medium')} 
                              className={cn(
                                "flex flex-col items-center justify-center p-2 border rounded transition-all",
                                downloadResolution === 'medium' 
                                  ? "bg-foreground text-background border-foreground shadow-sm" 
                                  : "bg-surface-sunken border-transparent hover:border-border text-foreground-secondary"
                              )}
                          >
                              <span className="flex items-center gap-1">
                                <Minimize2 size={10} />
                                <span className="text-xs font-bold">Medium</span>
                              </span>
                              <span className={cn("text-[9px]", downloadResolution === 'medium' ? "text-white/70" : "text-foreground-muted")}>50% Scale</span>
                          </button>
                        </div>
                    </div>
                   </>
                 )}

                 <div className="h-px bg-border-subtle my-2" />

                 <button 
                  onClick={performDownload}
                  className="w-full py-2.5 bg-foreground text-background rounded-lg text-xs font-bold hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
                 >
                    <FileDown size={14} />
                    Download Now
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Clear Image Confirmation Modal */}
    {showClearConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
         <div className="w-[400px] bg-background rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in">
            <div className="p-6">
               <div className="flex items-center gap-3 mb-4">
                   <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                      <AlertTriangle size={20} />
                   </div>
                   <h3 className="text-lg font-bold text-foreground">Clear Canvas?</h3>
               </div>
               <p className="text-sm text-foreground-secondary leading-relaxed mb-6">
                  Are you sure you want to clear the current image? This action cannot be undone and will remove your current workspace content.
               </p>
               <div className="flex gap-3">
                  <button 
                     onClick={() => setShowClearConfirm(false)}
                     className="flex-1 py-2.5 text-xs font-bold text-foreground border border-border rounded-lg hover:bg-surface-sunken transition-colors"
                  >
                     Cancel
                  </button>
                  <button 
                     onClick={() => {
                        dispatch({ type: 'SET_IMAGE', payload: null });
                        setShowClearConfirm(false);
                     }}
                     className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                  >
                     Clear Image
                  </button>
               </div>
            </div>
         </div>
      </div>
    )}

    {/* Save Project Modal Overlay */}
    {showSaveInfo && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
         <div className="w-[450px] bg-background rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in">
            <div className="p-6">
               <div className="w-12 h-12 bg-surface-sunken rounded-full flex items-center justify-center mb-4 text-accent">
                  <FileJson size={24} />
               </div>
               <h3 className="text-lg font-bold mb-2">Save Project Workspace</h3>
               <p className="text-sm text-foreground-secondary leading-relaxed mb-4">
                  This action will export your current session to a <code className="bg-surface-sunken px-1 rounded border border-border text-foreground">.json</code> file.
               </p>
               <ul className="space-y-3 mb-6">
                  <li className="flex gap-3 text-xs text-foreground-muted">
                     <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                     <span>Includes all generation history and images</span>
                  </li>
                  <li className="flex gap-3 text-xs text-foreground-muted">
                     <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                     <span>Preserves current prompt, parameters, and style settings</span>
                  </li>
                  <li className="flex gap-3 text-xs text-foreground-muted">
                     <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                     <span>Can be restored using the "Load Project" button</span>
                  </li>
               </ul>
               <div className="bg-surface-sunken p-3 rounded-lg border border-border-subtle mb-6">
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold mb-1">Privacy Notice</p>
                  <p className="text-[11px] text-foreground-secondary">
                     No data is stored on our servers. This file is saved locally to your device.
                  </p>
               </div>
               <div className="flex gap-3">
                  <button 
                     onClick={() => setShowSaveInfo(false)}
                     className="flex-1 py-2.5 text-xs font-bold text-foreground border border-border rounded-lg hover:bg-surface-sunken transition-colors"
                  >
                     Cancel
                  </button>
                  <button 
                     onClick={confirmExportProject}
                     className="flex-1 py-2.5 text-xs font-bold text-white bg-foreground rounded-lg hover:bg-foreground/90 transition-colors shadow-sm"
                  >
                     Save Project
                  </button>
               </div>
            </div>
         </div>
      </div>
    )}
    </>
  );
};
