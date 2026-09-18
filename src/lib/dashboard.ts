// Pure rules behind the admin dashboard: which claims need attention, how a
// period compares with the one before it, and how the weeks are bucketed.
// No database access here, so each rule can be tested on its own.

import { issueDeadline } from '@/lib/utils';
import { OPEN_STATUSES } from '@/lib/client-search';

export const WEEKS_SHOWN = 4;
export const PERIOD_DAYS = 30;
export const UNANSWERED_HOURS = 24;
const DAY = 86_400_000;

export type OpenIssue = {
  id: number;
  status: string;
  severity: string | null;
  agentId: number | null;
  createdAt: Date;
  description: string | null;
};

export type ActionCounts = {
  late: number;
  unassigned: number;
  disputed: number;
  unanswered: number;
};

export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

/** A claim past its deadline for its severity, using the same rule as the badges. */
export function isLate(issue: Pick<OpenIssue, 'severity' | 'createdAt' | 'status'>, now: Date): boolean {
  const deadline = issueDeadline(issue.severity, issue.createdAt, issue.status);
  return deadline !== null && now.getTime() > deadline.deadlineAt.getTime();
}

/**
 * The four numbers on the action row. `unanswered` is counted from the
 * messages, so it is passed in rather than derived here.
 */
export function countActions(open: OpenIssue[], unanswered: number, now: Date): ActionCounts {
  return {
    late: open.filter(i => isLate(i, now)).length,
    unassigned: open.filter(i => i.status === 'PENDING_AGENT').length,
    disputed: open.filter(i => i.status === 'DISPUTED').length,
    unanswered,
  };
}

/** Claims where the resident spoke last, long enough ago to be rude. */
export function unansweredIssueIds(
  lastClientMessage: Map<number, Date>,
  lastStaffMessage: Map<number, Date>,
  now: Date,
  hours = UNANSWERED_HOURS,
): number[] {
  const cutoff = now.getTime() - hours * 3_600_000;
  const waiting: number[] = [];
  for (const [issueId, clientAt] of lastClientMessage) {
    if (clientAt.getTime() > cutoff) continue;
    const staffAt = lastStaffMessage.get(issueId);
    if (!staffAt || staffAt.getTime() < clientAt.getTime()) waiting.push(issueId);
  }
  return waiting;
}

export function openByStatus(open: OpenIssue[]): { status: string; count: number }[] {
  return (OPEN_STATUSES as readonly string[])
    .map(status => ({ status, count: open.filter(i => i.status === status).length }))
    .filter(row => row.count > 0);
}

export function oldestOpen(open: OpenIssue[]): { issue: OpenIssue; days: number } | null {
  if (open.length === 0) return null;
  const issue = open.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
  return { issue, days: Math.floor((Date.now() - issue.createdAt.getTime()) / DAY) };
}

export type Week = { start: Date; end: Date; label: string };

/** The last four whole weeks, oldest first, ending now. */
export function weekBuckets(now: Date, weeks = WEEKS_SHOWN): Week[] {
  return Array.from({ length: weeks }, (_, i) => {
    const end = new Date(now.getTime() - (weeks - 1 - i) * 7 * DAY);
    const start = new Date(end.getTime() - 7 * DAY);
    return { start, end, label: `S${i + 1}` };
  });
}

export function countPerWeek(dates: Date[], buckets: Week[]): number[] {
  return buckets.map(b => dates.filter(d => d > b.start && d <= b.end).length);
}

/** Percentage change, or null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function averageHours(spans: { createdAt: Date; resolvedAt: Date | null }[]): number | null {
  const hours = spans
    .filter((s): s is { createdAt: Date; resolvedAt: Date } => s.resolvedAt !== null)
    .map(s => (s.resolvedAt.getTime() - s.createdAt.getTime()) / 3_600_000)
    .filter(h => h >= 0);
  if (hours.length === 0) return null;
  return Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10;
}

/** Share of resolved claims that made their deadline, as a whole percentage. */
export function slaRate(
  resolved: { severity: string | null; createdAt: Date; resolvedAt: Date | null }[],
): { rate: number | null; onTime: number; total: number } {
  const measurable = resolved.filter(r => r.resolvedAt !== null && r.severity !== null);
  if (measurable.length === 0) return { rate: null, onTime: 0, total: 0 };

  const onTime = measurable.filter(r => {
    // IN_PROGRESS keeps issueDeadline from treating the claim as closed.
    const deadline = issueDeadline(r.severity, r.createdAt, 'IN_PROGRESS');
    return deadline !== null && r.resolvedAt!.getTime() <= deadline.deadlineAt.getTime();
  }).length;

  return { rate: Math.round((onTime / measurable.length) * 100), onTime, total: measurable.length };
}

export function periodStart(now: Date, days = PERIOD_DAYS): Date {
  return new Date(now.getTime() - days * DAY);
}

/** "3,4 j" or "18 h" — the French decimal comma included. */
export function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 24) return `${Math.max(1, Math.round(hours))} h`;
  return `${(hours / 24).toFixed(1).replace('.', ',')} j`;
}
