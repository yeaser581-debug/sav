// Pure rules for finding clients and summarising their claims. No database
// access here, so every rule can be tested on its own.

import { ISSUE_STATUSES, type IssueStatusValue } from '@/lib/issue-workflow';

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
export const CLIENT_PAGE_SIZE = 20;
export const HISTORY_PAGE_SIZE = 10;
export const QUICK_SEARCH_LIMIT = 5;
export const MAX_PAGE_SIZE = 50;
export const EXCERPT_LENGTH = 160;

// A claim still needs someone's attention in these states.
export const OPEN_STATUSES = ['PENDING_AGENT', 'IN_PROGRESS', 'DISPUTED'] as const satisfies readonly IssueStatusValue[];
export const RESOLVED_STATUSES = ['RESOLVED', 'CONFIRMED'] as const satisfies readonly IssueStatusValue[];

export const HISTORY_FILTERS = {
  all: null,
  open: OPEN_STATUSES,
  resolved: RESOLVED_STATUSES,
  disputed: ['DISPUTED'],
  rejected: ['REJECTED'],
} as const satisfies Record<string, readonly IssueStatusValue[] | null>;

export type HistoryFilter = keyof typeof HISTORY_FILTERS;

export function parseHistoryFilter(raw: string | null): HistoryFilter {
  return raw && Object.hasOwn(HISTORY_FILTERS, raw) ? (raw as HistoryFilter) : 'all';
}

export function parsePaging(params: URLSearchParams, defaultLimit: number): { page: number; limit: number } {
  const page = Math.max(1, parseInt(params.get('page') || '1') || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(params.get('limit') || String(defaultLimit)) || defaultLimit));
  return { page, limit };
}

// Trimmed, whitespace collapsed and capped, so a pasted paragraph cannot turn
// into an expensive query. Empty means "no filter".
export function normalizeQuery(raw: string | null): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LENGTH);
}

// Prisma hands `contains` to MySQL's LIKE as is, so % and _ in a query would
// act as wildcards ("%" matches everyone). Escape them to mean themselves.
export function likeLiteral(query: string): string {
  return query.replace(/[\\%_]/g, '\\$&');
}

// Phone numbers are typed in every shape: "06 61 23 45 78", "0661234578",
// "+212 661-234578". Reduce the query to the national number without its
// leading 0 or 212, so any of those finds the others. Returns null when the
// query is not a phone number.
export function phoneDigits(query: string): string | null {
  if (!/^\+?[\d\s.\-()]+$/.test(query)) return null;
  let digits = query.replace(/\D/g, '');
  if (digits.startsWith('00212')) digits = digits.slice(5);
  else if (digits.startsWith('212')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 4 ? digits : null;
}

// "#42", "42" and "n°42" all mean claim 42.
export function issueNumber(query: string): number | null {
  const match = query.match(/^(?:#|n°\s*|no\.?\s*)?(\d{1,9})$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return id > 0 ? id : null;
}

export function excerpt(text: string | null | undefined, length = EXCERPT_LENGTH): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1).trimEnd()}…` : flat;
}

export type StatusCounts = Record<IssueStatusValue, number>;

export type ClaimStats = {
  total: number;
  open: number;
  resolved: number;
  disputed: number;
  rejected: number;
  byStatus: StatusCounts;
  avgResolutionHours: number | null;
};

export function emptyStatusCounts(): StatusCounts {
  return Object.fromEntries(ISSUE_STATUSES.map(s => [s, 0])) as StatusCounts;
}

export function summarizeClaims(
  groups: { status: string; count: number }[],
  resolvedDurations: { createdAt: Date; resolvedAt: Date | null }[],
): ClaimStats {
  const byStatus = emptyStatusCounts();
  for (const { status, count } of groups) {
    if (status in byStatus) byStatus[status as IssueStatusValue] += count;
  }
  const sum = (statuses: readonly IssueStatusValue[]) => statuses.reduce((n, s) => n + byStatus[s], 0);

  const hours = resolvedDurations
    .filter((r): r is { createdAt: Date; resolvedAt: Date } => r.resolvedAt !== null)
    .map(r => (r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000)
    .filter(h => h >= 0);

  return {
    total: sum(ISSUE_STATUSES),
    open: sum(OPEN_STATUSES),
    resolved: sum(RESOLVED_STATUSES),
    disputed: byStatus.DISPUTED,
    rejected: byStatus.REJECTED,
    byStatus,
    avgResolutionHours: hours.length
      ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10
      : null,
  };
}
