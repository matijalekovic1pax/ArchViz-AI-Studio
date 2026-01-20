import React, { useRef } from 'react';
import { ModelViewer3D } from '../../ui/ModelViewer3D';
import { useAppStore } from '../../../store';
import { Download, Upload, X } from 'lucide-react';

export const ImageTo3DPanel = () => {
    const { state, dispatch } = useAppStore();
    const wf = state.workflow;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updateWf = (updates: Partial<typeof wf>) => {
        dispatch({ type: 'UPDATE_WORKFLOW', payload: updates });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Store file extension for blob URL detection
            const ext = file.name.split('.').pop()?.toLowerCase() || 'glb';
            (window as any).__modelExtension = ext;

            const url = URL.createObjectURL(file);
            updateWf({ img3dGeneratedModel: url });
        }
    };

    const clearModel = () => {
        if (wf.img3dGeneratedModel?.startsWith('blob:')) {
            URL.revokeObjectURL(wf.img3dGeneratedModel);
        }
        (window as any).__modelExtension = null;
        updateWf({ img3dGeneratedModel: null });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formats = ['GLB', 'OBJ', 'FBX'] as const;
    const formatMap: Record<string, typeof wf.img3dOutputFormat> = {
        'GLB': 'glb',
        'OBJ': 'obj',
        'FBX': 'fbx',
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs text-foreground-muted mb-3 block font-bold uppercase tracking-wider">
                    3D Model Preview
                </label>
                <ModelViewer3D
                    modelUrl={wf.img3dGeneratedModel}
                    autoRotate={true}
                    showGrid={true}
                    height="400px"
                />

                {/* Temp file loader for testing */}
                <div className="mt-3 flex gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".glb,.gltf"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 border border-dashed border-border rounded text-[10px] text-foreground-muted hover:border-foreground-muted hover:bg-surface-sunken transition-all flex items-center justify-center gap-1.5"
                    >
                        <Upload size={12} />
                        Load GLB/GLTF for testing
                    </button>
                    {wf.img3dGeneratedModel && (
                        <button
                            onClick={clearModel}
                            className="px-2 py-2 border border-border rounded text-[10px] text-foreground-muted hover:text-red-400 hover:border-red-400 transition-colors"
                            title="Clear model"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {wf.img3dGeneratedModel && (
                <div className="pt-2 border-t border-border-subtle">
                    <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">
                        Export Format
                    </label>
                    <div className="flex gap-2">
                        <div className="flex-1 flex gap-1">
                            {formats.map(f => (
                                <button
                                    key={f}
                                    onClick={() => updateWf({ img3dOutputFormat: formatMap[f] })}
                                    className={`flex-1 text-[10px] border rounded py-1.5 transition-colors ${
                                        wf.img3dOutputFormat === formatMap[f]
                                            ? 'bg-accent text-white border-accent'
                                            : 'border-border hover:bg-surface-elevated'
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <button
                            className="px-3 py-1.5 bg-accent text-white rounded text-[10px] flex items-center gap-1.5 hover:bg-accent-hover transition-colors"
                            title="Download 3D Model"
                        >
                            <Download size={12} />
                            Export
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
