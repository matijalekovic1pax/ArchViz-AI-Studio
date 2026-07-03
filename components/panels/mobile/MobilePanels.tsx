import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Palette,
  FileCode,
  Map,
  Eraser,
  Layers,
  RectangleVertical,
  Pencil,
  Maximize,
  PenTool,
  Video,
  Sparkles,
  ClipboardCheck,
  Camera,
  Languages,
  FileDown,
  Box,
  Grid,
  Settings,
  Wrench,
  Maximize2,
  CheckCircle2,
  X,
  Combine,
  UserCircle,
  Image as ImageIcon,
  SlidersHorizontal,
  History,
  Wand2,
  Copy,
  ZoomOut,
  ZoomIn,
  Minimize2,
  Columns,
  Download,
  Orbit
} from 'lucide-react';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { GenerationMode } from '../../../types';
import { GENERATION_STAGE_LABEL_KEYS, getGenerationProgressPercent } from '../../../lib/generationProgress';
import { generatePrompt } from '../../../engine/promptEngine';
import { useGeneration } from '../../../hooks/useGeneration';
import { downloadImage } from '../../../lib/download';
import { LeftRender3DPanel } from '../left/LeftRender3DPanel';
import { LeftSceneComposePanel } from '../left/LeftSceneComposePanel';
import { LeftRenderCADPanel } from '../left/LeftRenderCADPanel';
import { LeftMasterplanPanel } from '../left/LeftMasterplanPanel';
import { LeftVisualEditPanel } from '../left/LeftVisualEditPanel';
import { LeftExplodedPanel } from '../left/LeftExplodedPanel';
import { LeftSectionPanel } from '../left/LeftSectionPanel';
import { LeftSketchPanel } from '../left/LeftSketchPanel';
import { LeftAngleChangePanel } from '../left/LeftAngleChangePanel';
import { LeftMultiAnglePanel } from '../left/LeftMultiAnglePanel';
import { LeftUpscalePanel } from '../left/LeftUpscalePanel';
import { LeftImageToCADPanel } from '../left/LeftImageToCADPanel';
import { LeftVideoPanel } from '../left/LeftVideoPanel';
import { LeftValidationPanel } from '../left/LeftValidationPanel';
import { LeftDocumentTranslatePanel } from '../left/LeftDocumentTranslatePanel';
import { LeftPdfCompressionPanel } from '../left/LeftPdfCompressionPanel';
import { LeftHeadshotPanel } from '../left/LeftHeadshotPanel';
import { Render3DPanel } from '../right/Render3DPanel';
import { CadToRenderPanel } from '../right/CadToRenderPanel';
import { MasterplanPanel } from '../right/MasterplanPanel';
import { VisualEditPanel } from '../right/VisualEditPanel';
import { AngleChangePanel } from '../right/AngleChangePanel';
import { ExplodedPanel } from '../right/ExplodedPanel';
import { SectionPanel } from '../right/SectionPanel';
import { MultiAnglePanel } from '../right/MultiAnglePanel';
import { UpscalePanel } from '../right/UpscalePanel';
import { ImageToCadPanel } from '../right/ImageToCadPanel';
import { VideoPanel } from '../right/VideoPanel';
import { ValidationPanel } from '../right/ValidationPanel';
import { DocumentTranslatePanel } from '../right/DocumentTranslatePanel';
import { PdfCompressionPanel } from '../right/PdfCompressionPanel';
import { SceneComposePanel } from '../right/SceneComposePanel';
import { HeadshotPanel } from '../right/HeadshotPanel';

export type MobilePanelType = 'workflow' | 'source' | 'setup' | 'tune' | 'settings' | 'output' | null;

type WorkflowItem = {
  id: GenerationMode;
  labelKey: string;
  icon: React.ElementType;
};

