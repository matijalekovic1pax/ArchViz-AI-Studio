import React, { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { SectionHeader } from './SharedLeftComponents';
import { cn } from '../../../lib/utils';

export const LeftMultiAnglePanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

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
        <div className="space-y-2">
          {wf.multiAngleOutputs.length === 0 && (
            <div className="text-xs text-foreground-muted bg-surface-sunken border border-border rounded-lg p-3 text-center">
              No generated angles yet.
            </div>
          )}
          {wf.multiAngleOutputs.map((output, index) => {
            const isSelected = output.url === state.uploadedImage;
            return (
              <button
                key={output.id}
                type="button"
                onClick={() => handleSelect(output.url)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded border text-left transition-colors",
                  isSelected
                    ? "border-accent bg-accent/10"
                    : "bg-surface-elevated border-border hover:border-foreground/40"
                )}
              >
                <div className="w-10 h-10 rounded bg-surface-sunken overflow-hidden shrink-0">
                  <img src={output.url} alt={output.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{output.name || `Angle ${index + 1}`}</div>
                  <div className="text-[10px] text-foreground-muted">Click to preview</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
