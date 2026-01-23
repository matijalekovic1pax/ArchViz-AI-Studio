
import React from 'react';
import { Play } from 'lucide-react';
import { Toggle } from '../../ui/Toggle';
import { useAppStore } from '../../../store';
import { useGeneration } from '../../../hooks/useGeneration';

export const ValidationPanel = () => {
    const { state, dispatch } = useAppStore();
    const { generate, isReady } = useGeneration();
    const { checks, isRunning } = state.materialValidation;

    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-3">Checks</h4>
                <div className="space-y-2">
                    <Toggle
                        label="Dimensions"
                        checked={checks.dimensions}
                        onChange={(checked) =>
                            dispatch({
                                type: 'UPDATE_MATERIAL_VALIDATION',
                                payload: { checks: { ...checks, dimensions: checked } }
                            })
                        }
                    />
                    <Toggle
                        label="Product Refs"
                        checked={checks.productRefs}
                        onChange={(checked) =>
                            dispatch({
                                type: 'UPDATE_MATERIAL_VALIDATION',
                                payload: { checks: { ...checks, productRefs: checked } }
                            })
                        }
                    />
                    <Toggle
                        label="Quantities"
                        checked={checks.quantities}
                        onChange={(checked) =>
                            dispatch({
                                type: 'UPDATE_MATERIAL_VALIDATION',
                                payload: { checks: { ...checks, quantities: checked } }
                            })
                        }
                    />
                </div>
            </div>
            <div className="pt-4 border-t border-border-subtle">
                <button
                    onClick={() => generate()}
                    disabled={!isReady || isRunning}
                    className="w-full py-2 bg-foreground text-background rounded text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                    <Play size={12} fill="currentColor"/> Run Validation
                </button>
            </div>
        </div>
    );
};