const MOBILE_WORKFLOWS: WorkflowItem[] = [
  { id: 'generate-text', labelKey: 'workflows.generateText', icon: Sparkles },
  { id: 'render-3d', labelKey: 'workflows.render3d', icon: Palette },
  { id: 'visual-edit', labelKey: 'workflows.visualEdit', icon: Eraser },
  { id: 'scene-compose', labelKey: 'workflows.sceneCompose', icon: Combine },
  { id: 'render-cad', labelKey: 'workflows.renderCad', icon: FileCode },
  { id: 'masterplan', labelKey: 'workflows.masterplan', icon: Map },
  { id: 'angle-change', labelKey: 'workflows.angleChange', icon: Orbit },
  { id: 'material-validation', labelKey: 'workflows.materialValidation', icon: ClipboardCheck },
  { id: 'document-translate', labelKey: 'workflows.documentTranslate', icon: Languages },
  { id: 'pdf-compression', labelKey: 'workflows.pdfCompression', icon: FileDown },
  { id: 'exploded', labelKey: 'workflows.exploded', icon: Layers },
  { id: 'section', labelKey: 'workflows.section', icon: RectangleVertical },
  { id: 'render-sketch', labelKey: 'workflows.renderSketch', icon: Pencil },
  { id: 'multi-angle', labelKey: 'workflows.multiAngle', icon: Camera },
  { id: 'upscale', labelKey: 'workflows.upscale', icon: Maximize },
  { id: 'img-to-cad', labelKey: 'workflows.imgToCad', icon: PenTool },
  { id: 'video', labelKey: 'workflows.video', icon: Video },
  { id: 'headshot', labelKey: 'workflows.headshot', icon: UserCircle },
];

const renderLeftPanel = (mode: GenerationMode) => {
  switch (mode) {
    case 'render-3d': return <LeftRender3DPanel />;
    case 'scene-compose': return <LeftSceneComposePanel />;
    case 'render-cad': return <LeftRenderCADPanel />;
    case 'material-validation': return <LeftValidationPanel />;
    case 'document-translate': return <LeftDocumentTranslatePanel />;
    case 'pdf-compression': return <LeftPdfCompressionPanel />;
    case 'masterplan': return <LeftMasterplanPanel />;
    case 'visual-edit': return <LeftVisualEditPanel />;
    case 'angle-change': return <LeftAngleChangePanel />;
    case 'exploded': return <LeftExplodedPanel />;
    case 'section': return <LeftSectionPanel />;
    case 'render-sketch': return <LeftSketchPanel />;
    case 'multi-angle': return <LeftMultiAnglePanel />;
    case 'upscale': return <LeftUpscalePanel />;
    case 'img-to-cad': return <LeftImageToCADPanel />;
    case 'video': return <LeftVideoPanel />;
    case 'headshot': return <LeftHeadshotPanel />;
    default: return null;
  }
};

const renderRightPanel = (mode: GenerationMode) => {
  switch (mode) {
    case 'render-3d': return <Render3DPanel />;
    case 'scene-compose': return <SceneComposePanel />;
    case 'render-cad': return <CadToRenderPanel />;
    case 'masterplan': return <MasterplanPanel />;
    case 'visual-edit': return <VisualEditPanel />;
    case 'angle-change': return <AngleChangePanel />;
    case 'exploded': return <ExplodedPanel />;
    case 'section': return <SectionPanel />;
    case 'render-sketch': return <Render3DPanel />;
    case 'multi-angle': return <MultiAnglePanel />;
    case 'upscale': return <UpscalePanel />;
    case 'img-to-cad': return <ImageToCadPanel />;
    case 'video': return <VideoPanel />;
    case 'material-validation': return <ValidationPanel />;
    case 'document-translate': return <DocumentTranslatePanel />;
    case 'pdf-compression': return <PdfCompressionPanel />;
    case 'headshot': return <HeadshotPanel />;
    default: return null;
  }
};

