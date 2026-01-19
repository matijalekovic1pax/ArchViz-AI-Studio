import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  showLabel?: boolean;
  showValue?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  className,
  disabled,
  showLabel = true,
  showValue = true,
}) => {
  const showHeader = (showLabel && !!label) || showValue;
  return (
    <div className={cn("space-y-2", className, disabled && "opacity-50 pointer-events-none")}>
      {showHeader && (
        <div className="flex justify-between text-xs">
          {showLabel && label && <span className="text-foreground-secondary">{label}</span>}
          {showValue && <span className="font-mono text-foreground-muted">{value}</span>}
        </div>
      )}
      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={[value]}
        max={max}
        min={min}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
        disabled={disabled}
      >
        <SliderPrimitive.Track className="bg-border relative grow rounded-full h-[4px]">
          <SliderPrimitive.Range className="absolute bg-foreground rounded-full h-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block w-4 h-4 bg-surface-elevated border border-border-strong shadow-soft rounded-full hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-accent-muted transition-transform active:scale-95"
          aria-label={label}
        />
      </SliderPrimitive.Root>
    </div>
  );
};
