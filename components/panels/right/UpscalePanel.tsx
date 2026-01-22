import React, { useCallback } from 'react';
import { useAppStore } from '../../../store';
import { Slider } from '../../ui/Slider';
import { Toggle } from '../../ui/Toggle';
import { Accordion } from '../../ui/Accordion';

export const UpscalePanel = () => {
  const { state, dispatch } = useAppStore();
  const wf = state.workflow;

  const updateWf = useCallback(
    (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
    [dispatch]
  );

  const formats = ['png', 'jpg', 'tiff'] as const;

  return (
    <div className="space-y-6">
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

      {/* Output Section */}
      <Accordion
        items={[
          {
            id: 'output',
            title: 'Output',
            content: (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-foreground-muted mb-2 block">
                    Format
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {formats.map((format) => (
                      <button
                        key={format}
                        onClick={() => updateWf({ upscaleFormat: format })}
                        className={`text-[10px] uppercase border rounded py-1.5 transition-colors ${
                          wf.upscaleFormat === format
                            ? 'bg-accent text-white border-accent'
                            : 'border-border hover:bg-surface-elevated'
                        }`}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle
                  label="Preserve Metadata"
                  checked={wf.upscalePreserveMetadata}
                  onChange={(checked) => updateWf({ upscalePreserveMetadata: checked })}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
