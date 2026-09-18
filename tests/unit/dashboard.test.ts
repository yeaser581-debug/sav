import { describe, it, expect } from 'vitest';
import {
  averageHours, countActions, countPerWeek, formatHours, isLate, oldestOpen,
  openByStatus, percentChange, slaRate, unansweredIssueIds, weekBuckets,
  type OpenIssue,
} from '@/lib/dashboard';

const NOW = new Date('2026-09-17T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);

const issue = (over: Partial<OpenIssue> = {}): OpenIssue => ({
  id: 1, status: 'IN_PROGRESS', severity: 'MEDIUM', agentId: 7,
  createdAt: hoursAgo(1), description: 'Fuite', ...over,
});

describe('isLate', () => {
  it.each([
    ['CRITICAL', 25, true],
    ['CRITICAL', 23, false],
    ['MEDIUM', 73, true],
    ['MEDIUM', 71, false],
    ['LOW', 24 * 8, true],
    ['LOW', 24 * 6, false],
  ])('%s after %i h is late: %s', (severity, age, expected) => {
    expect(isLate(issue({ severity, createdAt: hoursAgo(age) }), NOW)).toBe(expected);
  });

  it('cannot be late without a severity, since the clock starts at triage', () => {
    expect(isLate(issue({ severity: null, createdAt: daysAgo(30) }), NOW)).toBe(false);
  });

  it.each(['RESOLVED', 'CONFIRMED', 'REJECTED'])('is never late once %s', status => {
    expect(isLate(issue({ status, createdAt: daysAgo(30) }), NOW)).toBe(false);
  });
});

describe('countActions', () => {
  const open = [
    issue({ id: 1, status: 'PENDING_AGENT', severity: null, agentId: null }),
    issue({ id: 2, status: 'PENDING_AGENT', severity: 'CRITICAL', agentId: null, createdAt: hoursAgo(40) }),
    issue({ id: 3, status: 'IN_PROGRESS', severity: 'MEDIUM', createdAt: hoursAgo(80) }),
    issue({ id: 4, status: 'DISPUTED', severity: 'LOW' }),
  ];

  it('counts each row of the action bar', () => {
    expect(countActions(open, 5, NOW)).toEqual({ late: 2, unassigned: 2, disputed: 1, unanswered: 5 });
  });

  it('reports zeros for a quiet day', () => {
    expect(countActions([], 0, NOW)).toEqual({ late: 0, unassigned: 0, disputed: 0, unanswered: 0 });
  });
});

describe('unansweredIssueIds', () => {
  const client = new Map<number, Date>();
  const staff = new Map<number, Date>();
  client.set(1, hoursAgo(30));           // waiting since yesterday
  client.set(2, hoursAgo(2));            // recent, still fine
  client.set(3, hoursAgo(40)); staff.set(3, hoursAgo(38)); // answered after
  client.set(4, hoursAgo(40)); staff.set(4, hoursAgo(50)); // answered before, still waiting

  it('lists only claims where the resident spoke last, over a day ago', () => {
    expect(unansweredIssueIds(client, staff, NOW).sort()).toEqual([1, 4]);
  });

  it('takes the delay as a parameter', () => {
    expect(unansweredIssueIds(client, staff, NOW, 1).sort()).toEqual([1, 2, 4]);
  });
});

describe('openByStatus', () => {
  it('keeps the workflow order and drops empty statuses', () => {
    const open = [
      issue({ status: 'DISPUTED' }),
      issue({ status: 'PENDING_AGENT' }),
      issue({ status: 'PENDING_AGENT' }),
    ];
    expect(openByStatus(open)).toEqual([
      { status: 'PENDING_AGENT', count: 2 },
      { status: 'DISPUTED', count: 1 },
    ]);
  });

  it('returns nothing when nothing is open', () => {
    expect(openByStatus([])).toEqual([]);
  });
});

describe('oldestOpen', () => {
  it('finds the claim that has waited longest', () => {
    const old = issue({ id: 9, createdAt: daysAgo(19) });
    const found = oldestOpen([issue({ id: 1, createdAt: daysAgo(2) }), old, issue({ id: 3, createdAt: daysAgo(5) })]);
    expect(found?.issue.id).toBe(9);
    expect(found?.days).toBeGreaterThanOrEqual(18);
  });

  it('is null with nothing open', () => {
    expect(oldestOpen([])).toBeNull();
  });
});

describe('weekBuckets and countPerWeek', () => {
  const buckets = weekBuckets(NOW);

  it('covers four whole weeks, oldest first', () => {
    expect(buckets).toHaveLength(4);
    expect(buckets[0].start.getTime()).toBeLessThan(buckets[3].start.getTime());
    expect(buckets[3].end.getTime()).toBe(NOW.getTime());
  });

  it('puts each date in exactly one week', () => {
    const counts = countPerWeek([daysAgo(1), daysAgo(2), daysAgo(9), daysAgo(20), daysAgo(26)], buckets);
    expect(counts).toEqual([1, 1, 1, 2]);
    expect(counts.reduce((a, b) => a + b)).toBe(5);
  });

  it('ignores anything older than the window', () => {
    expect(countPerWeek([daysAgo(60)], buckets)).toEqual([0, 0, 0, 0]);
  });
});

describe('percentChange', () => {
  it.each([[34, 28, 21], [29, 29, 0], [5, 10, -50]])('%i vs %i is %i %%', (now, before, expected) => {
    expect(percentChange(now, before)).toBe(expected);
  });

  it('has nothing to compare when the previous period was empty', () => {
    expect(percentChange(4, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });
});

describe('averageHours', () => {
  it('averages only what is resolved', () => {
    expect(averageHours([
      { createdAt: hoursAgo(50), resolvedAt: hoursAgo(26) }, // 24 h
      { createdAt: hoursAgo(50), resolvedAt: hoursAgo(2) },  // 48 h
      { createdAt: hoursAgo(50), resolvedAt: null },
    ])).toBe(36);
  });

  it('skips rows resolved before they were created', () => {
    expect(averageHours([
      { createdAt: hoursAgo(2), resolvedAt: hoursAgo(10) },
      { createdAt: hoursAgo(50), resolvedAt: hoursAgo(26) },
    ])).toBe(24);
  });

  it('is null with nothing resolved', () => {
    expect(averageHours([{ createdAt: hoursAgo(5), resolvedAt: null }])).toBeNull();
  });
});

describe('slaRate', () => {
  it('counts resolutions that made their deadline', () => {
    const result = slaRate([
      { severity: 'CRITICAL', createdAt: hoursAgo(30), resolvedAt: hoursAgo(20) }, // 10 h of 24 — on time
      { severity: 'CRITICAL', createdAt: hoursAgo(60), resolvedAt: hoursAgo(20) }, // 40 h of 24 — late
      { severity: 'MEDIUM', createdAt: hoursAgo(80), resolvedAt: hoursAgo(20) },   // 60 h of 72 — on time
    ]);
    expect(result).toEqual({ rate: 67, onTime: 2, total: 3 });
  });

  it('ignores claims never triaged, whose clock never started', () => {
    expect(slaRate([{ severity: null, createdAt: hoursAgo(90), resolvedAt: hoursAgo(1) }]))
      .toEqual({ rate: null, onTime: 0, total: 0 });
  });
});

describe('formatHours', () => {
  it.each([[null, '—'], [1, '1 h'], [18, '18 h'], [23.6, '24 h'], [24, '1,0 j'], [81.6, '3,4 j']])(
    '%s reads as %s', (hours, expected) => {
      expect(formatHours(hours as number | null)).toBe(expected);
    });
});
