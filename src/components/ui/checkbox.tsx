'use client';

import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A checkbox that also speaks "some but not all" for a header that toggles a
 * whole list.
 */
export function Checkbox({ checked, indeterminate = false, onChange, label, className }: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  /** Read by screen readers; the box itself carries no visible text. */
  label: string;
  className?: string;
}) {
  const marked = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      className={cn(
        'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        marked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:border-primary/60',
        className,
      )}
    >
      {indeterminate
        ? <Minus className="h-3 w-3" strokeWidth={3} />
        : checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}
