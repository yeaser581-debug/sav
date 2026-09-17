import { describe, it, expect } from 'vitest';
import {
  excerpt, issueNumber, normalizeQuery, parseHistoryFilter, parsePaging,
  phoneDigits, summarizeClaims, MAX_PAGE_SIZE, SEARCH_MAX_LENGTH,
} from '@/lib/client-search';

describe('phoneDigits', () => {
  it.each([
    ['06 61 23 45 78', '661234578'],
    ['0661234578', '661234578'],
    ['+212 661-234578', '661234578'],
    ['00212661234578', '661234578'],
    ['212661234578', '661234578'],
    ['(06) 61.23.45.78', '661234578'],
    ['2345', '2345'],
  ])('reduces %s to the national number', (input, expected) => {
    expect(phoneDigits(input)).toBe(expected);
  });

  it.each(['lahcen', 'B12', 'apt 12', '06a1', ''])('ignores %s, which is not a phone number', input => {
    expect(phoneDigits(input)).toBeNull();
  });

  it('ignores digit runs too short to identify anyone', () => {
    expect(phoneDigits('061')).toBeNull();
  });
});

describe('issueNumber', () => {
  it.each([['42', 42], ['#42', 42], ['n°42', 42], ['N° 42', 42], ['no. 7', 7]])('reads %s as claim %i', (input, id) => {
    expect(issueNumber(input)).toBe(id);
  });

  it.each(['0', '#', 'B12', '42a', '1234567890'])('does not read %s as a claim number', input => {
    expect(issueNumber(input)).toBeNull();
  });
});

describe('normalizeQuery', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeQuery('  lahcen   el  faid ')).toBe('lahcen el faid');
  });

  it('caps a pasted paragraph', () => {
    expect(normalizeQuery('x'.repeat(5000))).toHaveLength(SEARCH_MAX_LENGTH);
  });

  it('treats a missing parameter as no query', () => {
    expect(normalizeQuery(null)).toBe('');
  });
});

describe('parsePaging', () => {
  const read = (qs: string) => parsePaging(new URLSearchParams(qs), 20);

  it('defaults to the first page', () => {
    expect(read('')).toEqual({ page: 1, limit: 20 });
  });

  it('clamps nonsense and oversized values', () => {
    expect(read('page=-3&limit=-5')).toEqual({ page: 1, limit: 1 });
    expect(read('limit=0').limit).toBe(20);
    expect(read('page=abc&limit=xyz')).toEqual({ page: 1, limit: 20 });
    expect(read('limit=100000').limit).toBe(MAX_PAGE_SIZE);
  });
});

describe('parseHistoryFilter', () => {
  it.each(['all', 'open', 'resolved', 'disputed', 'rejected'])('accepts %s', f => {
    expect(parseHistoryFilter(f)).toBe(f);
  });

  it.each([null, '', 'toString', '__proto__', 'OPEN'])('falls back to all for %s', f => {
    expect(parseHistoryFilter(f)).toBe('all');
  });
});

describe('excerpt', () => {
  it('keeps short text as is, flattened', () => {
    expect(excerpt('Fuite\n\nsous   l’évier')).toBe('Fuite sous l’évier');
  });

  it('cuts long text with an ellipsis within the limit', () => {
    const out = excerpt('mot '.repeat(100), 20)!;
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns null for nothing', () => {
    expect(excerpt(null)).toBeNull();
    expect(excerpt('')).toBeNull();
  });
});

describe('summarizeClaims', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n));

  it('counts every status and groups them', () => {
    const stats = summarizeClaims(
      [
        { status: 'PENDING_AGENT', count: 1 },
        { status: 'IN_PROGRESS', count: 2 },
        { status: 'DISPUTED', count: 1 },
        { status: 'RESOLVED', count: 3 },
        { status: 'CONFIRMED', count: 4 },
        { status: 'REJECTED', count: 5 },
      ],
      [],
    );
    expect(stats).toMatchObject({ total: 16, open: 4, resolved: 7, disputed: 1, rejected: 5 });
    expect(stats.byStatus.CONFIRMED).toBe(4);
  });

  it('reports zeros, not missing keys, for a client with no claims', () => {
    const stats = summarizeClaims([], []);
    expect(stats.total).toBe(0);
    expect(stats.byStatus).toEqual({
      PENDING_AGENT: 0, IN_PROGRESS: 0, RESOLVED: 0, CONFIRMED: 0, REJECTED: 0, DISPUTED: 0,
    });
    expect(stats.avgResolutionHours).toBeNull();
  });

  it('ignores a status it does not know rather than inventing one', () => {
    const stats = summarizeClaims([{ status: 'ARCHIVED', count: 9 }], []);
    expect(stats.total).toBe(0);
    expect(stats.byStatus).not.toHaveProperty('ARCHIVED');
  });

  it('averages resolution time in hours', () => {
    const stats = summarizeClaims([], [
      { createdAt: day(1), resolvedAt: day(2) },
      { createdAt: day(1), resolvedAt: day(4) },
    ]);
    expect(stats.avgResolutionHours).toBe(48);
  });

  it('skips unresolved and clock-skewed rows in the average', () => {
    const stats = summarizeClaims([], [
      { createdAt: day(1), resolvedAt: null },
      { createdAt: day(5), resolvedAt: day(4) },
      { createdAt: day(1), resolvedAt: day(2) },
    ]);
    expect(stats.avgResolutionHours).toBe(24);
  });
});
