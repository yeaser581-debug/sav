import { describe, it, expect, beforeEach } from 'vitest';
import { getDashboard, lateIssueWhere, unansweredOpenIssueIds } from '@/lib/dashboard-data';
import { GET as listIssues } from '@/app/api/issues/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedAgent, seedClient, seedIssue } from '../helpers/db';
import { authedRequest } from '../helpers/request';

beforeEach(resetDb);

// Anchored to the real clock: the API routes under test use theirs, and a
// fixed date drifts out of step with them overnight.
const NOW = new Date();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);

async function claim(over: {
  status?: string; severity?: string | null; createdAt?: Date; resolvedAt?: Date | null; clientId?: number;
} = {}) {
  const clientId = over.clientId ?? (await seedClient({ login: `c${Math.random().toString(36).slice(2, 9)}` })).id;
  const issue = await seedIssue({
    clientId,
    status: (over.status ?? 'IN_PROGRESS') as never,
    severity: (over.severity === undefined ? 'MEDIUM' : over.severity) as never,
  });
  return prisma.issue.update({
    where: { id: issue.id },
    data: { createdAt: over.createdAt ?? hoursAgo(2), resolvedAt: over.resolvedAt ?? null },
  });
}

const message = (issueId: number, senderType: 'CLIENT' | 'ADMIN', createdAt: Date) =>
  prisma.issueMessage.create({ data: { issueId, senderId: 1, senderType, message: 'm', createdAt } });

describe('the action counts an admin lands on', () => {
  it('counts late, unassigned, disputed and unanswered separately', async () => {
    const late = await claim({ severity: 'CRITICAL', createdAt: hoursAgo(40) });
    await claim({ status: 'PENDING_AGENT', severity: null, createdAt: hoursAgo(3) });
    await claim({ status: 'DISPUTED', severity: 'LOW', createdAt: hoursAgo(5) });
    const waiting = await claim({ createdAt: hoursAgo(50) });
    await message(waiting.id, 'CLIENT', hoursAgo(30));

    const { actions, openTotal } = await getDashboard(NOW);

    expect(actions.late).toBe(1);       // only the CRITICAL one: 50 h is still inside the 72 h MEDIUM deadline
    expect(actions.unassigned).toBe(1);
    expect(actions.disputed).toBe(1);
    expect(actions.unanswered).toBe(1);
    expect(openTotal).toBe(4);
    expect(late.id).toBeGreaterThan(0);
  });

  it('does not count a claim the staff already answered', async () => {
    const answered = await claim({ createdAt: hoursAgo(50) });
    await message(answered.id, 'CLIENT', hoursAgo(40));
    await message(answered.id, 'ADMIN', hoursAgo(38));

    expect((await getDashboard(NOW)).actions.unanswered).toBe(0);
  });

  it('leaves closed claims out of everything', async () => {
    await claim({ status: 'CONFIRMED', severity: 'CRITICAL', createdAt: daysAgo(30), resolvedAt: daysAgo(1) });
    await claim({ status: 'REJECTED', severity: 'CRITICAL', createdAt: daysAgo(30) });

    const { actions, openTotal, oldest } = await getDashboard(NOW);
    expect(actions).toEqual({ late: 0, unassigned: 0, disputed: 0, unanswered: 0 });
    expect(openTotal).toBe(0);
    expect(oldest).toBeNull();
  });
});

