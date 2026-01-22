
import React, { useState } from 'react';
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
  const { rightPanelOpen, rightPanelWidth, mode } = state;
  const [showHelp, setShowHelp] = useState(false);

  if (mode === 'generate-text') return null;

  if (!rightPanelOpen) {
    return (
      <div className="w-12 bg-background-tertiary border-l border-border relative flex flex-col items-center py-4 gap-4">
        <button 
          onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-md transition-all"
          title="Expand Panel"
        >
          <ChevronsLeft size={20} />
        </button>
        <div className="flex-1 flex items-center justify-center">
            <span 
              className="text-xs font-bold text-foreground-muted uppercase tracking-widest whitespace-nowrap transform rotate-180" 
              style={{ writingMode: 'vertical-rl' }}
            >
              Settings
            </span>
        </div>
      </div>
    );
  }

  let panelContent: React.ReactNode = null;
  let panelTitle = "Settings";
  let PanelIcon = Settings;
  let panelDescription = "Adjust settings for the current workflow.";

  switch (mode) {
      case 'generate-text': 
        panelTitle = "Image Generation"; 
        PanelIcon = Sparkle; 
        panelContent = null; 
        break;
      case 'render-3d': 
        panelTitle = "3D to Render"; 
        PanelIcon = Box; 
        panelDescription = "Control geometry preservation, lighting, camera settings, and materials for converting 3D models to photorealistic renders.";
        panelContent = <Render3DPanel />; 
        break;
      case 'render-cad': 
        panelTitle = "CAD to Render"; 
        PanelIcon = FileCode; 
        panelDescription = "Configure line interpretation, spatial settings, and auto-furnishing for generating renders from CAD drawings.";
        panelContent = <CadToRenderPanel />; 
        break;
      case 'masterplan': 
        panelTitle = "Masterplan"; 
        PanelIcon = Grid; 
        panelDescription = "Set up plan types, zone detection, and landscaping options for large-scale masterplan visualizations.";
        panelContent = <MasterplanPanel />; 
        break;
      case 'visual-edit': 
        panelTitle = "Visual Editor"; 
        PanelIcon = Wrench; 
        panelDescription = "Select tools for in-painting, material swapping, and lighting adjustments on the generated image.";
        panelContent = <VisualEditPanel />; 
        break;
      case 'exploded': 
        panelTitle = "Exploded View"; 
        PanelIcon = Layers; 
        panelDescription = "Manage component separation and animation settings for creating exploded axonometric views.";
        panelContent = <ExplodedPanel />; 
        break;
      case 'section': 
        panelTitle = "Render to Section"; 
        PanelIcon = RectangleVertical; 
        panelDescription = "Define cut planes, line weights, and hatch styles for generating architectural sections.";
        panelContent = <SectionPanel />; 
        break;
      case 'render-sketch': 
        panelTitle = "Sketch to Render"; 
        PanelIcon = Brush; 
        panelDescription = "Control geometry, lighting, camera, and materials for sketch-to-render conversion.";
        panelContent = <Render3DPanel />; 
        break;
      case 'multi-angle':
        panelTitle = "Multi-Angle";
        PanelIcon = Camera;
        panelDescription = "Generate consistent views across multiple angles while keeping lighting and style locked.";
        panelContent = <MultiAnglePanel />;
        break;
      case 'upscale': 
        panelTitle = "Upscaler"; 
        PanelIcon = Maximize2; 
        panelDescription = "Configure enhancement settings and output format for higher-resolution results.";
        panelContent = <UpscalePanel />; 
        break;
      case 'img-to-cad': 
        panelTitle = "Image to CAD"; 
        PanelIcon = FileCode; 
        panelDescription = "Settings for vectorizing raster images into CAD-ready formats like DXF or DWG.";
        panelContent = <ImageToCadPanel />; 
        break;
      case 'img-to-3d':
        panelTitle = "Image to 3D";
        PanelIcon = Cuboid;
        panelDescription = "Preview and export 3D models generated from your images using SAM AI.";
        panelContent = <ImageTo3DPanel />;
        break;
      case 'video': 
        panelTitle = "Video Studio"; 
        PanelIcon = Video; 
        panelDescription = "Set duration, camera motion, and transition effects for AI video generation.";
        panelContent = <VideoPanel />; 
        break;
      case 'material-validation': 
        panelTitle = "Validation"; 
        PanelIcon = CheckCircle2; 
        panelDescription = "Review detected materials against BoQ and technical specifications.";
        panelContent = <ValidationPanel />; 
        break;
      default: 
        panelTitle = "Settings"; 
        panelContent = <div className="p-4 text-center text-xs text-foreground-muted">Select a workflow</div>;
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
                title="Toggle Help"
            >
                <HelpCircle size={14}/>
            </button>
            <button 
                onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
                className="text-foreground-muted hover:text-foreground hover:bg-surface-sunken p-1 rounded-md transition-colors"
                title="Collapse Panel"
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
                        <h4 className="text-xs font-bold text-foreground">Panel Info</h4>
                    </div>
                    <button onClick={() => setShowHelp(false)} className="text-foreground-muted hover:text-foreground">
                        <X size={12} />
                    </button>
                </div>
                <p className="text-[11px] text-foreground-secondary leading-relaxed">
                    {panelDescription}
                </p>
                <div className="mt-3 pt-2 border-t border-border-subtle flex justify-end">
                    <a href="#" className="text-[10px] text-accent hover:underline font-medium">View Documentation →</a>
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
