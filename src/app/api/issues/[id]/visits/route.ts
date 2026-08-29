import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'agent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const issueId = parseInt(id);

  try {
    const { scheduledAt } = await req.json();

    if (!scheduledAt) {
      return NextResponse.json({ error: 'Date and time required' }, { status: 400 });
    }

    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue || issue.agentId !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const visit = await prisma.visit.create({
      data: {
        issueId,
        scheduledAt: new Date(scheduledAt),
      },
    });

    return NextResponse.json({ success: true, visit }, { status: 201 });
  } catch (err) {
    console.error('[VISIT CREATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