describe('the period figures', () => {
  it('counts the last 30 days and compares with the 30 before', async () => {
    for (let i = 0; i < 3; i++) await claim({ createdAt: daysAgo(5) });
    for (let i = 0; i < 6; i++) await claim({ status: 'CONFIRMED', createdAt: daysAgo(45) });

    const { period } = await getDashboard(NOW);
    expect(period.created).toBe(3);
    expect(period.createdChange).toBe(-50);
  });

  it('averages resolution time and the share that made the deadline', async () => {
    await claim({ status: 'RESOLVED', severity: 'CRITICAL', createdAt: daysAgo(3), resolvedAt: hoursAgo(62) }); // 10 h — on time
    await claim({ status: 'RESOLVED', severity: 'CRITICAL', createdAt: daysAgo(5), resolvedAt: hoursAgo(50) }); // 70 h — late

    const { period } = await getDashboard(NOW);
    expect(period.averageHours).toBe(40);
    expect(period.sla).toBe(50);
    expect(period.slaOnTime).toBe(1);
    expect(period.slaTotal).toBe(2);
  });

  it('says there is nothing to compare rather than inventing a change', async () => {
    const { period } = await getDashboard(NOW);
    expect(period.created).toBe(0);
    expect(period.createdChange).toBe(0);
    expect(period.averageHours).toBeNull();
    expect(period.sla).toBeNull();
  });
});

describe('the four weeks of the chart', () => {
  it('puts each claim in its week and counts both series', async () => {
    await claim({ createdAt: daysAgo(2) });
    await claim({ createdAt: daysAgo(10) });
    await claim({ status: 'RESOLVED', createdAt: daysAgo(20), resolvedAt: daysAgo(3) });

    const { weeks } = await getDashboard(NOW);
    expect(weeks).toHaveLength(4);
    expect(weeks.map(w => w.label)).toEqual(['S1', 'S2', 'S3', 'S4']);
    expect(weeks[3].created).toBe(1);
    expect(weeks[2].created).toBe(1);
    expect(weeks[3].resolved).toBe(1);
    expect(weeks.reduce((n, w) => n + w.created, 0)).toBe(3);
  });
});

describe('the tiles link to a list that matches their number', () => {
  it('filter=late returns exactly the late claims', async () => {
    const admin = await seedAdmin();
    const agent = await seedAgent();
    await claim({ severity: 'CRITICAL', createdAt: hoursAgo(40) });
    await claim({ severity: 'CRITICAL', createdAt: hoursAgo(2) });
    await claim({ severity: 'LOW', createdAt: daysAgo(9) });
    void agent;

    const { actions } = await getDashboard(NOW);
    const res = await listIssues(authedRequest('/api/issues?filter=late', { id: admin.id, email: admin.email, role: 'admin' }));
    const data = await res.json();

    expect(data.issues).toHaveLength(2);
    expect(data.total).toBe(actions.late);
  });

  it('filter=unanswered returns exactly the claims waiting on a reply', async () => {
    const admin = await seedAdmin();
    const waiting = await claim({ createdAt: hoursAgo(60) });
    await message(waiting.id, 'CLIENT', hoursAgo(30));
    const answered = await claim({ createdAt: hoursAgo(60) });
    await message(answered.id, 'CLIENT', hoursAgo(30));
    await message(answered.id, 'ADMIN', hoursAgo(10));

    const res = await listIssues(authedRequest('/api/issues?filter=unanswered', { id: admin.id, email: admin.email, role: 'admin' }));
    const data = await res.json();

    expect(data.issues.map((i: { id: number }) => i.id)).toEqual([waiting.id]);
    expect(await unansweredOpenIssueIds(new Date())).toEqual([waiting.id]);
  });

  it('answers with an empty list, not everything, when nothing is waiting', async () => {
    const admin = await seedAdmin();
    await claim({ createdAt: hoursAgo(1) });

    const res = await listIssues(authedRequest('/api/issues?filter=unanswered', { id: admin.id, email: admin.email, role: 'admin' }));
    expect((await res.json()).issues).toHaveLength(0);
  });

  it('builds the late filter from the same deadlines as the badges', () => {
    const where = lateIssueWhere(NOW);
    const cutoffs = where.OR.map(r => r.createdAt.lt.getTime());
    expect(cutoffs[0]).toBe(hoursAgo(24).getTime());
    expect(cutoffs[1]).toBe(hoursAgo(72).getTime());
    expect(cutoffs[2]).toBe(hoursAgo(24 * 7).getTime());
  });
});
