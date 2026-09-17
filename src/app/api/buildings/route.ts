import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { LIMITS, checkLengths } from '@/lib/limits';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.role !== 'admin' && payload.role !== 'agent')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const buildings = await prisma.building.findMany({
    where: { deletedAt: null },
    include: {
      area: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(buildings);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, address, areaId } = await req.json();

    if (!name || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tooLong = checkLengths([
      ['Le nom de l’immeuble', name, LIMITS.name],
      ['L’adresse', address, LIMITS.address],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });


    const building = await prisma.building.create({
      data: {
        name,
        address,
        areaId: areaId ? parseInt(areaId) : null,
      },
      include: { area: true },
    });

    return NextResponse.json({ success: true, building }, { status: 201 });
  } catch (err) {
    console.error('[BUILDING CREATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
