import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sendPush, sendPushToMany } from '@/lib/push';
import {
  canAccessIssue,
  decideIssueChange,
  parseIssueChange,
  type Actor,
  type TransitionName,
} from '@/lib/issue-workflow';
import {
  isActiveAgent,
  parseIssueId,
  STALE_ISSUE_MESSAGE,
  toSnapshot,
  whereStillMatches,
} from '@/lib/issue-workflow-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const issueId = parseInt(id);

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      media: true,
      messages: { orderBy: { createdAt: 'asc' } },
      proof: true,
      visits: { orderBy: { scheduledAt: 'asc' } },
      client: { select: { id: true, name: true, login: true, unitNumber: true } },
      agent: { select: { id: true, name: true, email: true } },
    },
  });

  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (payload.role === 'client' && issue.clientId !== payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (payload.role === 'agent') {
    if (issue.agentId !== payload.id && issue.status !== 'PENDING_AGENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ ...issue, messages: [] });
  }

  if (payload.role === 'admin') {
    const otherIssues = await prisma.issue.findMany({
      where: { clientId: issue.clientId, id: { not: issue.id } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, severity: true, originalDescription: true, createdAt: true },
    });
    return NextResponse.json({ ...issue, otherIssues });
  }

  return NextResponse.json(issue);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const issueId = parseIssueId(id);
  if (issueId === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body: unknown = await req.json().catch(() => undefined);

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const actor: Actor = { role: payload.role, id: payload.id };
  if (!canAccessIssue(actor, toSnapshot(issue))) {
    return NextResponse.json({ error: "Vous n'avez pas accès à cette réclamation." }, { status: 403 });
  }

  const parsed = parseIssueChange(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

  const now = new Date();
  const decision = decideIssueChange(actor, toSnapshot(issue), parsed.change, now);

  if (decision.outcome === 'refuse') {
    return NextResponse.json({ error: decision.message }, { status: decision.httpStatus });
  }
  if (decision.outcome === 'noop') {
    return NextResponse.json({ ...issue, targetUserIds: [], unchanged: true });
  }

  if (decision.agentToVerify !== null && !(await isActiveAgent(decision.agentToVerify))) {
    return decision.agentToVerify === actor.id && actor.role === 'agent'
      ? NextResponse.json({ error: 'Votre compte agent a été désactivé.' }, { status: 403 })
      : NextResponse.json({ error: "Cet agent n'existe pas ou a été désactivé." }, { status: 400 });
  }

  const { count } = await prisma.issue.updateMany({
    where: whereStillMatches(issueId, decision.expect),
    data: decision.data,
  });

  if (count === 0) {
    const fresh = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!fresh) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const retry = decideIssueChange(actor, toSnapshot(fresh), parsed.change, now);
    if (retry.outcome === 'noop') return NextResponse.json({ ...fresh, targetUserIds: [], unchanged: true });
    if (retry.outcome === 'refuse') return NextResponse.json({ error: retry.message }, { status: retry.httpStatus });
    return NextResponse.json({ error: STALE_ISSUE_MESSAGE }, { status: 409 });
  }

  const updated = await prisma.issue.findUniqueOrThrow({ where: { id: issueId } });
  const targetUserIds = await notifyTransition(decision.transition, updated);

  return NextResponse.json({ ...updated, targetUserIds });
}

async function notifyTransition(
  transition: TransitionName | null,
  issue: { id: number; clientId: number; agentId: number | null; rejectionReason: string | null; disputeReason: string | null }
): Promise<number[]> {
  const tag = `issue-${issue.id}`;

  switch (transition) {
    case 'dispute': {
      const admins = await prisma.admin.findMany({ select: { id: true } });
      const adminIds = admins.map(a => a.id);
      if (adminIds.length === 0) return [];

      const title = `Résolution contestée (Réclamation #${issue.id})`;
      const message = issue.disputeReason
        ? `Le résident conteste la résolution : "${issue.disputeReason.slice(0, 200)}"`
        : 'Le résident a contesté la résolution de cette réclamation.';
      const link = `/admin/issues/${issue.id}`;

      await prisma.notification.createMany({
        data: adminIds.map(userId => ({ userId, userRole: 'admin', title, message, link })),
      });
      await sendPushToMany(adminIds.map(userId => ({ userId, userRole: 'admin' })), { title, body: message, link, tag });
      return adminIds;
    }

    case 'reject': {
      const title = `Réclamation #${issue.id} rejetée`;
      const message = `Motif : "${(issue.rejectionReason ?? '').slice(0, 200)}"`;
      const link = `/client/issues/${issue.id}`;

      await prisma.notification.create({ data: { userId: issue.clientId, userRole: 'client', title, message, link } });
      await sendPush(issue.clientId, 'client', { title, body: message, link, tag });
      return [issue.clientId];
    }

    case 'reopenDispute': {
      if (issue.agentId === null) return [];

      const title = `Dossier réouvert (Réclamation #${issue.id})`;
      const message = 'Une résolution contestée vous a été réassignée. Merci de reprendre le dossier.';
      const link = `/agent/issues/${issue.id}`;

      await prisma.notification.create({ data: { userId: issue.agentId, userRole: 'agent', title, message, link } });
      await sendPush(issue.agentId, 'agent', { title, body: message, link, tag });
      return [issue.agentId];
    }

    default:
      return [];
  }
}
