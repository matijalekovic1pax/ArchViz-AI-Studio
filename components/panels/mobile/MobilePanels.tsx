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
  Cuboid,
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
  X
} from 'lucide-react';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { GenerationMode } from '../../../types';
import { LeftRender3DPanel } from '../left/LeftRender3DPanel';
import { LeftRenderCADPanel } from '../left/LeftRenderCADPanel';
import { LeftMasterplanPanel } from '../left/LeftMasterplanPanel';
import { LeftVisualEditPanel } from '../left/LeftVisualEditPanel';
import { LeftExplodedPanel } from '../left/LeftExplodedPanel';
import { LeftSectionPanel } from '../left/LeftSectionPanel';
import { LeftSketchPanel } from '../left/LeftSketchPanel';
import { LeftMultiAnglePanel } from '../left/LeftMultiAnglePanel';
import { LeftUpscalePanel } from '../left/LeftUpscalePanel';
import { LeftImageToCADPanel } from '../left/LeftImageToCADPanel';
import { LeftImageTo3DPanel } from '../left/LeftImageTo3DPanel';
import { LeftVideoPanel } from '../left/LeftVideoPanel';
import { LeftValidationPanel } from '../left/LeftValidationPanel';
import { LeftDocumentTranslatePanel } from '../left/LeftDocumentTranslatePanel';
import { LeftPdfCompressionPanel } from '../left/LeftPdfCompressionPanel';
import { Render3DPanel } from '../right/Render3DPanel';
import { CadToRenderPanel } from '../right/CadToRenderPanel';
import { MasterplanPanel } from '../right/MasterplanPanel';
import { VisualEditPanel } from '../right/VisualEditPanel';
import { ExplodedPanel } from '../right/ExplodedPanel';
import { SectionPanel } from '../right/SectionPanel';
import { MultiAnglePanel } from '../right/MultiAnglePanel';
import { UpscalePanel } from '../right/UpscalePanel';
import { ImageToCadPanel } from '../right/ImageToCadPanel';
import { ImageTo3DPanel } from '../right/ImageTo3DPanel';
import { VideoPanel } from '../right/VideoPanel';
import { ValidationPanel } from '../right/ValidationPanel';
import { DocumentTranslatePanel } from '../right/DocumentTranslatePanel';
import { PdfCompressionPanel } from '../right/PdfCompressionPanel';

export type MobilePanelType = 'workflow' | 'settings' | null;

const WORKFLOWS: { id: GenerationMode; labelKey: string; icon: React.ElementType }[] = [
  { id: 'generate-text', labelKey: 'workflows.generateText', icon: Sparkles },
  { id: 'render-3d', labelKey: 'workflows.render3d', icon: Palette },
  { id: 'render-cad', labelKey: 'workflows.renderCad', icon: FileCode },
  { id: 'masterplan', labelKey: 'workflows.masterplan', icon: Map },
  { id: 'visual-edit', labelKey: 'workflows.visualEdit', icon: Eraser },
  { id: 'material-validation', labelKey: 'workflows.materialValidation', icon: ClipboardCheck },
  { id: 'document-translate', labelKey: 'workflows.documentTranslate', icon: Languages },
  { id: 'pdf-compression', labelKey: 'workflows.pdfCompression', icon: FileDown },
  { id: 'exploded', labelKey: 'workflows.exploded', icon: Layers },
  { id: 'section', labelKey: 'workflows.section', icon: RectangleVertical },
  { id: 'render-sketch', labelKey: 'workflows.renderSketch', icon: Pencil },
  { id: 'multi-angle', labelKey: 'workflows.multiAngle', icon: Camera },
  { id: 'upscale', labelKey: 'workflows.upscale', icon: Maximize },
  { id: 'img-to-cad', labelKey: 'workflows.imgToCad', icon: PenTool },
  { id: 'img-to-3d', labelKey: 'workflows.imgTo3d', icon: Cuboid },
  { id: 'video', labelKey: 'workflows.video', icon: Video },
];

const renderLeftPanel = (mode: GenerationMode) => {
  switch (mode) {
    case 'render-3d': return <LeftRender3DPanel />;
    case 'render-cad': return <LeftRenderCADPanel />;
    case 'material-validation': return <LeftValidationPanel />;
    case 'document-translate': return <LeftDocumentTranslatePanel />;
    case 'pdf-compression': return <LeftPdfCompressionPanel />;
    case 'masterplan': return <LeftMasterplanPanel />;
    case 'visual-edit': return <LeftVisualEditPanel />;
    case 'exploded': return <LeftExplodedPanel />;
    case 'section': return <LeftSectionPanel />;
    case 'render-sketch': return <LeftSketchPanel />;
    case 'multi-angle': return <LeftMultiAnglePanel />;
    case 'upscale': return <LeftUpscalePanel />;
    case 'img-to-cad': return <LeftImageToCADPanel />;
    case 'img-to-3d': return <LeftImageTo3DPanel />;
    case 'video': return <LeftVideoPanel />;
    default: return null;
  }
};

