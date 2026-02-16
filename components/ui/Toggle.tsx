import React from 'react';
import * as Switch from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled = false }) => {
  const hasLabel = Boolean(label && label.trim().length > 0);
  return (
    <div className={cn("flex items-center", hasLabel ? "justify-between py-1" : "py-0")}>
      {hasLabel && (
        <label
          className={cn(
            'text-sm text-foreground-secondary select-none',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          )}
          onClick={() => {
            if (!disabled) onChange(!checked);
          }}
        >
          {label}
        </label>
      )}
      <Switch.Root
        className={cn(
          "w-[36px] h-[20px] rounded-full relative shadow-inner-subtle transition-colors duration-200 ease-in-out shrink-0",
          checked ? "bg-foreground" : "bg-border-strong",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        )}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      >
        <Switch.Thumb
          className={cn(
            "block w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out absolute top-[2px] left-[2px]",
            checked ? "translate-x-[16px]" : "translate-x-0"
          )}
        />
      </Switch.Root>
    </div>
  );
};
