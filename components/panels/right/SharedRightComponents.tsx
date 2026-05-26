
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../../../lib/utils';
import { Slider } from '../../ui/Slider';

export const SectionDesc: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] text-foreground-muted leading-relaxed mb-3 italic">
    {children}
  </p>
);

export interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export const SliderControl: React.FC<SliderControlProps> = ({ label, value, min, max, step, unit, onChange, disabled, className }) => (
  <div className={cn("space-y-2 mb-3", className, disabled && "opacity-50 pointer-events-none")}>
    <div className="flex justify-between items-baseline">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <span className="text-[10px] font-mono text-foreground-muted">{value}{unit}</span>
    </div>
    <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
  </div>
);

export interface VerticalCardProps {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export const VerticalCard: React.FC<VerticalCardProps> = ({ label, description, selected, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full text-left p-3 rounded-lg border transition-all mb-2 flex flex-col gap-1",
      selected
        ? "bg-foreground text-background border-foreground shadow-sm"
        : "bg-surface-elevated border-border hover:border-foreground-muted"
    )}
  >
    <span className="text-xs font-bold">{label}</span>
    <span className={cn("text-[10px] leading-relaxed", selected ? "text-white/80" : "text-foreground-muted")}>
      {description}
    </span>
  </button>
);

export const ColorPicker: React.FC<{ color: string; onChange: (c: string) => void }> = ({ color, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-6 rounded border border-border shadow-sm overflow-hidden relative">
         <input type="color" value={color} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
         <div className="w-full h-full" style={{ backgroundColor: color }} />
      </div>
    </div>
  );
};

export interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

export const NumberInput: React.FC<NumberInputProps> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="flex items-center justify-between">
    <label className="text-xs font-medium text-foreground">{label}</label>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 h-7 bg-surface-sunken border border-border rounded px-2 text-xs text-right focus:border-accent outline-none"
    />
  </div>
);

const getLightSourceLabel = (azimuth: number, elevation: number): string => {
  const horizontal = Math.min(1, Math.max(0, azimuth / 360));
  const frontBack = Math.min(1, Math.max(0, elevation / 90));

  const xLabel = horizontal < 0.4 ? 'Left' : horizontal > 0.6 ? 'Right' : '';
  const yLabel = frontBack > 0.6 ? 'Front' : frontBack < 0.4 ? 'Back' : '';

  if (xLabel && yLabel) return `${yLabel}-${xLabel}`;
  if (yLabel) return yLabel;
  if (xLabel) return xLabel;
  return 'Centered';
};

interface SunPositionWidgetProps {
  azimuth: number;
  elevation: number;
  onChange: (az: number, el: number) => void;
  helperText?: string;
}

export const SunPositionWidget: React.FC<SunPositionWidgetProps> = ({ azimuth, elevation, onChange, helperText }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const sourceLabel = getLightSourceLabel(azimuth, elevation);

  const handleMove = (e: MouseEvent | React.MouseEvent) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);

    // Reuse the legacy azimuth/elevation fields as a camera-relative 2D source map.
    // X: left to right. Y: back to front.
    const newAz = Math.round((x / rect.width) * 360);
    const newEl = Math.round(90 - (y / rect.height) * 90);

    onChange(newAz, newEl);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e);
  };

  useEffect(() => {
    const up = () => setIsDragging(false);
    const move = (e: MouseEvent) => {
      if (isDragging) handleMove(e);
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mousemove', move);
    };
  }, [isDragging]);

  const left = (azimuth / 360) * 100;
  const top = ((90 - elevation) / 90) * 100;

  return (
    <div className="mb-4">
      <div
        ref={boxRef}
        className="relative h-24 bg-surface-sunken border border-border rounded-lg overflow-hidden cursor-crosshair shadow-inner"
        onMouseDown={handleMouseDown}
        aria-label={`Light source direction: ${sourceLabel}`}
        title={`Light source: ${sourceLabel}`}
      >
        {/* Grid Lines */}
        <div className="absolute inset-0 pointer-events-none opacity-20"
             style={{ backgroundImage: 'linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)', backgroundSize: '25% 33%' }} />

        {/* Directions */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-foreground-muted pointer-events-none">Front</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-foreground-muted pointer-events-none">Back</span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-foreground-muted pointer-events-none">Left</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-foreground-muted pointer-events-none">Right</span>

        {/* Sun Handle */}
        <div
          className="absolute w-4 h-4 bg-yellow-400 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.8)] border-2 border-white z-10 transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
          style={{ left: `${left}%`, top: `${top}%` }}
        />

        {/* Info Tag */}
        <div className="absolute bottom-1 right-1 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-mono border border-border pointer-events-none">
          {sourceLabel}
        </div>
      </div>
      {helperText && (
        <p className="mt-2 text-[10px] leading-relaxed text-foreground-muted">
          {helperText}
        </p>
      )}
    </div>
  );
};
