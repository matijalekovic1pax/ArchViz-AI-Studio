import React, { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { Download, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const LeftMultiAnglePanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const getExtension = useCallback((dataUrl: string) => {
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

  const downloadOutput = useCallback(async (url: string, index: number) => {
    if (!url) return;
    const filename = `multi-angle-${index + 1}-${Date.now()}.png`;
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
      img.src = url;
    });

    try {
      await exportAsPng();
    } catch (error) {
      console.error('Multi-angle PNG export failed, falling back to original.', error);
      const ext = getExtension(url);
      const fallbackName = `multi-angle-${index + 1}-${Date.now()}.${ext}`;
      try {
        const response = await fetch(url);
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
        console.error('Multi-angle download failed, falling back to direct link.', fallbackError);
        const link = document.createElement('a');
        link.href = url;
        link.download = fallbackName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [getExtension]);

  const downloadOutputs = useCallback((outputs: typeof wf.multiAngleOutputs) => {
    outputs.forEach((output, index) => {
      window.setTimeout(() => {
        void downloadOutput(output.url, index);
      }, index * 120);
    });
  }, [downloadOutput]);

  const selectedOutputs = useMemo(
    () => wf.multiAngleOutputs.filter((output) => selectedIds.has(output.id)),
    [selectedIds, wf.multiAngleOutputs]
  );

  const handleSelect = useCallback(
    (url: string) => {
      dispatch({ type: 'SET_IMAGE', payload: url });
      dispatch({ type: 'SET_CANVAS_PAN', payload: { x: 0, y: 0 } });
      dispatch({ type: 'SET_CANVAS_ZOOM', payload: 1 });
    },
    [dispatch]
  );

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title="Generated Views" />
        <div className="flex items-center justify-between gap-2 pb-2">
          <button
            type="button"
            onClick={() => downloadOutputs(wf.multiAngleOutputs)}
            disabled={wf.multiAngleOutputs.length === 0}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
              wf.multiAngleOutputs.length === 0
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
              if (selectMode) {
                setSelectedIds(new Set());
              }
              setSelectMode((prev) => !prev);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
              selectMode
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-foreground-muted hover:text-foreground hover:bg-surface-sunken"
            )}
          >
            <Check size={12} />
            {selectMode ? 'Cancel' : 'Select'}
          </button>
          {selectMode && (
            <button
              type="button"
              onClick={() => downloadOutputs(selectedOutputs)}
              disabled={selectedOutputs.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
                selectedOutputs.length === 0
                  ? "border-border text-foreground-muted/60 cursor-not-allowed"
                  : "border-accent text-white bg-accent hover:bg-accent/90"
              )}
            >
              <Download size={12} />
              Download Selected {selectedOutputs.length > 0 ? `(${selectedOutputs.length})` : ''}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {wf.multiAngleOutputs.length === 0 && (
            <div className="text-xs text-foreground-muted bg-surface-sunken border border-border rounded-lg p-3 text-center">
              No generated angles yet.
            </div>
          )}
          {wf.multiAngleOutputs.map((output, index) => {
            const isSelected = output.url === state.uploadedImage;
            const isChecked = selectedIds.has(output.id);
            return (
              <button
                key={output.id}
                type="button"
                onClick={() => {
                  if (selectMode) {
                    toggleSelection(output.id);
                    return;
                  }
                  handleSelect(output.url);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded border text-left transition-colors relative",
                  selectMode
                    ? isChecked
                      ? "border-accent bg-accent/10"
                      : "bg-surface-elevated border-border hover:border-foreground/40"
                    : isSelected
                      ? "border-accent bg-accent/10"
                      : "bg-surface-elevated border-border hover:border-foreground/40"
                )}
              >
                <div className="w-10 h-10 rounded bg-surface-sunken overflow-hidden shrink-0">
                  <img src={output.url} alt={output.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{output.name || `Angle ${index + 1}`}</div>
                  <div className="text-[10px] text-foreground-muted">
                    {selectMode ? 'Click to select' : 'Click to preview'}
                  </div>
                </div>
                {selectMode && (
                  <div className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center border text-white",
                    isChecked ? "bg-accent border-accent" : "bg-black/30 border-white/30"
                  )}>
                    {isChecked ? <Check size={12} /> : null}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
