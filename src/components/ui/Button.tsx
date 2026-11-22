import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none text-sm',
          variant === 'default' && 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 shadow-sm',
          variant === 'secondary' && 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400',
          variant === 'outline' && 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus-visible:ring-blue-500 shadow-sm',
          variant === 'ghost' && 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400',
          variant === 'destructive' && 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',
          size === 'default' && 'h-9 px-4 py-2',
          size === 'sm' && 'h-8 rounded-md px-3 text-xs',
          size === 'lg' && 'h-10 rounded-md px-6 text-base',
          size === 'icon' && 'h-9 w-9',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
