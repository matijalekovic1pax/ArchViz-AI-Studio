
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store';
import { UploadCloud, Columns, Minimize2, MoveHorizontal, Move, AlertCircle, Play, Pause, RefreshCw, Send, Paperclip, Image as ImageIcon, Plus, Bot, User, Trash2, Sparkles, X, ChevronDown, Download, Wand2, Maximize2, ZoomIn, Eraser, History } from 'lucide-react';
import { cn } from '../../lib/utils';
import { nanoid } from 'nanoid';

type CanvasPoint = { x: number; y: number };
type SelectionShape =
  | { id: string; type: 'rect'; start: CanvasPoint; end: CanvasPoint }
  | { id: string; type: 'brush'; points: CanvasPoint[]; brushSize: number }
  | { id: string; type: 'lasso'; points: CanvasPoint[] };

// --- Floating Prompt Bar Component ---

const PromptBar: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]); 
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const historyItems = state.history;

  const formatModeLabel = (mode: string) => mode.replace(/-/g, ' ');
  const truncatePrompt = (text: string, maxChars = 220) => {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars).trimEnd()}...`;
  };

  useEffect(() => {
    if (!isHistoryOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (historyContainerRef.current && !historyContainerRef.current.contains(target)) {
        setIsHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isHistoryOpen]);

  const handleGenerate = () => {
    if ((!inputText.trim() && attachments.length === 0) || state.isGenerating) return;

    const promptText = inputText;
    const promptAttachments = attachments.slice();
    dispatch({ type: 'SET_GENERATING', payload: true });

    setInputText('');
    setAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    setTimeout(() => {
        dispatch({ type: 'SET_GENERATING', payload: false });
        const mockImageUrl = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2400&q=80";
        dispatch({ type: 'SET_IMAGE', payload: mockImageUrl });
        dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
        dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
        
        dispatch({ 
            type: 'ADD_HISTORY', 
            payload: {
                id: nanoid(),
                timestamp: Date.now(),
                thumbnail: mockImageUrl,
                prompt: promptText,
                attachments: promptAttachments,
                mode: state.mode
            }
        });

    }, 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setAttachments(prev => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleHistorySelect = (prompt: string, historyAttachments?: string[]) => {
      setInputText(prompt);
      setAttachments(historyAttachments ?? []);
      setIsHistoryOpen(false);
      requestAnimationFrame(() => {
          if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
              textareaRef.current.focus();
          }
      });
  };

  return (
    <div className="w-full max-w-[770px] pointer-events-auto transform transition-all duration-300 hover:scale-[1.005]">
        <div className="relative flex items-center gap-3">
            <div className="relative shrink-0" ref={historyContainerRef}>
                <button
                    onClick={() => setIsHistoryOpen((prev) => !prev)}
                    className={cn(
                        "w-12 h-12 rounded-full bg-white/90 backdrop-blur-xl border border-white/70 shadow-xl flex items-center justify-center transition-all",
                        "hover:bg-white hover:shadow-2xl hover:scale-105 active:scale-95",
                        isHistoryOpen ? "ring-2 ring-accent/40" : "ring-1 ring-black/5"
                    )}
                    title="Prompt History"
                    aria-expanded={isHistoryOpen}
                >
                    <History size={18} className="text-foreground" />
                </button>

                {isHistoryOpen && (
                    <div className="absolute bottom-full left-0 mb-3 z-50">
                        <div className="w-[420px] max-w-[85vw] max-h-[60vh] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/70 ring-1 ring-black/5 overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle/60">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">Prompt History</div>
                                <button
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="p-1 rounded-full text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
                                    title="Close"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                                {historyItems.length === 0 ? (
                                    <div className="py-10 text-center text-foreground-muted">
                                        <div className="text-xs font-semibold uppercase tracking-wider">No prompts yet</div>
                                        <div className="text-[11px] mt-2">Your recent prompts will appear here.</div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {historyItems.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleHistorySelect(item.prompt, item.attachments)}
                                                className="w-full text-left rounded-xl border border-border bg-white/80 p-3 shadow-sm hover:shadow-md hover:border-foreground/20 transition-all"
                                            >
                                                <div className="flex items-center justify-between text-[10px] text-foreground-muted font-semibold uppercase tracking-wider">
                                                    <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span>{formatModeLabel(item.mode)}</span>
                                                </div>
                                                <div
                                                    className="mt-2 text-sm leading-relaxed text-foreground whitespace-pre-wrap"
                                                    title={item.prompt}
                                                >
                                                    {truncatePrompt(item.prompt)}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className={cn(
                "flex-1 bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 ring-0 flex flex-col overflow-hidden transition-shadow duration-300",
                (inputText || attachments.length > 0) ? "shadow-2xl bg-white" : "hover:bg-white/95"
            )}>
                {attachments.length > 0 && (
                    <div className="flex gap-3 px-4 pt-4 pb-1 overflow-x-auto custom-scrollbar">
                        {attachments.map((att, idx) => (
                            <div key={idx} className="relative group w-14 h-14 shrink-0 animate-scale-in">
                                <img src={att} className="w-full h-full object-cover rounded-xl border border-black/10 shadow-sm" />
                                <button 
                                    onClick={() => removeAttachment(idx)}
                                    className="absolute -top-1.5 -right-1.5 bg-white text-foreground border border-border rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-600 hover:scale-110 z-10"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-1 p-2 pl-3">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-full transition-all shrink-0 active:scale-95"
                        title="Add Reference Image"
                    >
                        <Plus size={20} strokeWidth={2.5} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
                    
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your architectural vision..."
                        className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-3.5 px-2 max-h-[140px] text-[15px] leading-relaxed custom-scrollbar placeholder:text-foreground-muted/60 font-medium text-foreground"
                        rows={1}
                    />
                    
                    <button 
                        onClick={handleGenerate}
                        disabled={(!inputText.trim() && attachments.length === 0) || state.isGenerating}
                        className={cn(
                        "p-3 rounded-full transition-all shrink-0 flex items-center justify-center relative overflow-hidden group",
                            (!inputText.trim() && attachments.length === 0) || state.isGenerating
                                ? "bg-transparent text-foreground-muted"
                                : "bg-foreground text-background shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                        )}
                    >
                        {state.isGenerating ? (
                            <RefreshCw size={20} className="animate-spin" />
                        ) : (
                            <div className="relative">
                                <Sparkles size={20} className={cn((inputText || attachments.length > 0) && "text-accent fill-accent animate-pulse-subtle")} />
                            </div>
                        )}
                    </button>
                </div>
            </div>
        </div>
        <div className="text-center mt-3 opacity-0 hover:opacity-100 transition-opacity duration-500">
            <span className="text-[10px] text-foreground-muted/50 font-medium tracking-wide">
                Press Enter to Generate
            </span>
        </div>
    </div>
  );
};

// --- Standard Image Canvas ---

const StandardCanvas: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSelection, setActiveSelection] = useState<SelectionShape | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionLayerRef = useRef<HTMLDivElement>(null);
  const activeSelectionRef = useRef<SelectionShape | null>(null);
  const lastPointRef = useRef<CanvasPoint | null>(null);

  // Mode helpers
  const isGenerateText = state.mode === 'generate-text';
  const isVideo = state.mode === 'video';
  const isVisualEdit = state.mode === 'visual-edit';
  const isSelectTool = isVisualEdit && state.workflow.activeTool === 'select';
  const selectionMode = state.workflow.visualSelection.mode;
  const showCompare = state.workflow.videoState?.compareMode || state.mode === 'upscale';
  const showSplit = state.workflow.canvasSync && !isVideo && !showCompare;

  // --- Handlers ---

  const updateActiveSelection = useCallback((
    next: SelectionShape | null | ((prev: SelectionShape | null) => SelectionShape | null)
  ) => {
    setActiveSelection((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      activeSelectionRef.current = resolved;
      return resolved;
    });
  }, []);

  const commitSelection = useCallback((shape: SelectionShape) => {
    const nextShape = { ...shape, id: nanoid() };
    const previousSelections = state.workflow.visualSelections;
    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        visualSelections: [...previousSelections, nextShape],
        visualSelectionUndoStack: [...state.workflow.visualSelectionUndoStack, previousSelections],
        visualSelectionRedoStack: [],
      },
    });
  }, [dispatch, state.workflow.visualSelectionUndoStack, state.workflow.visualSelections]);

  const buildSelectionMask = useCallback((shapes: SelectionShape[]) => {
    if (!selectionLayerRef.current) return null;
    const width = Math.round(selectionLayerRef.current.offsetWidth);
    const height = Math.round(selectionLayerRef.current.offsetHeight);
    if (width < 2 || height < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    shapes.forEach((shape) => {
      if (shape.type === 'rect') {
        const x = Math.min(shape.start.x, shape.end.x);
        const y = Math.min(shape.start.y, shape.end.y);
        const w = Math.abs(shape.end.x - shape.start.x);
        const h = Math.abs(shape.end.y - shape.start.y);
        if (w > 0 && h > 0) {
          ctx.fillRect(x, y, w, h);
        }
        return;
      }

      if (shape.type === 'lasso') {
        if (shape.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        shape.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.closePath();
        ctx.fill();
        return;
      }

      if (shape.points.length < 2) return;
      ctx.lineWidth = shape.brushSize || state.workflow.visualSelection.brushSize;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width,
      height,
    };
  }, [state.workflow.visualSelection.brushSize]);

  const buildSelectionComposite = useCallback(
    (shapes: SelectionShape[], imageSrc: string) => {
      if (!selectionLayerRef.current) return null;
      const width = Math.round(selectionLayerRef.current.offsetWidth);
      const height = Math.round(selectionLayerRef.current.offsetHeight);
      if (width < 2 || height < 2) return null;

      return new Promise<{ dataUrl: string; width: number; height: number } | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const outputWidth = img.naturalWidth || img.width;
          const outputHeight = img.naturalHeight || img.height;
          if (outputWidth < 2 || outputHeight < 2) {
            resolve(null);
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          const imageAspect = img.width / img.height;
          const canvasAspect = width / height;
          let drawWidth = width;
          let drawHeight = height;
          let offsetX = 0;
          let offsetY = 0;

          if (imageAspect > canvasAspect) {
            drawWidth = width;
            drawHeight = width / imageAspect;
            offsetY = (height - drawHeight) / 2;
          } else {
            drawHeight = height;
            drawWidth = height * imageAspect;
            offsetX = (width - drawWidth) / 2;
          }

          const scaleX = outputWidth / drawWidth;
          const scaleY = outputHeight / drawHeight;
          const scale = (scaleX + scaleY) / 2;

          ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, outputWidth, outputHeight);
          ctx.clip();

          ctx.fillStyle = 'rgba(56, 189, 248, 0.07)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';

          const mapPoint = (point: CanvasPoint) => ({
            x: (point.x - offsetX) * scaleX,
            y: (point.y - offsetY) * scaleY,
          });

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
            ctx.lineWidth = (shape.brushSize || state.workflow.visualSelection.brushSize) * scale;
            ctx.beginPath();
            const mapped = shape.points.map(mapPoint);
            ctx.moveTo(mapped[0].x, mapped[0].y);
            mapped.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
            ctx.stroke();
          });

          ctx.restore();

          resolve({ dataUrl: canvas.toDataURL('image/png'), width: outputWidth, height: outputHeight });
        };
        img.onerror = () => resolve(null);
        img.src = imageSrc;
      });
    },
    [state.workflow.visualSelection.brushSize]
  );

  const getSelectionPoint = useCallback((e: React.MouseEvent) => {
    if (!selectionLayerRef.current) return null;
    const rect = selectionLayerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / state.canvas.zoom,
      y: (e.clientY - rect.top) / state.canvas.zoom,
    };
  }, [state.canvas.zoom]);

  const startSelection = useCallback((e: React.MouseEvent) => {
    if (!state.uploadedImage || e.button !== 0) return;
    const point = getSelectionPoint(e);
    if (!point) return;
    const drawMode = selectionMode === 'ai' ? 'rect' : selectionMode;

    setIsSelecting(true);

    if (drawMode === 'rect') {
      updateActiveSelection({ id: 'active', type: 'rect', start: point, end: point });
      return;
    }

    const type = drawMode === 'lasso' ? 'lasso' : 'brush';
    lastPointRef.current = point;
    if (type === 'brush') {
      updateActiveSelection({
        id: 'active',
        type,
        points: [point],
        brushSize: state.workflow.visualSelection.brushSize,
      });
    } else {
      updateActiveSelection({ id: 'active', type, points: [point] });
    }
  }, [getSelectionPoint, selectionMode, state.uploadedImage, state.workflow.visualSelection.brushSize, updateActiveSelection]);

  const updateSelectionPath = useCallback((e: React.MouseEvent) => {
    const point = getSelectionPoint(e);
    if (!point) return;

    updateActiveSelection((prev) => {
      if (!prev) return prev;
      if (prev.type === 'rect') {
        return { ...prev, end: point };
      }
      const last = lastPointRef.current;
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 2) {
        return prev;
      }
      lastPointRef.current = point;
      return { ...prev, points: [...prev.points, point] };
    });
  }, [getSelectionPoint, updateActiveSelection]);

  const finishSelection = useCallback(() => {
    setIsSelecting(false);
    lastPointRef.current = null;
    const finalSelection = activeSelectionRef.current;
    if (finalSelection) {
      if (finalSelection.type === 'rect') {
        const width = Math.abs(finalSelection.end.x - finalSelection.start.x);
        const height = Math.abs(finalSelection.end.y - finalSelection.start.y);
        if (width > 2 && height > 2) {
          commitSelection(finalSelection);
        }
      } else if (finalSelection.points.length > 1) {
        if (finalSelection.type === 'brush' && !finalSelection.brushSize) {
          commitSelection({ ...finalSelection, brushSize: state.workflow.visualSelection.brushSize });
        } else {
          commitSelection(finalSelection);
        }
      }
    }
    updateActiveSelection(null);
  }, [commitSelection, state.workflow.visualSelection.brushSize, updateActiveSelection]);

  const handleFitToScreen = useCallback((e?: React.MouseEvent) => {
     if (e) {
        e.preventDefault();
        e.stopPropagation();
     }
     dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
     dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 }); 
  }, [dispatch]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isGenerateText) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        dispatch({ type: 'SET_IMAGE', payload: ev.target?.result as string });
        handleFitToScreen();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isGenerateText) return;
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
       const reader = new FileReader();
      reader.onload = (ev) => {
        dispatch({ type: 'SET_IMAGE', payload: ev.target?.result as string });
        handleFitToScreen();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.1, Math.min(8, state.canvas.zoom * (1 - delta * 0.1)));
    dispatch({ type: 'SET_CANVAS_ZOOM', payload: newZoom });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
       e.preventDefault();
       handleZoom(e.deltaY * 0.01);
    } else {
       handleZoom(e.deltaY * 0.005);
    }
  };

  const startPan = (e: React.MouseEvent) => {
    if (!state.uploadedImage) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - state.canvas.pan.x, y: e.clientY - state.canvas.pan.y });
  };

  const updatePan = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const newPan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
    dispatch({ type: 'SET_CANVAS_PAN', payload: newPan });
  };

  const endPan = () => {
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (isSelectTool) {
      startSelection(e);
      return;
    }
    startPan(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isSelectTool) {
      if (isSelecting) {
        updateSelectionPath(e);
      }
      return;
    }
    updatePan(e);
  };

  const handleCanvasMouseUp = () => {
    if (isSelectTool && isSelecting) {
      finishSelection();
    }
    endPan();
  };

  const handleCanvasMouseLeave = () => {
    if (isSelectTool && isSelecting) {
      finishSelection();
    }
    endPan();
  };

  useEffect(() => {
    if (!state.uploadedImage) {
      updateActiveSelection(null);
      if (state.workflow.visualSelections.length > 0) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          payload: {
            visualSelections: [],
            visualSelectionUndoStack: [],
            visualSelectionRedoStack: [],
            visualSelectionMask: null,
            visualSelectionMaskSize: null,
            visualSelectionComposite: null,
            visualSelectionCompositeSize: null,
          },
        });
      }
    }
  }, [dispatch, state.uploadedImage, state.workflow.visualSelections.length, updateActiveSelection]);

  useEffect(() => {
    if (state.mode !== 'visual-edit') return;
    if (!state.uploadedImage || state.workflow.visualSelections.length === 0) {
      if (
        state.workflow.visualSelectionMask ||
        state.workflow.visualSelectionMaskSize ||
        state.workflow.visualSelectionComposite ||
        state.workflow.visualSelectionCompositeSize
      ) {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          payload: {
            visualSelectionMask: null,
            visualSelectionMaskSize: null,
            visualSelectionComposite: null,
            visualSelectionCompositeSize: null,
          },
        });
      }
      return;
    }

    const mask = buildSelectionMask(state.workflow.visualSelections);
    if (!mask) return;
    if (
      state.workflow.visualSelectionMask === mask.dataUrl &&
      state.workflow.visualSelectionMaskSize?.width === mask.width &&
      state.workflow.visualSelectionMaskSize?.height === mask.height
    ) {
      return;
    }

    dispatch({
      type: 'UPDATE_WORKFLOW',
      payload: {
        visualSelectionMask: mask.dataUrl,
        visualSelectionMaskSize: { width: mask.width, height: mask.height },
      },
    });

    let canceled = false;
    buildSelectionComposite(state.workflow.visualSelections, state.uploadedImage).then((composite) => {
      if (canceled || !composite) return;
      if (
        state.workflow.visualSelectionComposite === composite.dataUrl &&
        state.workflow.visualSelectionCompositeSize?.width === composite.width &&
        state.workflow.visualSelectionCompositeSize?.height === composite.height
      ) {
        return;
      }

      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          visualSelectionComposite: composite.dataUrl,
          visualSelectionCompositeSize: { width: composite.width, height: composite.height },
        },
      });
    });

    return () => {
      canceled = true;
    };
  }, [
    buildSelectionMask,
    buildSelectionComposite,
    dispatch,
    state.mode,
    state.uploadedImage,
    state.workflow.visualSelectionMask,
    state.workflow.visualSelectionMaskSize,
    state.workflow.visualSelectionComposite,
    state.workflow.visualSelectionCompositeSize,
    state.workflow.visualSelections,
  ]);

  const transformStyle = {
     transform: `translate(${state.canvas.pan.x}px, ${state.canvas.pan.y}px) scale(${state.canvas.zoom})`,
     transition: isPanning ? 'none' : 'transform 0.1s cubic-bezier(0.2, 0, 0.2, 1)'
  };

  const selectionStroke = Math.max(1, 2 / state.canvas.zoom);
  const hideSelections =
    state.mode === 'visual-edit' &&
    state.workflow.activeTool === 'material' &&
    state.workflow.visualMaterial.surfaceType === 'auto';
  const selectionShapes = hideSelections
    ? []
    : [...state.workflow.visualSelections, ...(activeSelection ? [activeSelection] : [])];

  const renderSelectionShape = (shape: SelectionShape, isActive: boolean) => {
    const stroke = isActive ? 'rgba(56,189,248,0.45)' : 'rgba(56,189,248,0.25)';
    const dash = isActive ? '6 4' : undefined;

    if (shape.type === 'rect') {
      const x = Math.min(shape.start.x, shape.end.x);
      const y = Math.min(shape.start.y, shape.end.y);
      const width = Math.abs(shape.end.x - shape.start.x);
      const height = Math.abs(shape.end.y - shape.start.y);
      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          stroke={stroke}
          strokeWidth={selectionStroke}
          strokeDasharray={dash}
          fill="rgba(56,189,248,0.06)"
          rx={6}
        />
      );
    }

    const points = shape.points.map((point) => `${point.x},${point.y}`).join(' ');
    if (!points) return null;

    if (shape.type === 'brush') {
      const strokeWidth = Math.max(1, (shape.brushSize || state.workflow.visualSelection.brushSize) / state.canvas.zoom);
      return (
        <polyline
          points={points}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    }

    return (
      <polygon
        points={points}
        stroke={stroke}
        strokeWidth={selectionStroke}
        strokeDasharray={dash}
        strokeLinejoin="round"
        fill="rgba(56,189,248,0.06)"
      />
    );
  };

  if (isFullscreen && state.uploadedImage) {
      return (
          <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-fade-in">
              <div className="absolute top-4 right-4 z-50 flex gap-2">
                 <button 
                    onClick={() => setIsFullscreen(false)}
                    className="p-3 bg-surface-elevated/90 backdrop-blur rounded-full shadow-lg border border-border hover:bg-surface-sunken transition-all"
                    title="Close Fullscreen (Esc)"
                 >
                    <X size={20} className="text-foreground" />
                 </button>
              </div>
              <div className="flex-1 overflow-hidden p-8 flex items-center justify-center bg-black/5">
                  <img 
                      src={state.uploadedImage} 
                      className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl rounded-sm"
                      onClick={() => setIsFullscreen(false)}
                      title="Click to close"
                  />
              </div>
          </div>
      );
  }

  return (
    <div className="flex-1 bg-[#F5F5F3] relative overflow-hidden flex flex-col h-full w-full">
      <div 
         ref={containerRef}
         className={cn(
            "flex-1 relative overflow-hidden h-full w-full select-none",
            isSelectTool ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab"
         )}
         onWheel={handleWheel}
         onMouseDown={handleCanvasMouseDown}
         onMouseMove={handleCanvasMouseMove}
         onMouseUp={handleCanvasMouseUp}
         onMouseLeave={handleCanvasMouseLeave}
      >
         <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-0" 
            style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
         />

         {state.uploadedImage ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div 
                   className="w-full h-full flex items-center justify-center origin-center pointer-events-auto"
                   style={transformStyle}
                >
                   {showSplit ? (
                      <div className="inline-flex gap-1 bg-white border border-border p-2 shadow-2xl rounded-sm items-stretch w-[95%] h-[95%]">
                         <div className="relative bg-surface-sunken flex-1 overflow-hidden">
                            <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted bg-white px-2 py-1 rounded shadow-sm z-10">Original</span>
                            <img 
                               src={state.uploadedImage} 
                               className="w-full h-full object-contain block select-none" 
                               draggable={false}
                            />
                         </div>
                         <div className="w-px bg-border-strong" />
                         <div className="relative bg-surface-elevated flex-1 overflow-hidden">
                            <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider text-accent bg-white px-2 py-1 rounded shadow-sm border border-accent/20 z-10">Preview</span>
                            <img 
                               src={state.uploadedImage} 
                               className="w-full h-full object-contain block opacity-50 grayscale blur-sm select-none"
                               draggable={false}
                            />
                         </div>
                      </div>
                   ) : (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                         {isVideo ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                               <div className="relative border-2 border-black/10 rounded-xl overflow-hidden bg-black shadow-2xl w-full h-full">
                                   <img 
                                      src={state.uploadedImage} 
                                      alt="Video Frame" 
                                      className="w-full h-full object-contain block select-none opacity-80"
                                      draggable={false}
                                   />
                                   <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
                                        className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition-all text-white border border-white/30 shadow-xl hover:scale-110"
                                      >
                                        {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                                      </button>
                                   </div>
                               </div>
                            </div>
                         ) : (
                             <div className="relative w-full h-full flex items-center justify-center group/image">
                                 <img 
                                    src={state.uploadedImage} 
                                    alt="Workspace" 
                                    className="w-full h-full object-contain block select-none"
                                    draggable={false}
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       if (!isPanning && !isSelectTool) {
                                           setIsFullscreen(true);
                                       }
                                    }}
                                 />
                                 {isVisualEdit && state.uploadedImage && (
                                    <div ref={selectionLayerRef} className="absolute inset-0 pointer-events-none">
                                       <svg className="w-full h-full">
                                          {selectionShapes.map((shape, index) => (
                                            <g key={`${shape.id}-${index}`}>
                                              {renderSelectionShape(shape, shape.id === 'active')}
                                            </g>
                                          ))}
                                       </svg>
                                    </div>
                                 )}
                                 <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
                                    <div className="bg-black/30 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                                        <Maximize2 size={12} /> Click to Expand
                                    </div>
                                 </div>
                            </div>
                         )}
                      </div>
                   )}
                </div>
            </div>
         ) : (
            <div 
               className={cn(
                  "absolute inset-0 z-10 flex flex-col items-center justify-center transition-all duration-500 pointer-events-auto",
                  !isGenerateText && isDragging ? "scale-105 opacity-50" : "scale-100 opacity-100"
               )}
               onDragOver={isGenerateText ? undefined : (e) => { e.preventDefault(); setIsDragging(true); }}
               onDragLeave={isGenerateText ? undefined : () => setIsDragging(false)}
               onDrop={isGenerateText ? undefined : handleDrop}
            >
               {isGenerateText ? (
                   <div className="text-center space-y-4 max-w-md select-none opacity-40 animate-fade-in">
                       <div className="w-24 h-24 bg-surface-elevated rounded-[2rem] shadow-soft flex items-center justify-center mx-auto border border-border">
                           <Wand2 size={40} className="text-accent" />
                       </div>
                       <div>
                           <h3 className="text-xl font-medium text-foreground tracking-tight">Canvas Ready</h3>
                           <p className="text-sm text-foreground-muted mt-2 leading-relaxed max-w-xs mx-auto">
                               Enter your prompt below to generate. The result will appear here.
                           </p>
                       </div>
                   </div>
               ) : (
                   <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "w-[480px] h-[320px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-6 cursor-pointer bg-white/50 backdrop-blur-sm hover:bg-white hover:border-foreground/20 hover:shadow-xl transition-all group",
                            isDragging ? "border-accent bg-accent/5 scale-105" : "border-border-strong"
                        )}
                   >
                       <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                       <div className="w-20 h-20 rounded-full bg-surface-sunken flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                           <UploadCloud className="text-foreground-muted group-hover:text-foreground" size={36} />
                       </div>
                       <div className="text-center space-y-1.5">
                           <p className="font-semibold text-foreground text-lg">Upload Source Image</p>
                           <p className="text-xs text-foreground-muted">Drag & drop or click to browse</p>
                           <div className="flex gap-2 justify-center mt-2">
                               <span className="px-2 py-1 bg-surface-sunken rounded text-[10px] text-foreground-secondary font-mono">PNG</span>
                               <span className="px-2 py-1 bg-surface-sunken rounded text-[10px] text-foreground-secondary font-mono">JPG</span>
                               <span className="px-2 py-1 bg-surface-sunken rounded text-[10px] text-foreground-secondary font-mono">WEBP</span>
                           </div>
                       </div>
                   </div>
               )}
            </div>
         )}

         {state.isGenerating && (
             <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/30 backdrop-blur-sm animate-fade-in pointer-events-none">
                 <div className="bg-white/90 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-white/50">
                     <div className="relative w-16 h-16">
                         <div className="absolute inset-0 border-4 border-surface-sunken rounded-full"></div>
                         <div className="absolute inset-0 border-4 border-accent rounded-full border-t-transparent animate-spin"></div>
                         <Sparkles size={24} className="absolute inset-0 m-auto text-accent animate-pulse" />
                     </div>
                     <div className="text-center">
                         <h4 className="text-sm font-bold text-foreground">Generating...</h4>
                         <p className="text-xs text-foreground-muted mt-1">Refining geometry & lighting</p>
                     </div>
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

export const ImageCanvas: React.FC = () => {
  const { state } = useAppStore();
  
  if (state.mode === 'generate-text') {
      return (
        <div className="flex flex-col h-full bg-background w-full">
           <div className="flex-1 relative overflow-hidden min-h-0 flex flex-col">
               <StandardCanvas />
           </div>
           <div className="shrink-0 z-30 px-6 py-6 flex justify-center bg-background border-t border-border-subtle/50">
              <PromptBar />
           </div>
        </div>
      );
  }
  
  return <StandardCanvas />;
};
