import React from 'react';
import * as Switch from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => {
  return (
    <div className="flex items-center justify-between py-1">
      <label className="text-sm text-foreground-secondary select-none cursor-pointer" onClick={() => onChange(!checked)}>
        {label}
      </label>
      <Switch.Root
        className={cn(
          "w-[36px] h-[20px] rounded-full relative shadow-inner-subtle transition-colors duration-200 ease-in-out cursor-pointer",
          checked ? "bg-foreground" : "bg-border-strong"
        )}
        checked={checked}
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
