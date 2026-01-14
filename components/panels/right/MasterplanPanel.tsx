
import React from 'react';
import { Toggle } from '../../ui/Toggle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Accordion } from '../../ui/Accordion';
import { Slider } from '../../ui/Slider';
import { cn } from '../../../lib/utils';
import { ArrowDown, ArrowUpRight, ArrowUpLeft, Box, Layout } from 'lucide-react';

export const MasterplanPanel = () => {
    return (
        <div className="space-y-6">
            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Output Type</label>
                <div className="grid grid-cols-2 gap-2">
                    {['Photorealistic', 'Diagrammatic', 'Hybrid', 'Illustrative'].map(t => (
                        <button key={t} className="py-2 px-1 text-[10px] font-medium border border-border rounded hover:bg-surface-elevated hover:border-foreground-muted transition-colors">{t}</button>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">View Angle</label>
                <div className="grid grid-cols-3 gap-2">
                    <button className="aspect-square flex flex-col items-center justify-center border border-border rounded hover:bg-surface-elevated transition-colors group">
                        <Layout size={18} className="text-foreground-muted group-hover:text-foreground mb-1" />
                        <span className="text-[9px]">Top</span>
                    </button>
                    <button className="aspect-square flex flex-col items-center justify-center border border-border rounded hover:bg-surface-elevated transition-colors group bg-surface-sunken border-foreground/50">
                        <ArrowUpRight size={18} className="text-foreground mb-1" />
                        <span className="text-[9px] font-bold">Iso NE</span>
                    </button>
                    <button className="aspect-square flex flex-col items-center justify-center border border-border rounded hover:bg-surface-elevated transition-colors group">
                        <ArrowUpLeft size={18} className="text-foreground-muted group-hover:text-foreground mb-1" />
                        <span className="text-[9px]">Iso NW</span>
                    </button>
                    <button className="aspect-square flex flex-col items-center justify-center border border-border rounded hover:bg-surface-elevated transition-colors group">
                        <Box size={18} className="text-foreground-muted group-hover:text-foreground mb-1" />
                        <span className="text-[9px]">Persp</span>
                    </button>
                    <button className="aspect-square flex flex-col items-center justify-center border border-border rounded hover:bg-surface-elevated transition-colors group">
                        <ArrowDown size={18} className="text-foreground-muted group-hover:text-foreground mb-1" />
                        <span className="text-[9px]">South</span>
                    </button>
                    <button className="aspect-square flex flex-col items-center justify-center border border-border rounded hover:bg-surface-elevated transition-colors group">
                        <span className="text-xs font-bold text-foreground-muted">+</span>
                        <span className="text-[9px]">Custom</span>
                    </button>
                </div>
            </div>

            <div>
                <label className="text-xs text-foreground-muted mb-2 block font-bold uppercase tracking-wider">Buildings</label>
                <div className="space-y-3">
                    <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>Contemporary Mixed</option><option>Residential</option><option>Office Park</option></select>
                    <div>
                        <span className="text-[10px] text-foreground-muted block mb-1">Height Interpretation</span>
                        <SegmentedControl value="uniform" options={[{label:'Uniform', value:'uniform'}, {label:'Color', value:'color'}, {label:'Random', value:'random'}]} onChange={()=>{}} />
                    </div>
                    <Slider label="Default Height" value={24} min={3} max={100} onChange={()=>{}} />
                </div>
            </div>

            <Accordion items={[
                { id: 'land', title: 'Landscape', content: (
                    <div className="space-y-3">
                        <Slider label="Tree Density" value={60} min={0} max={100} onChange={()=>{}} />
                        <Toggle label="Water Bodies" checked={true} onChange={()=>{}} />
                        <Toggle label="Parks & Plazas" checked={true} onChange={()=>{}} />
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button className="text-[10px] py-1 border rounded hover:bg-surface-elevated">Summer</button>
                            <button className="text-[10px] py-1 border rounded hover:bg-surface-elevated">Winter</button>
                        </div>
                    </div>
                )},
                { id: 'out', title: 'Output', content: (
                    <div className="space-y-3">
                        <select className="w-full bg-surface-elevated border border-border rounded text-xs h-8 px-2"><option>4K Ultra HD</option><option>8K Print</option><option>1080p Web</option></select>
                        <Toggle label="Export Layers" checked={false} onChange={()=>{}} />
                        <button className="w-full py-2 mt-2 bg-foreground text-background rounded text-xs font-bold">Export .TIFF</button>
                    </div>
                )},
            ]} />
        </div>
    );
};
