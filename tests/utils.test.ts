import { describe, it, expect } from 'vitest';
import { cn, formatDate, truncate } from '../src/lib/utils';

describe('Utility Functions (src/lib/utils.ts)', () => {
  describe('cn()', () => {
    it('merges class names cleanly', () => {
      const result = cn('px-4 py-2', 'text-white', 'bg-blue-600');
      expect(result).toBe('px-4 py-2 text-white bg-blue-600');
    });

    it('resolves tailwind merge conflicts by keeping the last class', () => {
      const result = cn('px-4 py-2', 'px-6');
      expect(result).toBe('py-2 px-6');
    });

    it('handles conditional class values and falsy elements correctly', () => {
      const isVisible = false;
      const isPrimary = true;
      const result = cn(
        'base-class',
        isVisible && 'hidden-class',
        isPrimary && 'primary-class',
        undefined,
        null
      );
      expect(result).toBe('base-class primary-class');
    });
  });

  describe('formatDate()', () => {
    it('formats a valid ISO date string cleanly', () => {
      const formatted = formatDate('2026-11-22T10:00:00Z');
      expect(formatted).toBe('Nov 22, 2026');
    });

    it('returns an em-dash for null, undefined, or empty strings', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate('')).toBe('—');
    });

    it('returns an em-dash for invalid date strings', () => {
      expect(formatDate('invalid-date')).toBe('—');
    });
  });

  describe('truncate()', () => {
    it('truncates strings exceeding max length with an ellipsis', () => {
      const result = truncate('Professor of Computer Science and Engineering', 20);
      expect(result).toBe('Professor of Compute...');
      expect(result.length).toBe(23);
    });

    it('preserves strings within the max length without modification', () => {
      const result = truncate('Dr. Jane Doe', 20);
      expect(result).toBe('Dr. Jane Doe');
    });

    it('handles null and undefined safely', () => {
      expect(truncate(null, 10)).toBe('');
      expect(truncate(undefined, 10)).toBe('');
    });

    it('handles zero and negative maxLength safely without reverse slicing', () => {
      expect(truncate('Professor', 0)).toBe('...');
      expect(truncate('Professor', -1)).toBe('...');
      expect(truncate('Professor', -10)).toBe('...');
    });
  });
});
