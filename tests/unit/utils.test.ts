import { describe, it, expect } from 'vitest';
import { cn, timeAgo } from '@/lib/utils';

describe('cn', () => {
  it('merges class names and drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets a later Tailwind class win over an earlier conflicting one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('timeAgo', () => {
  const ago = (ms: number) => new Date(Date.now() - ms);

  it('reports just now for under a minute', () => {
    expect(timeAgo(ago(10_000))).toBe("à l'instant");
  });

  it('reports minutes under an hour', () => {
    expect(timeAgo(ago(5 * 60_000))).toBe('5 min');
  });

  it('reports hours under a day', () => {
    expect(timeAgo(ago(3 * 3_600_000))).toBe('3 h');
  });

  it('reports days under a week', () => {
    expect(timeAgo(ago(2 * 86_400_000))).toBe('2 j');
  });

  it('falls back to a short date at a week or older', () => {
    const result = timeAgo(ago(10 * 86_400_000));
    expect(result).not.toMatch(/j$|h$|min$/);
  });

  it('accepts an ISO string the same as a Date', () => {
    const iso = ago(5 * 60_000).toISOString();
    expect(timeAgo(iso)).toBe('5 min');
  });
});
