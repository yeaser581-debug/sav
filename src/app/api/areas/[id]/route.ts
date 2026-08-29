import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getActorName, logUpdate, logDelete } from '@/lib/audit';

const AREA_SCALAR_SELECT = { id: true, name: true, agentId: true } as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const areaId = parseInt(id);
  const body = await req.json();

  try {
    const before = await prisma.area.findUnique({ where: { id: areaId }, select: AREA_SCALAR_SELECT });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const area = await prisma.area.update({
      where: { id: areaId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.agentId !== undefined && { agentId: body.agentId ? parseInt(body.agentId) : null }),
      },
      include: { agent: { select: { id: true, name: true, email: true } }, buildings: { select: { id: true, name: true } } },
    });

    const actorName = await getActorName(payload);
    await logUpdate('Area', area.id, area.name, before, { id: area.id, name: area.name, agentId: area.agentId }, payload.id, actorName);

    return NextResponse.json(area);
  } catch (err) {
    console.error('[AREA UPDATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const areaId = parseInt(id);

  try {
    const area = await prisma.area.update({ where: { id: areaId }, data: { deletedAt: new Date() } });

    const actorName = await getActorName(payload);
    await logDelete('Area', area.id, area.name, payload.id, actorName);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[AREA DELETE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
