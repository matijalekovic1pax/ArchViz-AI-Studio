import React, { useRef } from 'react';
import { Undo, Redo, ZoomIn, ZoomOut, Save, Upload, RotateCcw, Image as ImageIcon, FileJson, Video, Download } from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';

export const TopBar: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isVideoMode = state.mode === 'video';

  const handleExportProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `archviz-project-${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleDownloadResult = () => {
    if (!state.uploadedImage) return;
    
    // Determine extension based on mode or output settings
    const ext = isVideoMode ? 'mp4' : (state.output.format || 'png');
    const prefix = isVideoMode ? 'archviz-video' : 'archviz-render';
    const filename = `${prefix}-${Date.now()}.${ext}`;

    const downloadLink = document.createElement('a');
    downloadLink.href = state.uploadedImage;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
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

  return (
    <header className="h-16 bg-surface-elevated border-b border-border flex items-center justify-between px-6 shrink-0 z-20 shadow-sm relative">
      {/* Left: Branding & Utility */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-md">
            <span className="text-surface-elevated font-bold text-sm">AV</span>
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">ArchViz Studio</h1>
            <p className="text-[10px] text-foreground-muted">Stateless Session</p>
          </div>
        </div>

        <div className="h-6 w-px bg-border-strong" />

        {/* Toolbar moved left to clear space for the central save button */}
        <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-lg border border-border-subtle">
          <button className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-md transition-all" title="Undo">
            <Undo size={14} />
          </button>
          <button className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-md transition-all" title="Redo">
            <Redo size={14} />
          </button>
          <div className="w-px h-3 bg-border mx-1" />
          <button className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-md transition-all">
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-mono w-8 text-center text-foreground-muted">100%</span>
          <button className="p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-md transition-all">
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Subtle Project Management Tools */}
        <div className="flex items-center gap-1 mr-2">
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
              <Upload size={16} />
            </button>

            {/* Subtle Save Project Button */}
            <button 
              onClick={handleExportProject}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-surface-sunken rounded-full transition-colors"
              title="Save Project State (JSON)"
            >
              <FileJson size={14} />
              <span>Save Project</span>
            </button>
        </div>

        {/* Conspicuous Primary Action */}
        <button 
           onClick={handleDownloadResult}
           disabled={!state.uploadedImage}
           className={cn(
             "h-10 px-6 rounded-full transition-all duration-200 flex items-center gap-2.5 text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5",
             state.uploadedImage 
               ? "bg-foreground text-background" 
               : "bg-surface-sunken text-foreground-muted cursor-not-allowed shadow-none"
           )}
           title={!state.uploadedImage ? "Generate output first" : isVideoMode ? "Download MP4 Video" : "Download Render Image"}
        >
           {isVideoMode ? <Video size={18} /> : <Download size={18} />}
           <span>{isVideoMode ? "Download Video" : "Download Result"}</span>
        </button>
      </div>
    </header>
  );
};