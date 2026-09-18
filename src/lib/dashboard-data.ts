// The dashboard's reads. Every query is bounded: the open claims (a handful),
// the last 60 days of activity, and three conversations.

import { prisma } from '@/lib/prisma';
import { OPEN_STATUSES } from '@/lib/client-search';
import {
  PERIOD_DAYS, averageHours, countActions, countPerWeek, oldestOpen, openByStatus,
  percentChange, periodStart, slaRate, unansweredIssueIds, weekBuckets,
  type OpenIssue,
} from '@/lib/dashboard';

const OPEN = [...OPEN_STATUSES];

async function lastMessageAt(issueIds: number[], senderTypes: ('CLIENT' | 'ADMIN' | 'AGENT')[]) {
  if (issueIds.length === 0) return new Map<number, Date>();
  const rows = await prisma.issueMessage.groupBy({
    by: ['issueId'],
    where: { issueId: { in: issueIds }, senderType: { in: senderTypes } },
    _max: { createdAt: true },
  });
  return new Map(rows.flatMap(r => (r._max.createdAt ? [[r.issueId, r._max.createdAt] as const] : [])));
}

export async function getDashboard(now = new Date()) {
  const start = periodStart(now, PERIOD_DAYS);
  const previousStart = periodStart(now, PERIOD_DAYS * 2);

  const [openRaw, createdNow, createdBefore, resolvedNow, resolvedBefore, conversations] = await Promise.all([
    prisma.issue.findMany({
      where: { status: { in: OPEN } },
      select: { id: true, status: true, severity: true, agentId: true, createdAt: true, originalDescription: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.issue.findMany({ where: { createdAt: { gt: start } }, select: { createdAt: true } }),
    prisma.issue.count({ where: { createdAt: { gt: previousStart, lte: start } } }),
    prisma.issue.findMany({
      where: { resolvedAt: { gt: start } },
      select: { createdAt: true, resolvedAt: true, severity: true },
    }),
    prisma.issue.findMany({
      where: { resolvedAt: { gt: previousStart, lte: start } },
      select: { createdAt: true, resolvedAt: true, severity: true },
    }),
    prisma.issue.findMany({
      where: { status: { in: OPEN } },
      orderBy: [{ severity: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 3,
      select: {
        id: true, status: true, severity: true, originalDescription: true, createdAt: true,
        client: { select: { unitNumber: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { message: true, mediaType: true, senderType: true, createdAt: true } },
      },
    }),
  ]);

  const open: OpenIssue[] = openRaw.map(i => ({
    id: i.id, status: i.status, severity: i.severity, agentId: i.agentId,
    createdAt: i.createdAt, description: i.originalDescription,
  }));
  const openIds = open.map(i => i.id);

  // Two grouped queries instead of reading every message of every open claim.
  const [fromClient, fromStaff] = await Promise.all([
    lastMessageAt(openIds, ['CLIENT']),
    lastMessageAt(openIds, ['ADMIN', 'AGENT']),
  ]);

  const unanswered = unansweredIssueIds(fromClient, fromStaff, now);
  const weeks = weekBuckets(now);
  const sla = slaRate(resolvedNow);
  const slaBefore = slaRate(resolvedBefore);
  const avgNow = averageHours(resolvedNow);
  const avgBefore = averageHours(resolvedBefore);

  return {
    actions: countActions(open, unanswered.length, now),
    openTotal: open.length,
    openByStatus: openByStatus(open),
    oldest: oldestOpen(open),
    period: {
      created: createdNow.length,
      createdChange: percentChange(createdNow.length, createdBefore),
      resolved: resolvedNow.length,
      resolvedChange: percentChange(resolvedNow.length, resolvedBefore.length),
      averageHours: avgNow,
      averageHoursChange: avgNow !== null && avgBefore !== null ? Math.round((avgNow - avgBefore) * 10) / 10 : null,
      sla: sla.rate,
      slaOnTime: sla.onTime,
      slaTotal: sla.total,
      slaChange: sla.rate !== null && slaBefore.rate !== null ? sla.rate - slaBefore.rate : null,
    },
    weeks: (() => {
      const created = countPerWeek(createdNow.map(r => r.createdAt), weeks);
      const resolved = countPerWeek(resolvedNow.map(r => r.resolvedAt!), weeks);
      return weeks.map((w, i) => ({ label: w.label, created: created[i], resolved: resolved[i] }));
    })(),
    conversations: conversations.map(i => ({
      id: i.id,
      status: i.status,
      severity: i.severity,
      originalDescription: i.originalDescription,
      createdAt: i.createdAt.toISOString(),
      client: i.client,
      latestMessage: i.messages[0]
        ? { ...i.messages[0], createdAt: i.messages[0].createdAt.toISOString() }
        : null,
    })),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

/**
 * Claims past their deadline, as a Prisma filter: the same rule the badges use,
 * expressed per severity so the database can do the work.
 */
export function lateIssueWhere(now = new Date()) {
  const cutoff = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  return {
    status: { in: OPEN },
    OR: [
      { severity: 'CRITICAL' as const, createdAt: { lt: cutoff(24) } },
      { severity: 'MEDIUM' as const, createdAt: { lt: cutoff(72) } },
      { severity: 'LOW' as const, createdAt: { lt: cutoff(24 * 7) } },
    ],
  };
}

/** Open claims where the resident spoke last, more than a day ago. */
export async function unansweredOpenIssueIds(now = new Date()): Promise<number[]> {
  const open = await prisma.issue.findMany({ where: { status: { in: OPEN } }, select: { id: true } });
  const ids = open.map(i => i.id);
  const [fromClient, fromStaff] = await Promise.all([
    lastMessageAt(ids, ['CLIENT']),
    lastMessageAt(ids, ['ADMIN', 'AGENT']),
  ]);
  return unansweredIssueIds(fromClient, fromStaff, now);
}
