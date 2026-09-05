import { describe, it, expect } from 'vitest';
import { cn, timeAgo, issueDeadline } from '@/lib/utils';

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

describe('issueDeadline', () => {
  const HOUR = 3_600_000;
  const now = new Date();

  it('gives a critical issue a 24h window', () => {
    const info = issueDeadline('CRITICAL', now, 'PENDING_AGENT');
    expect(info?.deadlineAt.getTime()).toBe(now.getTime() + 24 * HOUR);
  });

  it('gives a medium issue a 72h window', () => {
    const info = issueDeadline('MEDIUM', now, 'IN_PROGRESS');
    expect(info?.deadlineAt.getTime()).toBe(now.getTime() + 72 * HOUR);
  });

  it('gives a low issue a 7-day window', () => {
    const info = issueDeadline('LOW', now, 'PENDING_AGENT');
    expect(info?.deadlineAt.getTime()).toBe(now.getTime() + 7 * 24 * HOUR);
  });

  it('returns null when severity has not been assigned yet', () => {
    expect(issueDeadline(null, now, 'PENDING_AGENT')).toBeNull();
  });

  it('returns null once the issue is in a final state, regardless of severity', () => {
    expect(issueDeadline('CRITICAL', now, 'RESOLVED')).toBeNull();
    expect(issueDeadline('CRITICAL', now, 'CONFIRMED')).toBeNull();
    expect(issueDeadline('CRITICAL', now, 'REJECTED')).toBeNull();
  });

  it('keeps a disputed issue eligible', () => {
    expect(issueDeadline('CRITICAL', now, 'DISPUTED')).not.toBeNull();
  });

  it('flags overdue once past the window for an active status', () => {
    const createdAt = new Date(Date.now() - 25 * HOUR);
    const info = issueDeadline('CRITICAL', createdAt, 'IN_PROGRESS');
    expect(info?.overdue).toBe(true);
  });

  it('does not flag overdue while still inside the window', () => {
    const createdAt = new Date(Date.now() - 1 * HOUR);
    const info = issueDeadline('CRITICAL', createdAt, 'IN_PROGRESS');
    expect(info?.overdue).toBe(false);
  });

  it('anchors the deadline to createdAt, not to now', () => {
    const createdAt = new Date(Date.now() - 10 * HOUR);
    const info = issueDeadline('CRITICAL', createdAt, 'PENDING_AGENT');
    expect(info?.deadlineAt.getTime()).toBe(createdAt.getTime() + 24 * HOUR);
  });

  it('returns null when createdAt is missing', () => {
    expect(issueDeadline('CRITICAL', undefined, 'PENDING_AGENT')).toBeNull();
    expect(issueDeadline('CRITICAL', null, 'PENDING_AGENT')).toBeNull();
  });
});
