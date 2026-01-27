
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store';
import { 
  Box, FileCode, Grid, Eraser, Layers, RectangleVertical, Pencil, Maximize2, Cuboid, Video, CheckCircle2, Settings, 
  ChevronsRight, ChevronsLeft, HelpCircle, Sparkle, Wrench, Brush, X, Info, Camera
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Render3DPanel } from './Render3DPanel';
import { CadToRenderPanel } from './CadToRenderPanel';
import { MasterplanPanel } from './MasterplanPanel';
import { VisualEditPanel } from './VisualEditPanel';
import { ExplodedPanel } from './ExplodedPanel';
import { SectionPanel } from './SectionPanel';
import { MultiAnglePanel } from './MultiAnglePanel';
import { UpscalePanel } from './UpscalePanel';
import { ImageToCadPanel } from './ImageToCadPanel';
import { ImageTo3DPanel } from './ImageTo3DPanel';
import { VideoPanel } from './VideoPanel';
import { ValidationPanel } from './ValidationPanel';

export const RightPanel: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { t } = useTranslation();
  const { rightPanelOpen, rightPanelWidth, mode } = state;
  const [showHelp, setShowHelp] = useState(false);

  if (mode === 'generate-text') return null;

  if (!rightPanelOpen) {
    return (
      <div className="w-12 bg-background-tertiary border-l border-border relative flex flex-col items-center py-4 gap-4">
        <button 
          onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-md transition-all"
          title={t('rightPanel.expand')}
        >
          <ChevronsLeft size={20} />
        </button>
        <div className="flex-1 flex items-center justify-center">
            <span 
              className="text-xs font-bold text-foreground-muted uppercase tracking-widest whitespace-nowrap transform rotate-180" 
              style={{ writingMode: 'vertical-rl' }}
            >
              {t('rightPanel.settings.title')}
            </span>
        </div>
      </div>
    );
  }

  let panelContent: React.ReactNode = null;
  let panelTitle = t('rightPanel.settings.title');
  let PanelIcon = Settings;
  let panelDescription = t('rightPanel.settings.description');

  switch (mode) {
      case 'generate-text': 
        panelTitle = t('rightPanel.generateText.title'); 
        PanelIcon = Sparkle; 
        panelContent = null; 
        break;
      case 'render-3d': 
        panelTitle = t('rightPanel.render3d.title'); 
        PanelIcon = Box; 
        panelDescription = t('rightPanel.render3d.description');
        panelContent = <Render3DPanel />; 
        break;
      case 'render-cad': 
        panelTitle = t('rightPanel.renderCad.title'); 
        PanelIcon = FileCode; 
        panelDescription = t('rightPanel.renderCad.description');
        panelContent = <CadToRenderPanel />; 
        break;
      case 'masterplan': 
        panelTitle = t('rightPanel.masterplan.title'); 
        PanelIcon = Grid; 
        panelDescription = t('rightPanel.masterplan.description');
        panelContent = <MasterplanPanel />; 
        break;
      case 'visual-edit': 
        panelTitle = t('rightPanel.visualEdit.title'); 
        PanelIcon = Wrench; 
        panelDescription = t('rightPanel.visualEdit.description');
        panelContent = <VisualEditPanel />; 
        break;
      case 'exploded': 
        panelTitle = t('rightPanel.exploded.title'); 
        PanelIcon = Layers; 
        panelDescription = t('rightPanel.exploded.description');
        panelContent = <ExplodedPanel />; 
        break;
      case 'section': 
        panelTitle = t('rightPanel.section.title'); 
        PanelIcon = RectangleVertical; 
        panelDescription = t('rightPanel.section.description');
        panelContent = <SectionPanel />; 
        break;
      case 'render-sketch': 
        panelTitle = t('rightPanel.renderSketch.title'); 
        PanelIcon = Brush; 
        panelDescription = t('rightPanel.renderSketch.description');
        panelContent = <Render3DPanel />; 
        break;
      case 'multi-angle':
        panelTitle = t('rightPanel.multiAngle.title');
        PanelIcon = Camera;
        panelDescription = t('rightPanel.multiAngle.description');
        panelContent = <MultiAnglePanel />;
        break;
      case 'upscale': 
        panelTitle = t('rightPanel.upscale.title'); 
        PanelIcon = Maximize2; 
        panelDescription = t('rightPanel.upscale.description');
        panelContent = <UpscalePanel />; 
        break;
      case 'img-to-cad': 
        panelTitle = t('rightPanel.imgToCad.title'); 
        PanelIcon = FileCode; 
        panelDescription = t('rightPanel.imgToCad.description');
        panelContent = <ImageToCadPanel />; 
        break;
      case 'img-to-3d':
        panelTitle = t('rightPanel.imgTo3d.title');
        PanelIcon = Cuboid;
        panelDescription = t('rightPanel.imgTo3d.description');
        panelContent = <ImageTo3DPanel />;
        break;
      case 'video': 
        panelTitle = t('rightPanel.video.title'); 
        PanelIcon = Video; 
        panelDescription = t('rightPanel.video.description');
        panelContent = <VideoPanel />; 
        break;
      case 'material-validation': 
        panelTitle = t('rightPanel.materialValidation.title'); 
        PanelIcon = CheckCircle2; 
        panelDescription = t('rightPanel.materialValidation.description');
        panelContent = <ValidationPanel />; 
        break;
      default: 
        panelTitle = t('rightPanel.settings.title'); 
        panelContent = <div className="p-4 text-center text-xs text-foreground-muted">{t('rightPanel.selectWorkflow')}</div>;
  }

  // Use wider panel for img-to-3d mode to accommodate the 3D viewer
  const panelWidth = mode === 'img-to-3d' ? 380 : (rightPanelWidth || 320);

  return (
    <div
      className={cn(
        "bg-background-tertiary border-l border-border flex flex-col overflow-hidden transition-all relative z-10"
      )}
      style={{ width: `${panelWidth}px` }}
    >
      <div className="shrink-0 p-5 pb-3 bg-background-tertiary border-b border-border-subtle flex justify-between items-center relative">
          <div className="flex items-center gap-2">
              <PanelIcon size={16} className="text-foreground-secondary"/>
              <h2 className="text-sm font-bold tracking-tight text-foreground">{panelTitle}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button 
                className={cn("text-foreground-muted hover:text-foreground p-1 rounded-md transition-colors", showHelp && "bg-surface-sunken text-foreground")}
                onClick={() => setShowHelp(!showHelp)}
                title={t('rightPanel.toggleHelp')}
            >
                <HelpCircle size={14}/>
            </button>
            <button 
                onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
                className="text-foreground-muted hover:text-foreground hover:bg-surface-sunken p-1 rounded-md transition-colors"
                title={t('rightPanel.collapse')}
            >
                <ChevronsRight size={16} />
            </button>
          </div>

          {/* Help Popover */}
          {showHelp && (
            <div className="absolute top-12 right-4 w-64 bg-surface-elevated border border-border rounded-lg shadow-elevated p-4 z-50 animate-fade-in origin-top-right">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 text-accent">
                        <Info size={14} />
                        <h4 className="text-xs font-bold text-foreground">{t('rightPanel.panelInfo')}</h4>
                    </div>
                    <button onClick={() => setShowHelp(false)} className="text-foreground-muted hover:text-foreground">
                        <X size={12} />
                    </button>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                    {panelDescription}
                </p>
                <div className="mt-3 pt-2 border-t border-border-subtle flex justify-end">
                    <a href="#" className="text-[10px] text-accent hover:underline font-medium">{t('rightPanel.viewDocs')}</a>
                </div>
                
                {/* Little triangle arrow pointing up */}
                <div className="absolute -top-1.5 right-8 w-3 h-3 bg-surface-elevated border-t border-l border-border transform rotate-45" />
            </div>
          )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
         {panelContent}
      </div>
    </div>
  );
};
