import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        variant === 'default' && 'border-transparent bg-blue-100 text-blue-800',
        variant === 'secondary' && 'border-transparent bg-gray-100 text-gray-800',
        variant === 'outline' && 'text-gray-950 border border-gray-300',
        variant === 'success' && 'border-transparent bg-emerald-100 text-emerald-800',
        variant === 'warning' && 'border-transparent bg-amber-100 text-amber-800',
        variant === 'destructive' && 'border-transparent bg-red-100 text-red-800',
        className
      )}
      {...props}
    />
  );
}
