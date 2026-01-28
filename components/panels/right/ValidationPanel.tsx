
import React from 'react';
import { Toggle } from '../../ui/Toggle';
import { useAppStore } from '../../../store';

export const ValidationPanel = () => {
    const { state, dispatch } = useAppStore();
    const { checks } = state.materialValidation;

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
        </div>
    );
};
