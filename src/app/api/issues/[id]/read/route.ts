import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { adminHasUnread, clientHasUnread, readTimestamp } from '@/lib/read-state';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (payload.role !== 'admin' && payload.role !== 'client') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const issueId = parseInt(id);
  if (!Number.isInteger(issueId) || issueId <= 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, clientId: true, adminLastReadAt: true, clientLastReadAt: true },
  });
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (payload.role === 'client' && issue.clientId !== payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const incomingFrom = payload.role === 'admin' ? 'CLIENT' : 'ADMIN';
  const latestIncoming = await prisma.issueMessage.findFirst({
    where: { issueId, senderType: incomingFrom },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const unread = payload.role === 'admin'
    ? adminHasUnread({ adminLastReadAt: issue.adminLastReadAt, latestClientMessageAt: latestIncoming?.createdAt })
    : clientHasUnread({ clientLastReadAt: issue.clientLastReadAt, latestAdminMessageAt: latestIncoming?.createdAt });

  if (!unread) {
    return NextResponse.json({
      changed: false,
      adminLastReadAt: issue.adminLastReadAt,
      clientLastReadAt: issue.clientLastReadAt,
    });
  }

  const at = readTimestamp(new Date(), latestIncoming?.createdAt);
  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: payload.role === 'admin' ? { adminLastReadAt: at } : { clientLastReadAt: at },
    select: { adminLastReadAt: true, clientLastReadAt: true },
  });

  return NextResponse.json({ changed: true, ...updated });
}
