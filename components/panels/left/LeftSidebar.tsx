
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { 
  Palette, FileCode, Map, Eraser, Layers, RectangleVertical, 
  Pencil, Maximize, PenTool, Cuboid, Video, Sparkles, ClipboardCheck, Camera,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GenerationMode } from '../../../types';
import { LeftRender3DPanel } from './LeftRender3DPanel';
import { LeftRenderCADPanel } from './LeftRenderCADPanel';
import { LeftMasterplanPanel } from './LeftMasterplanPanel';
import { LeftVisualEditPanel } from './LeftVisualEditPanel';
import { LeftExplodedPanel } from './LeftExplodedPanel';
import { LeftSectionPanel } from './LeftSectionPanel';
import { LeftSketchPanel } from './LeftSketchPanel';
import { LeftMultiAnglePanel } from './LeftMultiAnglePanel';
import { LeftUpscalePanel } from './LeftUpscalePanel';
import { LeftImageToCADPanel } from './LeftImageToCADPanel';
import { LeftImageTo3DPanel } from './LeftImageTo3DPanel';
import { LeftVideoPanel } from './LeftVideoPanel';
import { LeftValidationPanel } from './LeftValidationPanel';

// --- Workflow Navigation ---
const WORKFLOWS: { id: GenerationMode; labelKey: string; icon: React.ElementType }[] = [
  { id: 'generate-text', labelKey: 'workflows.generateText', icon: Sparkles },
  { id: 'render-3d', labelKey: 'workflows.render3d', icon: Palette },
  { id: 'render-cad', labelKey: 'workflows.renderCad', icon: FileCode },
  { id: 'masterplan', labelKey: 'workflows.masterplan', icon: Map },
  { id: 'visual-edit', labelKey: 'workflows.visualEdit', icon: Eraser },
  { id: 'material-validation', labelKey: 'workflows.materialValidation', icon: ClipboardCheck },
  { id: 'exploded', labelKey: 'workflows.exploded', icon: Layers },
  { id: 'section', labelKey: 'workflows.section', icon: RectangleVertical },
  { id: 'render-sketch', labelKey: 'workflows.renderSketch', icon: Pencil },
  { id: 'multi-angle', labelKey: 'workflows.multiAngle', icon: Camera },
  { id: 'upscale', labelKey: 'workflows.upscale', icon: Maximize },
  { id: 'img-to-cad', labelKey: 'workflows.imgToCad', icon: PenTool },
  { id: 'img-to-3d', labelKey: 'workflows.imgTo3d', icon: Cuboid },
  { id: 'video', labelKey: 'workflows.video', icon: Video },
];

const GenerateTextPanel = () => null;

export const LeftSidebar: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const { leftSidebarOpen } = state;
  const isGenerateTextMode = state.mode === 'generate-text';
  const showPanel = !isGenerateTextMode;

  const renderPanel = () => {
    switch (state.mode) {
      case 'generate-text': return <GenerateTextPanel />;
      case 'render-3d': return <LeftRender3DPanel />;
      case 'render-cad': return <LeftRenderCADPanel />;
      case 'material-validation': return <LeftValidationPanel />;
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
      default: return <LeftRender3DPanel />;
    }
  };

  const activeWorkflowLabel = t(WORKFLOWS.find(w => w.id === state.mode)?.labelKey || 'workflows.render3d');

  return (
    <div className="flex shrink-0 h-full">
      {/* Feature Switcher Rail - Always visible for navigation */}
      <div className="w-14 bg-surface-elevated border-r border-border flex flex-col items-center py-4 gap-4 z-20 shadow-subtle overflow-y-auto no-scrollbar group hover:w-[200px] transition-all duration-300 ease-out">
        {WORKFLOWS.map((workflow) => {
          const Icon = workflow.icon;
          const isActive = state.mode === workflow.id;
          return (
            <button
              key={workflow.id}
              onClick={() => dispatch({ type: 'SET_MODE', payload: workflow.id })}
              className={cn(
                "w-full h-10 flex items-center px-3 rounded-xl transition-all duration-200 relative shrink-0 overflow-hidden",
                isActive 
                  ? "bg-surface-sunken text-foreground" 
                  : "text-foreground-muted hover:bg-background-secondary hover:text-foreground"
              )}
              title={t(workflow.labelKey)}
            >
              <div className="min-w-[24px] flex items-center justify-center">
                <Icon size={20} strokeWidth={1.5} />
              </div>
              <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 ml-3 transition-opacity duration-200 delay-75">
                {t(workflow.labelKey)}
              </span>
              
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />}
            </button>
          );
        })}
      </div>

      {/* Specific Workflow Content Panel - HIDDEN in generate-text mode */}
      {showPanel && (leftSidebarOpen ? (
        <div className={cn(
          "bg-background-tertiary border-r border-border flex flex-col overflow-hidden transition-all relative",
          state.leftSidebarWidth ? `w-[${state.leftSidebarWidth}px]` : "w-[280px]"
        )}>
           {/* Fixed Header */}
           <div className="shrink-0 p-5 pb-3 bg-background-tertiary border-b border-border-subtle z-10 flex justify-between items-center">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{activeWorkflowLabel}</h2>
              <button 
                onClick={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })}
                className="text-foreground-muted hover:text-foreground hover:bg-surface-sunken p-1 rounded-md transition-colors"
                title={t('leftSidebar.collapse')}
              >
                <ChevronsLeft size={16} />
              </button>
           </div>
           
           {/* Scrollable Content */}
           <div className="flex-1 overflow-y-auto p-5 pt-4 custom-scrollbar">
             {renderPanel()}
           </div>
        </div>
      ) : (
        <div className="w-10 bg-background-tertiary border-r border-border relative flex flex-col items-center">
           <button 
             onClick={() => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' })}
             className="mt-4 p-1 text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-md transition-all z-30"
             title={t('leftSidebar.expand')}
           >
             <ChevronsRight size={16} />
           </button>
           <div className="flex-1 flex items-center justify-center">
              <div 
                className="whitespace-nowrap text-xs font-bold text-foreground-muted uppercase tracking-wider" 
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {activeWorkflowLabel}
              </div>
           </div>
        </div>
      ))}
    </div>
  );
};
