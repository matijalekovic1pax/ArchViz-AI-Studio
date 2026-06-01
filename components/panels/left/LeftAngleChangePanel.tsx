import React, { useCallback, useMemo, useState } from 'react';
import { Camera, Check, Download, RotateCcw, RotateCw } from 'lucide-react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';
import { downloadImagesSequentially } from '../../../lib/download';

const formatRotation = (rotation: number) => {
  if (Math.abs(rotation) < 3) return 'Original angle';
  return `${Math.abs(rotation)}° ${rotation < 0 ? 'left angle' : 'right angle'}`;
};

const getRotationIcon = (rotation: number) => {
  if (Math.abs(rotation) < 3) return Camera;
  return rotation < 0 ? RotateCcw : RotateCw;
};

export const LeftAngleChangePanel = () => {
  const { state, dispatch } = useAppStore();
  const outputs = state.workflow.angleChangeOutputs;
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedOutputs = useMemo(
    () => outputs.filter((output) => selectedIds.has(output.id)),
    [outputs, selectedIds]
  );

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

  const downloadOutputs = useCallback(async (items: typeof outputs) => {
    const downloadList = items.map((output, index) => ({
      source: output.url,
      filename: `angle-change-${index + 1}-${output.createdAt}.png`,
    }));
    await downloadImagesSequentially(downloadList);
  }, []);

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
            onClick={() => downloadOutputs(outputs)}
            disabled={outputs.length === 0}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors",
              outputs.length === 0
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
          {outputs.length === 0 && (
            <div className="rounded-lg border border-border bg-surface-sunken p-3 text-center text-xs text-foreground-muted">
              No shifted views yet.
            </div>
          )}

          {outputs.map((output) => {
            const isActive = output.url === state.uploadedImage;
            const isChecked = selectedIds.has(output.id);
            const RotationIcon = getRotationIcon(output.rotation);
            const pitch = output.pitch ?? 0;
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
                  "relative flex w-full items-center gap-3 rounded border p-2 text-left transition-colors",
                  selectMode
                    ? isChecked
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface-elevated hover:border-foreground/40"
                    : isActive
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface-elevated hover:border-foreground/40"
                )}
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-surface-sunken">
                  <img src={output.url} alt={output.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <RotationIcon size={12} className="shrink-0 text-foreground-muted" />
                    <div className="truncate text-xs font-medium">
                      {output.name || formatRotation(output.rotation)}
                    </div>
                  </div>
                  <div className="mt-0.5 text-[10px] text-foreground-muted">
                    {formatRotation(output.rotation)}
                    {pitch !== 0 ? `, ${Math.abs(pitch)}° ${pitch > 0 ? 'up' : 'down'}` : ''}
                  </div>
                </div>
                {selectMode && (
                  <div className={cn(
                    "absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border text-white",
                    isChecked ? "border-accent bg-accent" : "border-white/30 bg-black/30"
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