const getRightPanelMeta = (
  mode: GenerationMode,
  remainingFiles?: number,
  remainingCredits?: number,
  t?: (key: string, options?: any) => string
) => {
  if (mode !== 'pdf-compression' || !t) return null;
  const parts: string[] = [];
  if (typeof remainingFiles === 'number') {
    parts.push(t('pdfCompression.remainingFiles', { count: remainingFiles }));
  }
  if (typeof remainingCredits === 'number') {
    parts.push(t('pdfCompression.remainingCredits', { count: remainingCredits }));
  }
  return parts.length > 0 ? parts.join(' / ') : null;
};

const getRightPanelConfig = (mode: GenerationMode, t: (key: string, options?: any) => string, meta?: string | null) => {
  switch (mode) {
    case 'render-3d':
      return { title: t('rightPanel.render3d.title'), description: t('rightPanel.render3d.description'), icon: Box, meta };
    case 'scene-compose':
      return { title: t('rightPanel.sceneCompose.title'), description: t('rightPanel.sceneCompose.description'), icon: Combine, meta };
    case 'render-cad':
      return { title: t('rightPanel.renderCad.title'), description: t('rightPanel.renderCad.description'), icon: FileCode, meta };
    case 'masterplan':
      return { title: t('rightPanel.masterplan.title'), description: t('rightPanel.masterplan.description'), icon: Grid, meta };
    case 'visual-edit':
      return { title: t('rightPanel.visualEdit.title'), description: t('rightPanel.visualEdit.description'), icon: Wrench, meta };
    case 'angle-change':
      return { title: t('rightPanel.angleChange.title'), description: t('rightPanel.angleChange.description'), icon: Orbit, meta };
    case 'exploded':
      return { title: t('rightPanel.exploded.title'), description: t('rightPanel.exploded.description'), icon: Layers, meta };
    case 'section':
      return { title: t('rightPanel.section.title'), description: t('rightPanel.section.description'), icon: RectangleVertical, meta };
    case 'render-sketch':
      return { title: t('rightPanel.renderSketch.title'), description: t('rightPanel.renderSketch.description'), icon: Pencil, meta };
    case 'multi-angle':
      return { title: t('rightPanel.multiAngle.title'), description: t('rightPanel.multiAngle.description'), icon: Camera, meta };
    case 'upscale':
      return { title: t('rightPanel.upscale.title'), description: t('rightPanel.upscale.description'), icon: Maximize2, meta };
    case 'img-to-cad':
      return { title: t('rightPanel.imgToCad.title'), description: t('rightPanel.imgToCad.description'), icon: FileCode, meta };
    case 'video':
      return { title: t('rightPanel.video.title'), description: t('rightPanel.video.description'), icon: Video, meta };
    case 'material-validation':
      return { title: t('rightPanel.materialValidation.title'), description: t('rightPanel.materialValidation.description'), icon: CheckCircle2, meta };
    case 'document-translate':
      return { title: t('rightPanel.documentTranslate.title'), description: t('rightPanel.documentTranslate.description'), icon: Languages, meta };
    case 'pdf-compression':
      return { title: t('rightPanel.pdfCompression.title'), description: t('rightPanel.pdfCompression.description'), icon: FileDown, meta };
    case 'headshot':
      return {
        title: t('rightPanel.headshot.title', { defaultValue: 'Headshot Studio' }),
        description: t('rightPanel.headshot.description', { defaultValue: 'Generate professional and custom team headshots from reference photos.' }),
        icon: UserCircle,
        meta,
      };
    default:
      return { title: t('rightPanel.settings.title'), description: t('rightPanel.settings.description'), icon: Settings, meta };
  }
};

const getGenerateLabel = (mode: GenerationMode, t: (key: string, options?: any) => string) => {
  switch (mode) {
    case 'masterplan': return t('generation.generateMasterplan');
    case 'exploded': return t('generation.generateExplodedView');
    case 'section': return t('generation.generateSection');
    case 'multi-angle': return t('generation.generateAngles');
    case 'upscale': return t('generation.upscaleImage');
    case 'img-to-cad': return t('generation.convertToCAD');
    case 'video': return t('generation.generateVideo');
    case 'pdf-compression': return t('generation.compressPdfs');
    case 'visual-edit': return t('generation.applyEdits');
    case 'angle-change': return t('generation.changeAngle');
    case 'material-validation': return t('generation.runValidation');
    case 'render-sketch': return t('generation.renderSketch');
    case 'document-translate': return t('generation.translateDocument');
    case 'headshot': return t('generation.generateHeadshot', { defaultValue: 'Generate Headshot' } as any);
    default: return t('generation.generateRender');
  }
};

