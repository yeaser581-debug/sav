import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'agent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const visits = await prisma.visit.findMany({
      where: { issue: { agentId: payload.id } },
      include: {
        issue: {
          select: { id: true, originalDescription: true, status: true, severity: true, client: { select: { unitNumber: true, name: true, phone: true } } }
        }
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json(visits);
  } catch (err) {
    console.error('[GET VISITS ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
