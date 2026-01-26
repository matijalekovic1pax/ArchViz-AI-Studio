import React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultValue?: string;
  value?: string | null;
  onValueChange?: (value: string | null) => void;
}

export const Accordion: React.FC<AccordionProps> = ({ items, defaultValue, value, onValueChange }) => {
  const handleValueChange = (nextValue: string) => {
    if (onValueChange) {
      onValueChange(nextValue ? nextValue : null);
    }
  };

  return (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      className="w-full"
      value={value !== undefined ? value ?? '' : undefined}
      defaultValue={value === undefined ? defaultValue : undefined}
      onValueChange={onValueChange ? handleValueChange : undefined}
    >
      {items.map((item) => (
        <AccordionPrimitive.Item key={item.id} value={item.id} className="border-b border-border-subtle last:border-0">
          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-3 font-medium text-xs uppercase tracking-wider text-foreground-muted hover:text-foreground transition-all [&[data-state=open]>svg]:rotate-180">
              {item.title}
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden text-sm data-[state=closed]:animate-slide-up data-[state=open]:animate-slide-down">
            <div className="pb-4 pt-1 space-y-4">
              {item.content}
            </div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
};
