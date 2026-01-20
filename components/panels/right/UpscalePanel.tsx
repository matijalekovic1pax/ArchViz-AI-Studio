
import React, { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';

export const UpscalePanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch, wf]
  );

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Enhancement</label>
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
