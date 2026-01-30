
import React, { useCallback } from 'react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { useAppStore } from '../../../store';

export const ImageToCadPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;

    const updateWf = useCallback(
        (payload: Partial<typeof wf>) => dispatch({ type: 'UPDATE_WORKFLOW', payload }),
        [dispatch]
    );

    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Type</label>
                <SegmentedControl
                    value={wf.imgToCadOutput}
                    options={[
                        { label: 'Elevation', value: 'elevation' },
                        { label: 'Plan', value: 'plan' },
                        { label: 'Detail', value: 'detail' }
                    ]}
                    onChange={(value) => updateWf({ imgToCadOutput: value as any })}
                />
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Line Settings</label>
                <div className="space-y-3">
                    <Slider
                        label="Sensitivity"
                        value={wf.imgToCadLine.sensitivity}
                        min={0}
                        max={100}
                        onChange={(value) => updateWf({ imgToCadLine: { ...wf.imgToCadLine, sensitivity: value } })}
                    />
                    <Slider
                        label="Simplification"
                        value={wf.imgToCadLine.simplify}
                        min={0}
                        max={100}
                        onChange={(value) => updateWf({ imgToCadLine: { ...wf.imgToCadLine, simplify: value } })}
                    />
                    <Toggle
                        label="Connect Gaps"
                        checked={wf.imgToCadLine.connect}
                        onChange={(value) => updateWf({ imgToCadLine: { ...wf.imgToCadLine, connect: value } })}
                    />
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Layers</label>
                <div className="space-y-2">
                    <Toggle
                        label="Walls"
                        checked={wf.imgToCadLayers.walls}
                        onChange={(value) => updateWf({ imgToCadLayers: { ...wf.imgToCadLayers, walls: value } })}
                    />
                    <Toggle
                        label="Windows"
                        checked={wf.imgToCadLayers.windows}
                        onChange={(value) => updateWf({ imgToCadLayers: { ...wf.imgToCadLayers, windows: value } })}
                    />
                    <Toggle
                        label="Details"
                        checked={wf.imgToCadLayers.details}
                        onChange={(value) => updateWf({ imgToCadLayers: { ...wf.imgToCadLayers, details: value } })}
                    />
                    <Toggle
                        label="Hidden Lines"
                        checked={wf.imgToCadLayers.hidden}
                        onChange={(value) => updateWf({ imgToCadLayers: { ...wf.imgToCadLayers, hidden: value } })}
                    />
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Format</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mb-2">
                    {(['dxf', 'dwg', 'svg', 'pdf'] as const).map((format) => {
                        const label = format.toUpperCase();
                        const selected = wf.imgToCadFormat === format;
                        return (
                            <button
                                key={format}
                                type="button"
                                onClick={() => updateWf({ imgToCadFormat: format })}
                                className={`text-[10px] border rounded py-1.5 transition-colors ${selected ? 'border-foreground bg-foreground text-background' : 'hover:bg-surface-elevated'}`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
