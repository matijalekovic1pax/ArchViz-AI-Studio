
import React from 'react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Focus, Eye, ArrowDown, ArrowUp } from 'lucide-react';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';

export const CadToRenderPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">View Type</label>
                <SegmentedControl value="exterior" options={[{label:'Ext', value:'exterior'}, {label:'Int', value:'interior'}, {label:'Aerial', value:'aerial'}, {label:'Street', value:'street'}]} onChange={()=>{}} />
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Camera Angle</label>
                <div className="flex gap-2">
                    {[
                        { icon: ArrowDown, label: 'High' },
                        { icon: Eye, label: 'Eye' },
                        { icon: ArrowUp, label: 'Low' },
                        { icon: Focus, label: 'Free' },
                    ].map((item, i) => (
                        <button key={i} className={cn(
                            "flex-1 py-3 border border-border rounded hover:bg-surface-elevated hover:border-foreground-muted transition-all flex flex-col items-center gap-1",
                            i === 1 ? "bg-surface-sunken border-foreground/30 shadow-inner" : ""
                        )}>
                            <item.icon size={16} className="text-foreground-secondary" />
                            <span className="text-[9px] font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Spatial</label>
                <div className="space-y-3">
                    <Slider label="Ceiling Height" value={2.8} min={2} max={10} unit="m" onChange={()=>{}} />
                    <Slider label="Floor Thickness" value={0.3} min={0.1} max={1} unit="m" onChange={()=>{}} />
                    <Slider label="Wall Thickness" value={0.2} min={0.1} max={1} unit="m" onChange={()=>{}} />
                    <Slider label="Interpretation" value={50} min={0} max={100} unit="%" onChange={()=>{}} />
                </div>
            </div>

            <Accordion items={[
                { id: 'furn', title: 'Furniture', content: (
                    <div className="space-y-3">
                        <Toggle label="Auto-furnish" checked={true} onChange={()=>{}} />
                        <div className="pl-2 border-l-2 border-border-subtle space-y-2">
                            <Toggle label="By Room Type" checked={true} onChange={()=>{}} />
                            <select className="w-full bg-surface-sunken border border-border rounded text-xs h-8 px-2">
                                <option>Modern Minimalist</option>
                                <option>Mid-Century</option>
                                <option>Scandinavian</option>
                                <option>Industrial</option>
                            </select>
                            <Slider label="Density" value={60} min={0} max={100} onChange={()=>{}} />
                        </div>
                    </div>
                )},
                { id: 'out', title: 'Output', content: (
                    <div className="space-y-3">
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>High Quality (4K)</option><option>Standard (HD)</option><option>Draft</option></select>
                        <Toggle label="Denoise" checked={true} onChange={()=>{}} />
                        <Toggle label="Color Correction" checked={true} onChange={()=>{}} />
                    </div>
                )},
            ]} defaultValue="furn" />
        </div>
    );
};
