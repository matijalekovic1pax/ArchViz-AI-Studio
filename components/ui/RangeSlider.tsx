import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

interface RangeSliderProps {
  value: [number, number];
  min: number;
  max: number;
  step?: number;
  onChange: (val: [number, number]) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({ value, min, max, step = 1, onChange, label, className, disabled }) => {
  const handleChange = (vals: number[]) => {
    if (vals.length < 2) return;
    const next: [number, number] = vals[0] <= vals[1] ? [vals[0], vals[1]] : [vals[1], vals[0]];
    onChange(next);
  };

  return (
    <div className={cn("space-y-2", className, disabled && "opacity-50 pointer-events-none")}>
      <div className="flex justify-between text-xs">
        {label && <span className="text-foreground-secondary">{label}</span>}
        <span className="font-mono text-foreground-muted">{value[0]}-{value[1]}</span>
      </div>
      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={value}
        max={max}
        min={min}
        step={step}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SliderPrimitive.Track className="bg-border relative grow rounded-full h-[4px]">
          <SliderPrimitive.Range className="absolute bg-foreground rounded-full h-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block w-4 h-4 bg-surface-elevated border border-border-strong shadow-soft rounded-full hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-accent-muted transition-transform active:scale-95"
          aria-label={label ? `${label} Min` : 'Min'}
        />
        <SliderPrimitive.Thumb
          className="block w-4 h-4 bg-surface-elevated border border-border-strong shadow-soft rounded-full hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-accent-muted transition-transform active:scale-95"
          aria-label={label ? `${label} Max` : 'Max'}
        />
      </SliderPrimitive.Root>
    </div>
  );
};
