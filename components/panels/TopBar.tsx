
import React, { useRef, useState, useEffect } from 'react';
import { Undo, Redo, ZoomIn, ZoomOut, FolderOpen, RotateCcw, FileJson, Video, Download, Sparkles, Loader2, X, ChevronDown, CheckCircle2, FileDown, Image as ImageIcon, Maximize2, Minimize2, Film, MonitorPlay, Trash2, AlertTriangle, Columns, SlidersHorizontal, Languages, Layers, MoreVertical, LogOut } from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { Toggle } from '../ui/Toggle';
import { Slider } from '../ui/Slider';
import { VisualSelectionShape } from '../../types';
import { useGeneration } from '../../hooks/useGeneration';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthGate';
import { MobilePanelType } from './mobile/MobilePanels';

const drawSelectionOverlay = (
  ctx: CanvasRenderingContext2D,
  shapes: VisualSelectionShape[],
  selectionCanvasSize: { width: number; height: number } | null,
  outputWidth: number,
  outputHeight: number,
  brushFallback: number,
  viewScale: number | null,
  zoom: number
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
  const baseViewScale = viewScale && viewScale > 0 ? viewScale : 1;
  const displayScale = Math.max(0.0001, baseViewScale * zoom);
  const selectionStrokeScreen = Math.max(1.5, 2.4 / zoom);
  const brushOutlineScreen = Math.max(1.5, 2.6 / zoom);
  const selectionStrokeImage = selectionStrokeScreen / displayScale;
  const brushOutlineImage = brushOutlineScreen / displayScale;
  const selectionStrokeWidth = selectionStrokeImage * scale;
  const brushOutlineWidth = brushOutlineImage * scale;

  const mapPoint = (point: { x: number; y: number }) => ({
    x: (point.x - offsetX) * scaleX,
    y: (point.y - offsetY) * scaleY,
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outputWidth, outputHeight);
  ctx.clip();

  const selectionFill = 'rgba(56, 189, 248, 0.28)';
  const selectionStroke = 'rgba(56, 189, 248, 0.9)';
  const brushFill = 'rgba(56, 189, 248, 0.28)';
  const brushOutline = 'rgba(56, 189, 248, 0.9)';
  const brushShapes = shapes.filter((shape) => shape.type === 'brush');
  const otherShapes = shapes.filter((shape) => shape.type !== 'brush');

  ctx.fillStyle = selectionFill;
  ctx.strokeStyle = selectionStroke;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  otherShapes.forEach((shape) => {
    if (shape.type === 'rect') {
      const x = Math.min(shape.start.x, shape.end.x);
      const y = Math.min(shape.start.y, shape.end.y);
      const w = Math.abs(shape.end.x - shape.start.x);
      const h = Math.abs(shape.end.y - shape.start.y);
      if (w > 0 && h > 0) {
        const start = mapPoint({ x, y });
        const end = mapPoint({ x: x + w, y: y + h });
        ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.lineWidth = selectionStrokeWidth;
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
      ctx.lineWidth = selectionStrokeWidth;
      ctx.stroke();
    }
  });

  if (brushShapes.length > 0) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = outputWidth;
    maskCanvas.height = outputHeight;
    const maskCtx = maskCanvas.getContext('2d');

    if (maskCtx) {
      maskCtx.strokeStyle = '#fff';
      maskCtx.lineJoin = 'round';
      maskCtx.lineCap = 'round';
      brushShapes.forEach((shape) => {
        if (shape.type !== 'brush' || shape.points.length < 2) return;
        const brushSize = (shape.brushSize || brushFallback) * scale;
        maskCtx.lineWidth = brushSize;
        maskCtx.beginPath();
        const mapped = shape.points.map(mapPoint);
        maskCtx.moveTo(mapped[0].x, mapped[0].y);
        mapped.slice(1).forEach((point) => maskCtx.lineTo(point.x, point.y));
        maskCtx.stroke();
      });
    }

    const fillCanvas = document.createElement('canvas');
    fillCanvas.width = outputWidth;
    fillCanvas.height = outputHeight;
    const fillCtx = fillCanvas.getContext('2d');
    if (fillCtx) {
      fillCtx.drawImage(maskCanvas, 0, 0);
      fillCtx.globalCompositeOperation = 'source-in';
      fillCtx.fillStyle = brushFill;
      fillCtx.fillRect(0, 0, outputWidth, outputHeight);
      ctx.drawImage(fillCanvas, 0, 0);
    }

    const outlineCanvas = document.createElement('canvas');
    outlineCanvas.width = outputWidth;
    outlineCanvas.height = outputHeight;
    const outlineCtx = outlineCanvas.getContext('2d');
    if (outlineCtx) {
      const outlineWidth = brushOutlineWidth;

      outlineCtx.drawImage(maskCanvas, 0, 0);
      outlineCtx.globalCompositeOperation = 'source-out';
      outlineCtx.strokeStyle = brushOutline;
      outlineCtx.lineJoin = 'round';
      outlineCtx.lineCap = 'round';

      brushShapes.forEach((shape) => {
        if (shape.type !== 'brush' || shape.points.length < 2) return;
        const brushSize = (shape.brushSize || brushFallback) * scale;
        outlineCtx.lineWidth = brushSize + outlineWidth * 2;
        outlineCtx.beginPath();
        const mapped = shape.points.map(mapPoint);
        outlineCtx.moveTo(mapped[0].x, mapped[0].y);
        mapped.slice(1).forEach((point) => outlineCtx.lineTo(point.x, point.y));
        outlineCtx.stroke();
      });

      outlineCtx.globalCompositeOperation = 'destination-out';
      outlineCtx.drawImage(maskCanvas, 0, 0);
      ctx.drawImage(outlineCanvas, 0, 0);
    }
  }

  ctx.restore();
};

export const TopBar: React.FC<{ onToggleMobilePanel?: (panel: MobilePanelType) => void }> = ({ onToggleMobilePanel }) => {
  const { state, dispatch } = useAppStore();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsMenuRef = useRef<HTMLDivElement>(null);
  const controlsButtonRef = useRef<HTMLButtonElement>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showControlsMenu, setShowControlsMenu] = useState(false);
  const [showSaveInfo, setShowSaveInfo] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const languageButtonRef = useRef<HTMLButtonElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectButtonRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [projectName, setProjectName] = useState('');
  const { generate, cancelGeneration } = useGeneration();

  const selectionUndoStack = state.workflow.visualSelectionUndoStack;
  const selectionRedoStack = state.workflow.visualSelectionRedoStack;
  const boundaryUndoStack = state.workflow.mpBoundaryUndoStack;
  const boundaryRedoStack = state.workflow.mpBoundaryRedoStack;
  const isMasterplanBoundary = state.mode === 'masterplan' && state.workflow.mpBoundary.mode === 'custom';
  const canUndoSelection =
    (state.mode === 'visual-edit' && selectionUndoStack.length > 0) ||
    (isMasterplanBoundary && boundaryUndoStack.length > 0);
  const canRedoSelection =
    (state.mode === 'visual-edit' && selectionRedoStack.length > 0) ||
    (isMasterplanBoundary && boundaryRedoStack.length > 0);

  const handleUndoSelection = () => {
    if (!canUndoSelection) return;
    if (isMasterplanBoundary) {
      const previous = boundaryUndoStack[boundaryUndoStack.length - 1] || [];
      const nextUndo = boundaryUndoStack.slice(0, -1);
      const nextRedo = [...boundaryRedoStack, state.workflow.mpBoundary.points];
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          mpBoundary: { ...state.workflow.mpBoundary, points: previous },
          mpBoundaryUndoStack: nextUndo,
          mpBoundaryRedoStack: nextRedo,
        },
      });
      return;
    }
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
    if (isMasterplanBoundary) {
      const next = boundaryRedoStack[boundaryRedoStack.length - 1] || [];
      const nextRedo = boundaryRedoStack.slice(0, -1);
      const nextUndo = [...boundaryUndoStack, state.workflow.mpBoundary.points];
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          mpBoundary: { ...state.workflow.mpBoundary, points: next },
          mpBoundaryUndoStack: nextUndo,
          mpBoundaryRedoStack: nextRedo,
        },
      });
      return;
    }
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
  const isUpscaleMode = state.mode === 'upscale';
  const isPdfCompressionMode = state.mode === 'pdf-compression';
  const upscaleQueueReady = state.workflow.upscaleBatch.length > 0;
  const pdfQueueReady = state.workflow.pdfCompression.queue.length > 0;
  const videoUnlocked = !isVideoMode || state.workflow.videoState.accessUnlocked;

  // Video mode validation
  const videoReady = isVideoMode
    ? (state.workflow.videoState.inputMode === 'image-animate'
        ? !!state.uploadedImage
        : state.workflow.videoState.keyframes.length > 0)
    : true;

  const isDisabled = state.mode === 'material-validation'
    ? false
    : state.mode === 'document-translate'
      ? !state.workflow.documentTranslate.sourceDocument
      : isPdfCompressionMode
        ? !pdfQueueReady
        : isUpscaleMode
          ? !upscaleQueueReady
          : isVideoMode
            ? !videoReady || !videoUnlocked
            : !state.uploadedImage;
  const resolutionOptions: Array<{ value: '2k' | '4k' | '8k'; label: string; title?: string }> = [
    { value: '2k', label: '2K' },
    { value: '4k', label: '4K' },
    { value: '8k', label: '8K', title: '8K (API capped at 4K)' },
  ];

  const getSafeProjectName = (value: string) =>
    value
      .trim()
      .replace(/[^a-z0-9-_ ]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  const safeProjectName = getSafeProjectName(projectName);
  const canSaveProject = safeProjectName.length > 0;

  const handleResolutionChange = (resolution: '2k' | '4k' | '8k') => {
    if (resolution === state.output.resolution) return;
    dispatch({ type: 'UPDATE_OUTPUT', payload: { resolution } });
  };

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

  const handleGenerate = async () => {
    if (state.isGenerating) {
      return;
    }
    if (state.mode === 'material-validation') {
      await generate();
      return;
    }
    if (state.mode === 'document-translate') {
      if (!state.workflow.documentTranslate.sourceDocument) return;
      await generate();
      return;
    }
    if (isPdfCompressionMode) {
      await generate();
      return;
    }
    if (isUpscaleMode) {
      if (!upscaleQueueReady) return;
      await generate();
      return;
    }
    if (isVideoMode && !videoUnlocked) {
      return;
    }
    if (isVideoMode) {
      if (!videoReady) {
        return;
      }
      await generate();
      return;
    }
    if (!state.uploadedImage) return;
    await generate();
  };

  const handleExportProject = () => {
    setShowSaveInfo(true);
  };

  const confirmExportProject = () => {
    if (!canSaveProject) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${safeProjectName}.json`);
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
                        state.workflow.visualSelection.brushSize,
                        state.workflow.visualSelectionViewScale,
                        state.canvas.zoom
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
                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1500);
                    setShowDownloadMenu(false);
                })
                .catch(fetchErr => {
                    // Ultimate fallback: open in new tab
                    window.open(downloadSource, '_blank');
                    setShowDownloadMenu(false);
                });
        }
    };

    img.onerror = () => {
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

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    setShowLanguageMenu(false);
  };

  useEffect(() => {
    if (!showControlsMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (controlsMenuRef.current?.contains(target)) return;
      if (controlsButtonRef.current?.contains(target)) return;
      setShowControlsMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showControlsMenu]);

  useEffect(() => {
    if (!showProjectMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (projectMenuRef.current?.contains(target)) return;
      if (projectButtonRef.current?.contains(target)) return;
      setShowProjectMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProjectMenu]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    setShowControlsMenu(false);
    setShowDownloadMenu(false);
    setShowLanguageMenu(false);
    setShowProjectMenu(false);
  }, [isMobile]);

  useEffect(() => {
    if (!showLanguageMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (languageMenuRef.current?.contains(target)) return;
      if (languageButtonRef.current?.contains(target)) return;
      setShowLanguageMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageMenu]);

  const getLanguageLabel = () => {
    const lang = (i18n.language || 'en').split('-')[0];
    switch (lang) {
      case 'es': return 'ES';
      case 'fr': return 'FR';
      default: return 'EN';
    }
  };

  const getGenerateLabel = () => {
    switch (state.mode) {
      case 'masterplan': return t('generation.generateMasterplan');
      case 'exploded': return t('generation.generateExplodedView');
      case 'section': return t('generation.generateSection');
      case 'multi-angle': return t('generation.generateAngles');
      case 'upscale': return t('generation.upscaleImage');
      case 'img-to-cad': return t('generation.convertToCAD');
      case 'img-to-3d': return t('generation.generate3DModel');
      case 'video': return t('generation.generateVideo');
      case 'pdf-compression': return t('generation.compressPdfs');
      case 'visual-edit': return t('generation.applyEdits');
      case 'material-validation': return t('generation.runValidation');
      case 'render-sketch': return t('generation.renderSketch');
      case 'document-translate': return t('generation.translateDocument');
      default: return t('generation.generateRender');
    }
  };

  return (
    <>
    <header className="h-auto lg:h-16 bg-surface-elevated border-b border-border flex items-center justify-between px-3 lg:px-6 py-2 lg:py-0 shrink-0 z-40 shadow-sm relative">
      {isMobile ? (
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 select-none">
              <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-md shrink-0">
                <span className="text-surface-elevated font-bold text-sm">AV</span>
              </div>
              <div className="flex flex-col">
                <h1 className="font-bold text-xs leading-tight whitespace-nowrap">{t('app.title')}</h1>
                <p className="text-[10px] text-foreground-muted whitespace-nowrap">{t('app.subtitle')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleMobilePanel?.('workflow')}
                className="p-2 rounded-full bg-surface-sunken text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors"
                title={t('leftSidebar.workflow')}
              >
                <Layers size={16} />
              </button>
              <div className="relative shrink-0">
                <button
                  ref={languageButtonRef}
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-full transition-colors"
                  title={t('topBar.language')}
                >
                  <span>{getLanguageLabel()}</span>
                  <ChevronDown size={10} className={cn("transition-transform", showLanguageMenu && "rotate-180")} />
                </button>

                {showLanguageMenu && (
                  <div
                    ref={languageMenuRef}
                    className="absolute right-0 top-full mt-1 w-16 bg-surface-elevated rounded-lg shadow-elevated border border-border p-1 z-50 animate-fade-in origin-top-right"
                  >
                    <button
                      onClick={() => handleLanguageChange('en')}
                      className={cn(
                        "w-full text-center px-2 py-1.5 rounded-md text-[10px] font-semibold transition-colors",
                        i18n.language === 'en'
                          ? "bg-foreground text-background"
                          : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground"
                      )}
                      title="English"
                    >
                      EN
                    </button>
                    <button
                      onClick={() => handleLanguageChange('es')}
                      className={cn(
                        "w-full text-center px-2 py-1.5 rounded-md text-[10px] font-semibold transition-colors",
                        i18n.language === 'es'
                          ? "bg-foreground text-background"
                          : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground"
                      )}
                      title="Spanish"
                    >
                      ES
                    </button>
                    <button
                      onClick={() => handleLanguageChange('fr')}
                      className={cn(
                        "w-full text-center px-2 py-1.5 rounded-md text-[10px] font-semibold transition-colors",
                        i18n.language === 'fr'
                          ? "bg-foreground text-background"
                          : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground"
                      )}
                      title="French"
                    >
                      FR
                    </button>
                  </div>
                )}
              </div>

              <div className="relative shrink-0">
                <button
                  ref={projectButtonRef}
                  onClick={() => setShowProjectMenu(!showProjectMenu)}
                  className="p-2 rounded-full bg-surface-sunken text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors"
                  title={t('topBar.saveProject')}
                >
                  <MoreVertical size={16} />
                </button>

                {showProjectMenu && (
                  <div
                    ref={projectMenuRef}
                    className="absolute right-0 top-full mt-2 w-44 bg-surface-elevated rounded-xl shadow-elevated border border-border p-2 z-50 animate-fade-in origin-top-right"
                  >
                    <button
                      onClick={() => {
                        setShowProjectMenu(false);
                        handleReset();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 text-[11px] font-semibold text-foreground-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <RotateCcw size={14} />
                      {t('topBar.resetProject')}
                    </button>
                    <button
                      onClick={() => {
                        setShowProjectMenu(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 text-[11px] font-semibold text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-lg transition-colors"
                    >
                      <FolderOpen size={14} />
                      {t('topBar.loadProject')}
                    </button>
                    <button
                      onClick={() => {
                        setShowProjectMenu(false);
                        handleExportProject();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 text-[11px] font-semibold text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-lg transition-colors"
                    >
                      <FileJson size={14} />
                      {t('topBar.saveProject')}
                    </button>
                  </div>
                )}
              </div>

              {/* User Profile & Logout (Mobile) */}
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name || ''}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                />
              )}
              <button
                onClick={() => logout()}
                className="p-2 rounded-full bg-surface-sunken text-foreground-muted hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept="application/json" />

          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <button
                ref={controlsButtonRef}
                onClick={() => setShowControlsMenu(!showControlsMenu)}
                className="p-2 rounded-full bg-surface-sunken text-foreground-muted hover:text-foreground hover:bg-surface-elevated transition-colors"
                title={t('topBar.controls')}
              >
                <SlidersHorizontal size={16} />
              </button>

              {showControlsMenu && (
                <div
                  ref={controlsMenuRef}
                  className="absolute left-0 top-full mt-2 w-64 bg-surface-elevated rounded-xl shadow-elevated border border-border z-50 animate-fade-in origin-top-left"
                >
                  <div className="p-2.5 border-b border-border-subtle">
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                      <button
                        onClick={handleUndoSelection}
                        disabled={!canUndoSelection}
                        className={cn(
                          "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                          canUndoSelection
                            ? "text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                            : "text-foreground-muted/30 cursor-not-allowed"
                        )}
                        title={t('topBar.undo')}
                      >
                        <Undo size={13} />
                        <span className="text-[7.5px] font-medium uppercase tracking-wide">{t('topBar.undo')}</span>
                      </button>
                      <button
                        onClick={handleRedoSelection}
                        disabled={!canRedoSelection}
                        className={cn(
                          "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                          canRedoSelection
                            ? "text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                            : "text-foreground-muted/30 cursor-not-allowed"
                        )}
                        title={t('topBar.redo')}
                      >
                        <Redo size={13} />
                        <span className="text-[7.5px] font-medium uppercase tracking-wide">{t('topBar.redo')}</span>
                      </button>
                      <button
                        onClick={handleFitToScreen}
                        disabled={!state.uploadedImage}
                        className={cn(
                          "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                          !state.uploadedImage
                            ? "text-foreground-muted/30 cursor-not-allowed"
                            : "text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                        )}
                        title={t('topBar.fitToScreen')}
                      >
                        <Minimize2 size={13} />
                        <span className="text-[7.5px] font-medium uppercase tracking-wide">Fit</span>
                      </button>
                      {!isVideoMode && (
                        <button
                          onClick={handleToggleSplit}
                          disabled={!state.uploadedImage}
                          className={cn(
                            "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                            !state.uploadedImage
                              ? "text-foreground-muted/30 cursor-not-allowed"
                              : state.workflow.canvasSync
                                ? "text-foreground bg-surface-sunken"
                                : "text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                          )}
                          title={t('topBar.toggleSplitView')}
                        >
                          <Columns size={13} />
                          <span className="text-[7.5px] font-medium uppercase tracking-wide">Split</span>
                        </button>
                      )}
                      <button
                        onClick={handleClearImage}
                        disabled={!state.uploadedImage}
                        className={cn(
                          "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                          !state.uploadedImage
                            ? "text-foreground-muted/30 cursor-not-allowed"
                            : "text-foreground-secondary hover:text-red-600 hover:bg-red-50"
                        )}
                        title={t('topBar.clearImage')}
                      >
                        <Trash2 size={13} />
                        <span className="text-[7.5px] font-medium uppercase tracking-wide">Clear</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 border-b border-border-subtle">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Zoom</span>
                      <span className="text-[10px] font-mono text-foreground-muted">{Math.round(state.canvas.zoom * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleZoom(-0.25)}
                        className="flex-1 p-1.5 bg-surface-sunken rounded-md hover:bg-surface-sunken/80 transition-all"
                        title={t('topBar.zoomOut')}
                      >
                        <ZoomOut size={13} className="mx-auto text-foreground-secondary" />
                      </button>
                      <button
                        onClick={() => handleZoom(0.25)}
                        className="flex-1 p-1.5 bg-surface-sunken rounded-md hover:bg-surface-sunken/80 transition-all"
                        title={t('topBar.zoomIn')}
                      >
                        <ZoomIn size={13} className="mx-auto text-foreground-secondary" />
                      </button>
                    </div>
                  </div>

                  {!isVideoMode && (
                    <div className="p-2.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted block mb-1.5">
                        {t('topBar.resolution')}
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {resolutionOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleResolutionChange(option.value)}
                            className={cn(
                              "py-1.5 px-1 text-[10px] font-semibold rounded-md transition-all",
                              state.output.resolution === option.value
                                ? "bg-foreground text-background shadow-sm"
                                : "bg-surface-sunken text-foreground-secondary hover:bg-surface-sunken/80"
                            )}
                            title={option.title || `Set ${option.label} output resolution`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1">
              {state.mode !== 'generate-text' && (
                <div className="flex items-center gap-2">
                  <button
                    aria-label="generate-trigger"
                    onClick={handleGenerate}
                    disabled={isDisabled || state.isGenerating}
                    className={cn(
                      "relative group flex flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 border border-transparent overflow-hidden",
                      isDisabled
                        ? "bg-surface-sunken text-foreground-muted cursor-not-allowed"
                        : "bg-foreground text-background shadow-lg active:scale-95"
                    )}
                  >
                    {state.isGenerating ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span className="font-bold text-[11px]">{t('generation.generating')} {state.progress}%</span>
                      </>
                    ) : (
                      <>
                        {state.mode === 'document-translate' ? (
                          <Languages size={16} />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        <span className="font-bold text-[11px] truncate">{getGenerateLabel()}</span>
                      </>
                    )}
                  </button>

                  {state.isGenerating && (
                    <button
                      aria-label="cancel-generation"
                      onClick={cancelGeneration}
                      className="px-3 py-2 rounded-full bg-red-600 text-white text-[10px] font-semibold uppercase tracking-wider"
                    >
                      {t('generation.cancel')}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative shrink-0">
              <button
                onClick={handleDownloadClick}
                disabled={!state.uploadedImage}
                className={cn(
                  "p-2 rounded-full transition-all border",
                  state.uploadedImage
                    ? "bg-surface-elevated text-foreground border-border hover:bg-surface-sunken"
                    : "bg-surface-sunken text-foreground-muted border-transparent cursor-not-allowed"
                )}
                title={!state.uploadedImage ? t('generation.generateOutputFirst') : t('topBar.download')}
              >
                {isVideoMode ? <Video size={16} /> : <Download size={16} />}
              </button>

              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface-elevated rounded-xl shadow-elevated border border-border p-4 z-50 animate-fade-in origin-top-right">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-subtle">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t('topBar.downloadSettings')}</span>
                    <button onClick={() => setShowDownloadMenu(false)} className="text-foreground-muted hover:text-foreground" title={t('topBar.close')}><X size={14}/></button>
                  </div>
                  
                  <div className="space-y-4">
                     {isVideoMode ? (
                       <>
                          <div className="space-y-2">
                            <label className="text-xs text-foreground-secondary font-medium">{t('topBar.videoResolution')}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                             <label className="text-xs text-foreground-secondary font-medium">{t('topBar.format')}</label>
                             <div className="grid grid-cols-1 gap-2">
                                <div className="p-2 border border-foreground bg-surface-sunken rounded text-center opacity-70 cursor-not-allowed">
                                   <span className="text-xs font-bold">MP4</span>
                                   <span className="block text-[9px] text-foreground-muted">{t('topBar.universalVideoFormat')}</span>
                                </div>
                             </div>
                          </div>
                       </>
                     ) : (
                       <>
                        <div className="space-y-2">
                            <label className="text-xs text-foreground-secondary font-medium">{t('topBar.format')}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                  <span className={cn("text-[9px]", downloadFormat === 'png' ? "text-white/70" : "text-foreground-muted")}>{t('topBar.lossless')}</span>
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
                                  <span className={cn("text-[9px]", downloadFormat === 'jpg' ? "text-white/70" : "text-foreground-muted")}>{t('topBar.compact')}</span>
                              </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-foreground-secondary font-medium">{t('topBar.resolution')}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                    <span className="text-xs font-bold">{t('topBar.fullRes')}</span>
                                  </span>
                                  <span className={cn("text-[9px]", downloadResolution === 'full' ? "text-white/70" : "text-foreground-muted")}>{t('topBar.originalSize')}</span>
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
                                    <span className="text-xs font-bold">{t('topBar.medium')}</span>
                                  </span>
                                  <span className={cn("text-[9px]", downloadResolution === 'medium' ? "text-white/70" : "text-foreground-muted")}>{t('topBar.scalePercent')}</span>
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
                        {t('topBar.downloadNow')}
                     </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between w-full">
      {/* Left: Branding & Utility */}
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div className="flex items-center gap-2 select-none shrink-0">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-md shrink-0">
            <span className="text-surface-elevated font-bold text-sm">AV</span>
          </div>
          <div className="flex flex-col shrink-0">
            <h1 className="font-bold text-sm leading-tight whitespace-nowrap">{t('app.title')}</h1>
            <p className="text-[10px] text-foreground-muted whitespace-nowrap">{t('app.subtitle')}</p>
          </div>
        </div>

        <div className="h-6 w-px bg-border-strong shrink-0" />

          <div className="hidden 2xl:flex items-center gap-1 bg-surface-sunken p-1 rounded-lg border border-border-subtle shrink-0">
            <button
              onClick={handleUndoSelection}
              disabled={!canUndoSelection}
              className={cn(
                "p-1.5 text-foreground-secondary rounded-md transition-all",
                canUndoSelection
                  ? "hover:text-foreground hover:bg-surface-elevated"
                  : "opacity-40 cursor-not-allowed"
              )}
              title={t('topBar.undo')}
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
              title={t('topBar.redo')}
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
             title={t('topBar.clearImage')}
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
            title={t('topBar.fitToScreen')}
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
               title={t('topBar.toggleSplitView')}
            >
               <Columns size={14} />
            </button>
          )}

          <div className="w-px h-3 bg-border mx-1" />

          <button
            className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-md transition-all"
            onClick={() => handleZoom(-0.25)}
            title={t('topBar.zoomOut')}
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-mono w-10 text-center text-foreground-muted select-none">
             {Math.round(state.canvas.zoom * 100)}%
          </span>
          <button
            className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-md transition-all"
            onClick={() => handleZoom(0.25)}
            title={t('topBar.zoomIn')}
          >
            <ZoomIn size={14} />
          </button>

          {!isVideoMode && (
            <>
              <div className="w-px h-3 bg-border mx-1" />
              <div className="flex items-center gap-1 px-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted px-1">
                  {t('topBar.resolution')}
                </span>
                <div className="flex items-center gap-1 bg-surface-elevated/70 rounded-md p-0.5">
                  {resolutionOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleResolutionChange(option.value)}
                      className={cn(
                        "px-2 py-1 text-[10px] font-semibold rounded-md transition-all",
                        state.output.resolution === option.value
                          ? "bg-foreground text-background shadow-sm"
                          : "text-foreground-secondary hover:text-foreground hover:bg-surface-elevated"
                      )}
                      title={option.title || `Set ${option.label} output resolution`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mobile Controls - Compact Dropdown */}
        <div className="2xl:hidden relative shrink-0">
          <button
            ref={controlsButtonRef}
            onClick={() => setShowControlsMenu(!showControlsMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-sunken rounded-lg border border-border-subtle hover:bg-surface-elevated transition-all"
          >
            <SlidersHorizontal size={12} className="text-foreground-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary whitespace-nowrap">
              {t('topBar.controls')}
            </span>
            <ChevronDown size={10} className={cn("text-foreground-muted transition-transform", showControlsMenu && "rotate-180")} />
          </button>

          {/* Dropdown Panel */}
          {showControlsMenu && (
            <div
              ref={controlsMenuRef}
              className="absolute left-0 top-full mt-2 w-56 bg-surface-elevated rounded-xl shadow-elevated border border-border z-50 animate-fade-in origin-top-left"
            >
              {/* Quick Actions Grid */}
              <div className="p-2.5 border-b border-border-subtle">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                  <button
                    onClick={handleUndoSelection}
                    disabled={!canUndoSelection}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                      canUndoSelection
                        ? "text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                        : "text-foreground-muted/30 cursor-not-allowed"
                    )}
                    title={t('topBar.undo')}
                  >
                    <Undo size={13} />
                    <span className="text-[7.5px] font-medium uppercase tracking-wide">{t('topBar.undo')}</span>
                  </button>
                  <button
                    onClick={handleRedoSelection}
                    disabled={!canRedoSelection}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                      canRedoSelection
                        ? "text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                        : "text-foreground-muted/30 cursor-not-allowed"
                    )}
                    title={t('topBar.redo')}
                  >
                    <Redo size={13} />
                    <span className="text-[7.5px] font-medium uppercase tracking-wide">{t('topBar.redo')}</span>
                  </button>
                  <button
                    onClick={handleFitToScreen}
                    disabled={!state.uploadedImage}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                      !state.uploadedImage
                        ? "text-foreground-muted/30 cursor-not-allowed"
                        : "text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                    )}
                    title={t('topBar.fitToScreen')}
                  >
                    <Minimize2 size={13} />
                    <span className="text-[7.5px] font-medium uppercase tracking-wide">Fit</span>
                  </button>
                  {!isVideoMode && (
                    <button
                      onClick={handleToggleSplit}
                      disabled={!state.uploadedImage}
                      className={cn(
                        "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                        !state.uploadedImage
                          ? "text-foreground-muted/30 cursor-not-allowed"
                          : state.workflow.canvasSync
                            ? "text-foreground bg-surface-sunken"
                            : "text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                      )}
                      title={t('topBar.toggleSplitView')}
                    >
                      <Columns size={13} />
                      <span className="text-[7.5px] font-medium uppercase tracking-wide">Split</span>
                    </button>
                  )}
                  <button
                    onClick={handleClearImage}
                    disabled={!state.uploadedImage}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-all",
                      !state.uploadedImage
                        ? "text-foreground-muted/30 cursor-not-allowed"
                        : "text-foreground-secondary hover:text-red-600 hover:bg-red-50"
                    )}
                    title={t('topBar.clearImage')}
                  >
                    <Trash2 size={13} />
                    <span className="text-[7.5px] font-medium uppercase tracking-wide">Clear</span>
                  </button>
                </div>
              </div>

              {/* Zoom Controls */}
              <div className="p-2.5 border-b border-border-subtle">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">Zoom</span>
                  <span className="text-[10px] font-mono text-foreground-muted">{Math.round(state.canvas.zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleZoom(-0.25)}
                    className="flex-1 p-1.5 bg-surface-sunken rounded-md hover:bg-surface-sunken/80 transition-all"
                    title={t('topBar.zoomOut')}
                  >
                    <ZoomOut size={13} className="mx-auto text-foreground-secondary" />
                  </button>
                  <button
                    onClick={() => handleZoom(0.25)}
                    className="flex-1 p-1.5 bg-surface-sunken rounded-md hover:bg-surface-sunken/80 transition-all"
                    title={t('topBar.zoomIn')}
                  >
                    <ZoomIn size={13} className="mx-auto text-foreground-secondary" />
                  </button>
                </div>
              </div>

              {/* Resolution Selector */}
              {!isVideoMode && (
                <div className="p-2.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted block mb-1.5">
                    {t('topBar.resolution')}
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {resolutionOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleResolutionChange(option.value)}
                        className={cn(
                          "py-1.5 px-1 text-[10px] font-semibold rounded-md transition-all",
                          state.output.resolution === option.value
                            ? "bg-foreground text-background shadow-sm"
                            : "bg-surface-sunken text-foreground-secondary hover:bg-surface-sunken/80"
                        )}
                        title={option.title || `Set ${option.label} output resolution`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Generate Button (Hidden in generate-text mode) */}
      <div className={cn(
        "flex items-center justify-center shrink-0 transition-all duration-500",
        showControlsMenu ? "mx-2" : "mx-4"
      )}>
        {state.mode !== 'generate-text' && (
          <div className="relative flex items-center">
            <div className="relative">
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
                      <span className="font-bold text-xs">{t('generation.generating')}</span>
                      <span className="text-[9px] opacity-80 font-mono">{state.progress}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    {state.mode === 'document-translate' ? (
                      <Languages size={18} className={cn(!isDisabled && "group-hover:text-accent transition-colors")} />
                    ) : (
                      <Sparkles size={18} className={cn(!isDisabled && "group-hover:text-accent transition-colors")} />
                    )}
                    <span className="font-bold text-sm tracking-wide">{getGenerateLabel()}</span>
                  </>
                )}
              </button>
              {state.isGenerating && null}
            </div>

            {state.isGenerating && (
              <div className="ml-2 origin-left animate-cancel-emerge">
                <button
                  aria-label="cancel-generation"
                  onClick={cancelGeneration}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-full shadow-elevated bg-red-600 text-white hover:bg-red-500 active:scale-95 transition-all duration-200"
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{t('generation.cancel')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center justify-end gap-3 flex-1 min-w-0 relative">
        {/* Language Selector */}
        <div className="relative shrink-0">
          <button
            ref={languageButtonRef}
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-full transition-colors"
            title={t('topBar.language')}
          >
            <span>{getLanguageLabel()}</span>
            <ChevronDown size={10} className={cn("transition-transform", showLanguageMenu && "rotate-180")} />
          </button>

          {showLanguageMenu && (
            <div
              ref={languageMenuRef}
              className="absolute right-0 top-full mt-1 w-16 bg-surface-elevated rounded-lg shadow-elevated border border-border p-1 z-50 animate-fade-in origin-top-right"
            >
              <button
                onClick={() => handleLanguageChange('en')}
                className={cn(
                  "w-full text-center px-2 py-1.5 rounded-md text-[10px] font-semibold transition-colors",
                  i18n.language === 'en'
                    ? "bg-foreground text-background"
                    : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground"
                )}
                title="English"
              >
                EN
              </button>
              <button
                onClick={() => handleLanguageChange('es')}
                className={cn(
                  "w-full text-center px-2 py-1.5 rounded-md text-[10px] font-semibold transition-colors",
                  i18n.language === 'es'
                    ? "bg-foreground text-background"
                    : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground"
                )}
                title="Spanish"
              >
                ES
              </button>
              <button
                onClick={() => handleLanguageChange('fr')}
                className={cn(
                  "w-full text-center px-2 py-1.5 rounded-md text-[10px] font-semibold transition-colors",
                  i18n.language === 'fr'
                    ? "bg-foreground text-background"
                    : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground"
                )}
                title="French"
              >
                FR
              </button>
            </div>
          )}
        </div>

        {/* Subtle Project Management Tools */}
        <div className="flex items-center gap-1 mr-2 shrink-0">
            <button
              onClick={handleReset}
              className="p-2 text-foreground-muted hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title={t('topBar.resetProject')}
            >
              <RotateCcw size={16} />
            </button>

            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept="application/json" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-full transition-colors"
              title={t('topBar.loadProject')}
            >
              <FolderOpen size={16} />
            </button>

            {/* Save Project Button */}
            <button
              onClick={handleExportProject}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-full transition-colors"
              title={t('topBar.saveProject')}
            >
              <FileJson size={14} />
              <span className="hidden lg:inline">{t('topBar.saveProject')}</span>
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
            title={!state.uploadedImage ? t('generation.generateOutputFirst') : t('topBar.download')}
          >
            {isVideoMode ? <Video size={14} /> : <Download size={14} />}
            <span className="hidden sm:inline">{t('topBar.download')}</span>
            {state.uploadedImage && <ChevronDown size={12} className={cn("transition-transform", showDownloadMenu && "rotate-180")} />}
          </button>

          {/* Download Pop-up Menu */}
          {showDownloadMenu && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-surface-elevated rounded-xl shadow-elevated border border-border p-4 z-50 animate-fade-in origin-top-right">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-subtle">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t('topBar.downloadSettings')}</span>
                <button onClick={() => setShowDownloadMenu(false)} className="text-foreground-muted hover:text-foreground" title={t('topBar.close')}><X size={14}/></button>
              </div>
              
              <div className="space-y-4">
                 {isVideoMode ? (
                   /* VIDEO SPECIFIC OPTIONS */
                   <>
                      <div className="space-y-2">
                        <label className="text-xs text-foreground-secondary font-medium">{t('topBar.videoResolution')}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                         <label className="text-xs text-foreground-secondary font-medium">{t('topBar.format')}</label>
                         <div className="grid grid-cols-1 gap-2">
                            <div className="p-2 border border-foreground bg-surface-sunken rounded text-center opacity-70 cursor-not-allowed">
                               <span className="text-xs font-bold">MP4</span>
                               <span className="block text-[9px] text-foreground-muted">{t('topBar.universalVideoFormat')}</span>
                            </div>
                         </div>
                      </div>
                   </>
                 ) : (
                   /* IMAGE SPECIFIC OPTIONS */
                   <>
                    <div className="space-y-2">
                        <label className="text-xs text-foreground-secondary font-medium">{t('topBar.format')}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                              <span className={cn("text-[9px]", downloadFormat === 'png' ? "text-white/70" : "text-foreground-muted")}>{t('topBar.lossless')}</span>
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
                              <span className={cn("text-[9px]", downloadFormat === 'jpg' ? "text-white/70" : "text-foreground-muted")}>{t('topBar.compact')}</span>
                          </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-foreground-secondary font-medium">{t('topBar.resolution')}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                <span className="text-xs font-bold">{t('topBar.fullRes')}</span>
                              </span>
                              <span className={cn("text-[9px]", downloadResolution === 'full' ? "text-white/70" : "text-foreground-muted")}>{t('topBar.originalSize')}</span>
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
                                <span className="text-xs font-bold">{t('topBar.medium')}</span>
                              </span>
                              <span className={cn("text-[9px]", downloadResolution === 'medium' ? "text-white/70" : "text-foreground-muted")}>{t('topBar.scalePercent')}</span>
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
                    {t('topBar.downloadNow')}
                 </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-border-subtle shrink-0">
          {user?.picture && (
            <img
              src={user.picture}
              alt={user.name || ''}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover border border-border"
            />
          )}
          <button
            onClick={() => logout()}
            className="p-1.5 text-foreground-muted hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
      </div>
      )}
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
                   <h3 className="text-lg font-bold text-foreground">{t('topBar.clearCanvas')}</h3>
               </div>
               <p className="text-sm text-foreground-secondary leading-relaxed mb-6">
                  {t('topBar.clearCanvasMessage')}
               </p>
               <div className="flex gap-3">
                  <button
                     onClick={() => setShowClearConfirm(false)}
                     className="flex-1 py-2.5 text-xs font-bold text-foreground border border-border rounded-lg hover:bg-surface-sunken transition-colors"
                  >
                     {t('topBar.cancel')}
                  </button>
                  <button
                     onClick={() => {
                        dispatch({ type: 'SET_IMAGE', payload: null });
                        dispatch({ type: 'SET_SOURCE_IMAGE', payload: null });
                        setShowClearConfirm(false);
                     }}
                     className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                  >
                     {t('topBar.confirmClear')}
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
               <h3 className="text-lg font-bold mb-2">{t('topBar.saveProjectWorkspace')}</h3>
               <p className="text-sm text-foreground-secondary leading-relaxed mb-4">
                  {t('topBar.saveProjectMessage')}
               </p>
               <ul className="space-y-3 mb-6">
                  <li className="flex gap-3 text-xs text-foreground-muted">
                     <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                     <span>{t('topBar.includesHistory')}</span>
                  </li>
                  <li className="flex gap-3 text-xs text-foreground-muted">
                     <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                     <span>{t('topBar.preservesSettings')}</span>
                  </li>
                  <li className="flex gap-3 text-xs text-foreground-muted">
                     <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                     <span>{t('topBar.canBeRestored')}</span>
                  </li>
               </ul>
               <div className="bg-surface-sunken p-3 rounded-lg border border-border-subtle mb-6">
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold mb-1">{t('topBar.privacyNotice')}</p>
                  <p className="text-[11px] text-foreground-secondary">
                     {t('topBar.privacyMessage')}
                  </p>
               </div>
               <div className="mb-6">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-2">
                    {t('topBar.projectNameLabel')}
                  </label>
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canSaveProject) {
                        confirmExportProject();
                      }
                    }}
                    placeholder={t('topBar.projectNamePlaceholder')}
                    className="w-full h-9 px-3 text-xs bg-surface-elevated border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent transition-colors"
                  />
               </div>
               <div className="flex gap-3">
                  <button
                     onClick={() => setShowSaveInfo(false)}
                     className="flex-1 py-2.5 text-xs font-bold text-foreground border border-border rounded-lg hover:bg-surface-sunken transition-colors"
                  >
                     {t('topBar.cancel')}
                  </button>
                  <button
                     onClick={confirmExportProject}
                     disabled={!canSaveProject}
                     className={cn(
                       "flex-1 py-2.5 text-xs font-bold rounded-lg transition-colors shadow-sm",
                       canSaveProject
                         ? "text-white bg-foreground hover:bg-foreground/90"
                         : "text-foreground-muted bg-surface-sunken cursor-not-allowed"
                     )}
                  >
                     {t('topBar.confirmSave')}
                  </button>
               </div>
            </div>
         </div>
      </div>
    )}
    </>
  );
};

