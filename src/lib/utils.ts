import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard utility to conditionally merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Safely format ISO date strings for academic outreach display
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Truncate long text strings cleanly
 */
export function truncate(str: string | null | undefined, maxLength: number): string {
  if (!str) return '';
  if (maxLength <= 0) return '...';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}
