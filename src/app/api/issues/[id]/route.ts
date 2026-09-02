import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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

  // Access control: client can only see their own, agent can see assigned, admin sees all
  if (payload.role === 'client' && issue.clientId !== payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (payload.role === 'agent') {
    if (issue.agentId !== payload.id && issue.status !== 'PENDING_AGENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // The resident/administration chat is not visible to agents.
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
  const issueId = parseInt(id);
  const body = await req.json();

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Client can only confirm/dispute the resolution of their own issue
  if (payload.role === 'client') {
    if (issue.clientId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['CONFIRMED', 'DISPUTED'].includes(body.status)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Agent can only act on issues assigned to them, or claim/reject an unassigned pending one
  if (payload.role === 'agent') {
    const isOwnIssue = issue.agentId === payload.id;
    const isClaimingOrRejecting = issue.status === 'PENDING_AGENT' && !issue.agentId
      && ['IN_PROGRESS', 'REJECTED'].includes(body.status);
    if (!isOwnIssue && !isClaimingOrRejecting) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const isReopeningDispute = body.status === 'IN_PROGRESS' && payload.role === 'admin' && issue.status === 'DISPUTED';

  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.severity && payload.role !== 'client' && { severity: body.severity }),
      ...(body.rejectionReason && payload.role !== 'client' && { rejectionReason: body.rejectionReason }),
      ...(body.status === 'DISPUTED' && { disputeReason: (body.disputeReason as string | undefined)?.trim() || null }),
      ...(isReopeningDispute && { disputeReason: null }),
      ...(body.deadlineAt && payload.role === 'admin' && { deadlineAt: new Date(body.deadlineAt) }),
      ...(body.agentId && payload.role === 'admin' && { agentId: body.agentId }),
      ...(body.status === 'IN_PROGRESS' && payload.role === 'agent' && !issue.agentId && { agentId: payload.id }),
      ...(body.aiDescription && payload.role !== 'client' && { aiDescription: body.aiDescription }),
      ...(body.status === 'RESOLVED' && { resolvedAt: new Date() }),
      ...(body.status === 'IN_PROGRESS' && { resolvedAt: null }),
      ...(body.status === 'CONFIRMED' && { closedAt: new Date() }),
    },
  });

  let targetUserIds: number[] = [];

  if (body.status === 'DISPUTED') {
    const admins = await prisma.admin.findMany({ select: { id: true } });
    targetUserIds = admins.map(a => a.id);
    if (targetUserIds.length > 0) {
      const reason = (body.disputeReason as string | undefined)?.trim();
      await prisma.notification.createMany({
        data: targetUserIds.map(id => ({
          userId: id,
          userRole: 'admin',
          title: `Résolution contestée (Réclamation #${issue.id})`,
          message: reason
            ? `Le résident conteste la résolution : "${reason.slice(0, 200)}"`
            : 'Le résident a contesté la résolution de cette réclamation.',
          link: `/admin/issues/${issue.id}`,
        })),
      });
    }
  }

  if (isReopeningDispute) {
    const finalAgentId = body.agentId ?? issue.agentId;
    if (finalAgentId) {
      targetUserIds = [finalAgentId];
      await prisma.notification.create({
        data: {
          userId: finalAgentId,
          userRole: 'agent',
          title: `Dossier réouvert (Réclamation #${issue.id})`,
          message: 'Une résolution contestée vous a été réassignée. Merci de reprendre le dossier.',
          link: `/agent/issues/${issue.id}`,
        },
      });
    }
  }

  return NextResponse.json({ ...updated, targetUserIds });
}
