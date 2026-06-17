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
  return (
    <div className={cn("flex bg-surface-sunken p-1 rounded-md", className)}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all duration-200",
              isActive 
                ? "bg-surface-elevated text-foreground shadow-subtle" 
                : "text-foreground-muted hover:text-foreground-secondary"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
