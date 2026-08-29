import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getActorName, logUpdate, logDelete } from '@/lib/audit';

const BUILDING_SCALAR_SELECT = { id: true, name: true, address: true, areaId: true } as const;

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
  const buildingId = parseInt(id);
  const body = await req.json();

  try {
    const before = await prisma.building.findUnique({ where: { id: buildingId }, select: BUILDING_SCALAR_SELECT });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const building = await prisma.building.update({
      where: { id: buildingId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.address !== undefined && { address: body.address || null }),
        ...(body.areaId !== undefined && { areaId: body.areaId ? parseInt(body.areaId) : null }),
      },
      include: { area: true },
    });

    const actorName = await getActorName(payload);
    await logUpdate(
      'Building', building.id, building.name, before,
      { id: building.id, name: building.name, address: building.address, areaId: building.areaId },
      payload.id, actorName
    );

    return NextResponse.json(building);
  } catch (err) {
    console.error('[BUILDING UPDATE ERROR]', err);
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
  const buildingId = parseInt(id);

  try {
    const building = await prisma.building.update({ where: { id: buildingId }, data: { deletedAt: new Date() } });

    const actorName = await getActorName(payload);
    await logDelete('Building', building.id, building.name, payload.id, actorName);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[BUILDING DELETE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