const renderRightPanel = (mode: GenerationMode) => {
  switch (mode) {
    case 'render-3d': return <Render3DPanel />;
    case 'render-cad': return <CadToRenderPanel />;
    case 'masterplan': return <MasterplanPanel />;
    case 'visual-edit': return <VisualEditPanel />;
    case 'exploded': return <ExplodedPanel />;
    case 'section': return <SectionPanel />;
    case 'render-sketch': return <Render3DPanel />;
    case 'multi-angle': return <MultiAnglePanel />;
    case 'upscale': return <UpscalePanel />;
    case 'img-to-cad': return <ImageToCadPanel />;
    case 'img-to-3d': return <ImageTo3DPanel />;
    case 'video': return <VideoPanel />;
    case 'material-validation': return <ValidationPanel />;
    case 'document-translate': return <DocumentTranslatePanel />;
    case 'pdf-compression': return <PdfCompressionPanel />;
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

const getRightPanelConfig = (mode: GenerationMode, t: (key: string) => string, meta?: string | null) => {
  switch (mode) {
    case 'render-3d':
      return { title: t('rightPanel.render3d.title'), description: t('rightPanel.render3d.description'), icon: Box, meta };
    case 'render-cad':
      return { title: t('rightPanel.renderCad.title'), description: t('rightPanel.renderCad.description'), icon: FileCode, meta };
    case 'masterplan':
      return { title: t('rightPanel.masterplan.title'), description: t('rightPanel.masterplan.description'), icon: Grid, meta };
    case 'visual-edit':
      return { title: t('rightPanel.visualEdit.title'), description: t('rightPanel.visualEdit.description'), icon: Wrench, meta };
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
    case 'img-to-3d':
      return { title: t('rightPanel.imgTo3d.title'), description: t('rightPanel.imgTo3d.description'), icon: Cuboid, meta };
    case 'video':
      return { title: t('rightPanel.video.title'), description: t('rightPanel.video.description'), icon: Video, meta };
    case 'material-validation':
      return { title: t('rightPanel.materialValidation.title'), description: t('rightPanel.materialValidation.description'), icon: CheckCircle2, meta };
    case 'document-translate':
      return { title: t('rightPanel.documentTranslate.title'), description: t('rightPanel.documentTranslate.description'), icon: Languages, meta };
    case 'pdf-compression':
      return { title: t('rightPanel.pdfCompression.title'), description: t('rightPanel.pdfCompression.description'), icon: FileDown, meta };
    default:
      return { title: t('rightPanel.settings.title'), description: t('rightPanel.settings.description'), icon: Settings, meta };
  }
};

export const MobilePanels: React.FC<{ active: MobilePanelType; onClose: () => void }> = ({ active, onClose }) => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();

  if (!active) return null;

  const activeWorkflowLabel = t(WORKFLOWS.find(w => w.id === state.mode)?.labelKey || 'workflows.render3d');
  const meta = getRightPanelMeta(
    state.mode,
    state.workflow.pdfCompression.remainingFiles,
    state.workflow.pdfCompression.remainingCredits,
    t
  );
  const rightPanelConfig = getRightPanelConfig(state.mode, t, meta);
  const RightPanelIcon = rightPanelConfig.icon;

  return (
    <div className="fixed inset-0 z-[80] lg:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 bg-background flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated">
          <div className="flex items-center gap-2">
            {active === 'workflow' ? (
              <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center text-xs font-bold">
                AV
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-surface-sunken flex items-center justify-center">
                <RightPanelIcon size={16} className="text-foreground" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {active === 'workflow' ? t('leftSidebar.workflow') : rightPanelConfig.title}
              </span>
              <span className="text-[10px] text-foreground-muted">
                {active === 'workflow' ? activeWorkflowLabel : rightPanelConfig.description}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-foreground-muted hover:text-foreground hover:bg-surface-sunken transition-colors"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-[env(safe-area-inset-bottom)]">
          {active === 'workflow' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {WORKFLOWS.map((workflow) => {
                  const Icon = workflow.icon;
                  const isActive = state.mode === workflow.id;
                  return (
                    <button
                      key={workflow.id}
                      type="button"
                      onClick={() => dispatch({ type: 'SET_MODE', payload: workflow.id })}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "bg-foreground text-background border-foreground"
                          : "bg-surface-elevated border-border text-foreground-secondary hover:text-foreground hover:bg-surface-sunken"
                      )}
                    >
                      <Icon size={16} />
                      <span className="text-xs font-semibold">{t(workflow.labelKey)}</span>
                    </button>
                  );
                })}
              </div>

              {state.mode !== 'generate-text' && (
                <div className="bg-surface-elevated border border-border rounded-xl p-4 shadow-subtle">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-3">
                    {t('leftSidebar.parameters')}
                  </div>
                  {renderLeftPanel(state.mode)}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {rightPanelConfig.meta && (
                <div className="text-[11px] text-foreground-muted">
                  {rightPanelConfig.meta}
                </div>
              )}
              <div className="bg-surface-elevated border border-border rounded-xl p-4 shadow-subtle">
                {renderRightPanel(state.mode) || (
                  <div className="text-xs text-foreground-muted text-center py-6">
                    {t('rightPanel.selectWorkflow')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
