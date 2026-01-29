
import React from 'react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { Settings, Wrench } from 'lucide-react';

export const ImageToCadPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Type</label>
                <SegmentedControl value="plan" options={[{label:'Elevation', value:'elev'}, {label:'Plan', value:'plan'}, {label:'Detail', value:'detail'}]} onChange={()=>{}} />
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Line Settings</label>
                <div className="space-y-3">
                    <Slider label="Sensitivity" value={50} min={0} max={100} onChange={()=>{}} />
                    <Slider label="Simplification" value={20} min={0} max={100} onChange={()=>{}} />
                    <Toggle label="Connect Gaps" checked={true} onChange={()=>{}} />
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Layers</label>
                <div className="space-y-1">
                    {['Walls', 'Windows', 'Details', 'Hidden Lines'].map(l => (
                        <div key={l} className="flex justify-between items-center p-1.5 bg-surface-elevated border border-border rounded text-xs">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 bg-black rounded-full"/> {l}</span>
                            <Settings size={12} className="text-foreground-muted" />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Scale</label>
                <div className="flex gap-2">
                    <input className="flex-1 h-8 bg-surface-sunken border border-border rounded px-2 text-xs" placeholder="1:100" />
                    <button className="px-3 border rounded hover:bg-surface-elevated"><Wrench size={12}/></button>
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Format</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mb-2">
                    {['DXF', 'DWG', 'SVG', 'PDF'].map(f => <button key={f} className="text-[10px] border rounded py-1.5 hover:bg-surface-elevated">{f}</button>)}
                </div>
            </div>
        </div>
    );
};
