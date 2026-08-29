import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getActorName, logRestore } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin' || !payload.isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const areaId = parseInt(id);

  try {
    const area = await prisma.area.update({ where: { id: areaId }, data: { deletedAt: null } });

    const actorName = await getActorName(payload);
    await logRestore('Area', area.id, area.name, payload.id, actorName);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[AREA RESTORE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
