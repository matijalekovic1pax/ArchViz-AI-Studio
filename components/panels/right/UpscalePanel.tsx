import React, { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';

export const UpscalePanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch]
  );

  const resolutionOptions: Array<{ value: '2k' | '4k' | '8k'; label: string; title?: string }> = [
    { value: '2k', label: '2K' },
    { value: '4k', label: '4K' },
    { value: '8k', label: '8K', title: '8K (API capped at 4K)' },
  ];

  const handleResolutionChange = (resolution: '2k' | '4k' | '8k') => {
    if (resolution === state.output.resolution) return;
    dispatch({ type: 'UPDATE_OUTPUT', payload: { resolution } });
  };

  return (
    <div className="space-y-6">
      {/* Resolution */}
      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
          Resolution
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {resolutionOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              title={option.title || `Set ${option.label} output resolution`}
              onClick={() => handleResolutionChange(option.value)}
              className={cn(
                "text-[11px] font-semibold uppercase border rounded py-2 transition-colors",
                state.output.resolution === option.value
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "border-border text-foreground-secondary hover:text-foreground hover:bg-surface-elevated"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Enhancement Sliders */}
      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
          Enhancement
        </label>
        <div className="space-y-4">
          <div className="space-y-2">
            <Slider
              label="Sharpness"
              value={wf.upscaleSharpness}
              min={0}
              max={100}
              onChange={(value) => updateWf({ upscaleSharpness: value })}
            />
            <div className="flex items-center justify-between text-[10px] text-foreground-muted">
              <span>Soft</span>
              <span>Crisp</span>
            </div>
          </div>
          <div className="space-y-2">
            <Slider
              label="Clarity"
              value={wf.upscaleClarity}
              min={0}
              max={100}
              onChange={(value) => updateWf({ upscaleClarity: value })}
            />
            <div className="flex items-center justify-between text-[10px] text-foreground-muted">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
          <div className="space-y-2">
            <Slider
              label="Edge Definition"
              value={wf.upscaleEdgeDefinition}
              min={0}
              max={100}
              onChange={(value) => updateWf({ upscaleEdgeDefinition: value })}
            />
            <div className="flex items-center justify-between text-[10px] text-foreground-muted">
              <span>Soft</span>
              <span>Sharp</span>
            </div>
          </div>
          <div className="space-y-2">
            <Slider
              label="Fine Detail"
              value={wf.upscaleFineDetail}
              min={0}
              max={100}
              onChange={(value) => updateWf({ upscaleFineDetail: value })}
            />
            <div className="flex items-center justify-between text-[10px] text-foreground-muted">
              <span>Smooth</span>
              <span>Detail</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
