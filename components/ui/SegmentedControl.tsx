import React from 'react';
import { cn } from '../../lib/utils';

interface Option {
  value: string;
  label: React.ReactNode;
}

interface SegmentedControlProps {
  value: string;
  options: Option[];
  onChange: (val: any) => void;
  className?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({ value, options, onChange, className }) => {
  const optionCount = Math.max(options.length, 1);

  return (
    <div
      className={cn("grid w-full min-w-0 max-w-full overflow-hidden bg-surface-sunken p-1 rounded-md", className)}
      style={{ gridTemplateColumns: `repeat(${optionCount}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-0 overflow-hidden px-2 py-1.5 text-center text-xs font-medium rounded transition-all duration-200 sm:px-3",
              isActive 
                ? "bg-surface-elevated text-foreground shadow-subtle" 
                : "text-foreground-muted hover:text-foreground-secondary"
            )}
          >
            <span className="mx-auto flex min-w-0 max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap [&_span]:min-w-0 [&_span]:truncate [&_svg]:shrink-0">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