const normalizePanel = (panel: MobilePanelType) => {
  if (panel === 'settings') return 'tune';
  if (panel === 'setup') return 'source';
  return panel;
};

const MobileOutputContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const prompt = generatePrompt(state);
  const editablePrompt = state.prompt || prompt;
  const recentHistory = state.history.slice(0, 12);
  const hasImage = Boolean(state.uploadedImage);
  const isVideoMode = state.mode === 'video';

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(editablePrompt);
    } catch {}
  };

  const handleZoom = (delta: number) => {
    const nextZoom = Math.max(0.1, Math.min(8, state.canvas.zoom + delta));
    dispatch({ type: 'SET_CANVAS_ZOOM', payload: nextZoom });
  };

  const handleFitToScreen = () => {
    dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
    dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
  };

  const handleDownloadCurrent = async () => {
    if (!state.uploadedImage) return;
    await downloadImage(state.uploadedImage, `archviz-render-${Date.now()}.png`);
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
            {t('mobile.workspace', { defaultValue: 'Workspace' } as any)}
          </div>
          <div className="text-[11px] font-mono text-foreground-muted">
            {Math.round(state.canvas.zoom * 100)}%
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => handleZoom(-0.25)}
            disabled={!hasImage}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border border-border bg-surface-elevated transition-colors active:scale-95",
              hasImage ? "text-foreground-secondary hover:text-foreground" : "cursor-not-allowed text-foreground-muted/35"
            )}
            aria-label={t('topBar.zoomOut')}
            title={t('topBar.zoomOut')}
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={handleFitToScreen}
            disabled={!hasImage}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border border-border bg-surface-elevated transition-colors active:scale-95",
              hasImage ? "text-foreground-secondary hover:text-foreground" : "cursor-not-allowed text-foreground-muted/35"
            )}
            aria-label={t('topBar.fitToScreen')}
            title={t('topBar.fitToScreen')}
          >
            <Minimize2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(0.25)}
            disabled={!hasImage}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border border-border bg-surface-elevated transition-colors active:scale-95",
              hasImage ? "text-foreground-secondary hover:text-foreground" : "cursor-not-allowed text-foreground-muted/35"
            )}
            aria-label={t('topBar.zoomIn')}
            title={t('topBar.zoomIn')}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_WORKFLOW', payload: { canvasSync: !state.workflow.canvasSync } })}
            disabled={!hasImage || isVideoMode}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border border-border bg-surface-elevated transition-colors active:scale-95",
              hasImage && !isVideoMode
                ? state.workflow.canvasSync
                  ? "bg-foreground text-background"
                  : "text-foreground-secondary hover:text-foreground"
                : "cursor-not-allowed text-foreground-muted/35"
            )}
            aria-label={t('topBar.toggleSplitView')}
            title={t('topBar.toggleSplitView')}
          >
            <Columns size={16} />
          </button>
          <button
            type="button"
            onClick={handleDownloadCurrent}
            disabled={!hasImage}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border border-border bg-surface-elevated transition-colors active:scale-95",
              hasImage ? "text-foreground-secondary hover:text-foreground" : "cursor-not-allowed text-foreground-muted/35"
            )}
            aria-label={t('topBar.download')}
            title={t('topBar.download')}
          >
            <Download size={16} />
          </button>
        </div>
      </section>

      {state.mode !== 'generate-text' && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
              {t('bottomPanel.tabs.prompt')}
            </div>
            <button
              type="button"
              onClick={copyPrompt}
              className="h-8 w-8 rounded-full border border-border text-foreground-muted flex items-center justify-center active:scale-95"
              aria-label={t('bottomPanel.copyPrompt')}
              title={t('bottomPanel.copyPrompt')}
            >
              <Copy size={14} />
            </button>
          </div>
          <textarea
            value={editablePrompt}
            onChange={(event) => dispatch({ type: 'SET_PROMPT', payload: event.target.value })}
            className="h-40 w-full resize-none rounded-lg border border-border bg-surface-elevated px-3 py-3 font-mono text-xs leading-relaxed text-foreground-secondary outline-none focus:border-foreground/30"
          />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
            {t('bottomPanel.tabs.history')}
          </div>
          <div className="text-[11px] text-foreground-muted">
            {recentHistory.length}
          </div>
        </div>

        {recentHistory.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-elevated px-4 py-10 text-center">
            <History size={20} className="mx-auto text-foreground-muted" />
            <div className="mt-3 text-sm font-semibold text-foreground">
              {t('canvas.promptHistory.emptyTitle')}
            </div>
            <div className="mt-1 text-xs text-foreground-muted">
              {t('canvas.promptHistory.emptySubtitle')}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {recentHistory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_IMAGE', payload: item.thumbnail });
                  onClose();
                }}
                className="group overflow-hidden rounded-lg border border-border bg-surface-elevated text-left active:scale-[0.99]"
              >
                <div className="aspect-[4/3] bg-surface-sunken">
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="h-full w-full object-cover transition-opacity group-active:opacity-80"
                  />
                </div>
                <div className="min-h-[48px] px-2.5 py-2">
                  <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-snug text-foreground-secondary">
                    {item.prompt}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const MobilePanels: React.FC<{
  active: MobilePanelType;
  onClose: () => void;
  onOpen: (panel: MobilePanelType) => void;
}> = ({ active, onClose, onOpen }) => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const { generate, cancelGeneration } = useGeneration();
  const panel = normalizePanel(active);
  const activeWorkflow = MOBILE_WORKFLOWS.find((workflow) => workflow.id === state.mode) || MOBILE_WORKFLOWS[1];
  const ActiveWorkflowIcon = activeWorkflow.icon;
  const activeWorkflowLabel = t(activeWorkflow.labelKey);
  const meta = getRightPanelMeta(
    state.mode,
    state.workflow.pdfCompression.remainingFiles,
    state.workflow.pdfCompression.remainingCredits,
    t
  );
  const rightPanelConfig = getRightPanelConfig(state.mode, t, meta);
  const RightPanelIcon = rightPanelConfig.icon;
  const sourcePanel = renderLeftPanel(state.mode);
  const tunePanel = renderRightPanel(state.mode);
  const isVideoMode = state.mode === 'video';
  const isUpscaleMode = state.mode === 'upscale';
  const isPdfCompressionMode = state.mode === 'pdf-compression';
  const isHeadshotMode = state.mode === 'headshot';
  const upscaleReady = state.workflow.upscaleBatch.length > 0 || Boolean(state.uploadedImage);
  const pdfQueueReady = state.workflow.pdfCompression.queue.length > 0;
  const videoUnlocked = !isVideoMode || state.workflow.videoState.accessUnlocked;
  const headshotReady = Boolean(
    state.workflow.headshot.leftImage ||
    state.workflow.headshot.frontImage ||
    state.workflow.headshot.rightImage
  );
  const videoReady = isVideoMode
    ? (() => {
        const videoState = state.workflow.videoState;
        if (videoState.inputMode === 'image-animate') {
          return Boolean(videoState.videoInputImage || state.uploadedImage);
        }
        if (videoState.inputMode === 'image-morph') {
          return Boolean(videoState.startFrame && videoState.endFrame);
        }
        return videoState.keyframes.length > 0;
      })()
    : true;
  const generateDisabled = state.mode === 'generate-text'
    ? true
    : state.mode === 'material-validation'
      ? false
      : state.mode === 'document-translate'
        ? !state.workflow.documentTranslate.sourceDocument
        : isPdfCompressionMode
          ? !pdfQueueReady
          : isUpscaleMode
            ? !upscaleReady
            : isVideoMode
              ? !videoReady || !videoUnlocked
              : isHeadshotMode
                ? !headshotReady
                : !state.uploadedImage;
  const generateLabel = getGenerateLabel(state.mode, t);
  const generationProgress = getGenerationProgressPercent(state.progress);
  const generationStageLabel = state.generationStage
    ? t(GENERATION_STAGE_LABEL_KEYS[state.generationStage])
    : t('generation.generating');

  const handleGenerate = async () => {
    if (state.isGenerating) {
      cancelGeneration();
      return;
    }
    if (generateDisabled) return;
    await generate();
  };

  const dockItems: Array<{ id: Exclude<MobilePanelType, null | 'settings' | 'setup'>; label: string; icon: React.ElementType; disabled?: boolean }> = [
    { id: 'workflow', label: String(t('leftSidebar.workflow')), icon: Layers },
    { id: 'source', label: String(t('mobile.input', { defaultValue: 'Input' } as any)), icon: ImageIcon },
    { id: 'tune', label: String(t('mobile.tune', { defaultValue: 'Tune' } as any)), icon: SlidersHorizontal, disabled: state.mode === 'generate-text' },
    { id: 'output', label: String(t('mobile.output', { defaultValue: 'Output' } as any)), icon: History },
  ];

  const getSheetTitle = () => {
    switch (panel) {
      case 'workflow':
        return t('leftSidebar.workflow');
      case 'source':
        return t('mobile.input', { defaultValue: 'Input' } as any);
      case 'tune':
        return rightPanelConfig.title;
      case 'output':
        return t('mobile.output', { defaultValue: 'Output' } as any);
      default:
        return '';
    }
  };

  const getSheetDescription = () => {
    switch (panel) {
      case 'workflow':
        return activeWorkflowLabel;
      case 'source':
        return activeWorkflowLabel;
      case 'tune':
        return rightPanelConfig.meta || rightPanelConfig.description;
      case 'output':
        return t('mobile.outputDescription', { defaultValue: 'Prompt and recent generations' } as any);
      default:
        return '';
    }
  };

  const getSheetIcon = () => {
    switch (panel) {
      case 'workflow':
        return ActiveWorkflowIcon;
      case 'source':
        return ImageIcon;
      case 'tune':
        return RightPanelIcon;
      case 'output':
        return History;
      default:
        return Settings;
    }
  };

  const SheetIcon = getSheetIcon();

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[70] lg:hidden pointer-events-none">
        <div className="pointer-events-auto mx-auto w-full max-w-xl px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="relative rounded-[1.35rem] border border-border/80 bg-surface-elevated/95 shadow-elevated backdrop-blur-xl">
            <div className="grid grid-cols-5 items-end gap-1 px-2 pb-2 pt-2">
              {dockItems.slice(0, 2).map((item) => {
                const Icon = item.icon;
                const isActive = panel === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => onOpen(item.id)}
                    className={cn(
                      "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition-all active:scale-95",
                      isActive
                        ? "bg-foreground text-background"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface-sunken",
                      item.disabled && "opacity-35 cursor-not-allowed hover:bg-transparent hover:text-foreground-muted"
                    )}
                  >
                    <Icon size={18} />
                    <span className="max-w-full truncate px-1">{item.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!state.isGenerating && generateDisabled}
                className={cn(
                  "relative -mt-6 flex h-[4.55rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.6rem] border text-[10px] font-bold shadow-elevated transition-all active:scale-95",
                  state.isGenerating
                    ? "overflow-hidden border-red-500 bg-red-600 text-white"
                    : generateDisabled
                      ? "border-border bg-surface-sunken text-foreground-muted shadow-none"
                      : "border-foreground bg-foreground text-background"
                )}
                aria-label={state.isGenerating ? t('generation.cancel') : generateLabel}
                title={state.isGenerating ? t('generation.cancel') : generateLabel}
              >
                {state.isGenerating && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-500 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                )}
                {state.isGenerating ? (
                  <>
                    <X size={18} className="relative z-10 shrink-0" />
                    <span className="relative z-10 max-w-[4.25rem] truncate">{generationStageLabel}</span>
                    <span className="relative z-10 font-mono text-[9px] leading-none opacity-85 tabular-nums">{generationProgress}%</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={19} />
                    <span className="max-w-[4.25rem] truncate">
                      {state.mode === 'generate-text' ? t('canvas.promptBar.placeholder') : generateLabel}
                    </span>
                  </>
                )}
              </button>
              {dockItems.slice(2).map((item) => {
                const Icon = item.icon;
                const isActive = panel === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => onOpen(item.id)}
                    className={cn(
                      "flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition-all active:scale-95",
                      isActive
                        ? "bg-foreground text-background"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface-sunken",
                      item.disabled && "opacity-35 cursor-not-allowed hover:bg-transparent hover:text-foreground-muted"
                    )}
                  >
                    <Icon size={18} />
                    <span className="max-w-full truncate px-1">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
          <section
            className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[1.75rem] border border-border bg-background shadow-2xl"
            style={{ maxHeight: 'min(86svh, 720px)' }}
            aria-modal="true"
            role="dialog"
          >
            <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-border-strong" />
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 pb-3 pt-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-foreground">
                  <SheetIcon size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold tracking-tight text-foreground">
                    {getSheetTitle()}
                  </h2>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-foreground-muted">
                    {getSheetDescription()}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                aria-label={t('common.close')}
              >
                <X size={17} />
              </button>
            </div>

            <div
              className="overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
              style={{ maxHeight: 'calc(min(86svh, 720px) - 78px)' }}
            >
              {panel === 'workflow' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-3">
                    <ActiveWorkflowIcon size={18} className="shrink-0 text-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{activeWorkflowLabel}</div>
                      <div className="text-xs text-foreground-muted">{t('mobile.activeWorkflow', { defaultValue: 'Current workflow' } as any)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {MOBILE_WORKFLOWS.map((workflow) => {
                      const Icon = workflow.icon;
                      const isActive = state.mode === workflow.id;
                      return (
                        <button
                          key={workflow.id}
                          type="button"
                          onClick={() => {
                            dispatch({ type: 'SET_MODE', payload: workflow.id });
                            onClose();
                          }}
                          className={cn(
                            "flex min-h-[3.5rem] min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all active:scale-[0.99]",
                            isActive
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-surface-elevated text-foreground-secondary hover:bg-surface-sunken hover:text-foreground"
                          )}
                        >
                          <Icon size={17} className="shrink-0" />
                          <span className="min-w-0 truncate text-xs font-semibold">{t(workflow.labelKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {panel === 'source' && (
                sourcePanel ? (
                  <div className="space-y-4">{sourcePanel}</div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-surface-elevated px-4 py-10 text-center">
                    <Wand2 size={22} className="mx-auto text-foreground-muted" />
                    <div className="mt-3 text-sm font-semibold text-foreground">{t('canvas.promptBar.placeholder')}</div>
                    <div className="mt-1 text-xs text-foreground-muted">
                      {t('mobile.promptInComposer', { defaultValue: 'Use the prompt composer on the workspace.' } as any)}
                    </div>
                  </div>
                )
              )}

              {panel === 'tune' && (
                <div className="space-y-4">
                  {rightPanelConfig.meta && (
                    <div className="text-xs text-foreground-muted">{rightPanelConfig.meta}</div>
                  )}
                  {tunePanel || (
                    <div className="rounded-lg border border-dashed border-border bg-surface-elevated px-4 py-10 text-center text-xs text-foreground-muted">
                      {t('rightPanel.selectWorkflow')}
                    </div>
                  )}
                </div>
              )}

              {panel === 'output' && <MobileOutputContent onClose={onClose} />}
            </div>
          </section>
        </div>
      )}
    </>
  );
};
