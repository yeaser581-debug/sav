import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.role !== 'admin' && payload.role !== 'agent')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const areas = await prisma.area.findMany({
    where: { deletedAt: null },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      buildings: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(areas);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, agentId } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const area = await prisma.area.create({
      data: {
        name,
        agentId: agentId ? parseInt(agentId) : null,
      },
      include: { agent: { select: { id: true, name: true, email: true } }, buildings: true },
    });

    return NextResponse.json({ success: true, area }, { status: 201 });
  } catch (err) {
    console.error('[AREA CREATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
