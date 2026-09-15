import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { decideVisitScheduling } from '@/lib/issue-workflow';
import { parseIssueId, toSnapshot } from '@/lib/issue-workflow-server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (payload.role !== 'agent') {
    return NextResponse.json({ error: 'Seul l’agent assigné peut planifier une visite.' }, { status: 403 });
  }

  const { id } = await params;
  const issueId = parseIssueId(id);
  if (issueId === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body: unknown = await req.json().catch(() => null);
  const rawDate = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).scheduledAt : undefined;
  if (typeof rawDate !== 'string' || !rawDate.trim()) {
    return NextResponse.json({ error: 'Date and time required' }, { status: 400 });
  }
  const scheduledAt = new Date(rawDate);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'Date de visite invalide.' }, { status: 400 });
  }

  try {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } });
    if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const decision = decideVisitScheduling({ role: 'agent', id: payload.id }, toSnapshot(issue));
    if (!decision.ok) {
      return NextResponse.json({ error: decision.message }, { status: decision.httpStatus });
    }

    const visit = await prisma.visit.create({
      data: {
        issueId,
        scheduledAt,
      },
    });

    return NextResponse.json({ success: true, visit }, { status: 201 });
  } catch (err) {
    console.error('[VISIT CREATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
