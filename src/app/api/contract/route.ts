import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contract = await prisma.contract.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(contract || { content: '' });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    // Set all existing contracts to inactive
    await prisma.contract.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new active contract
    const contract = await prisma.contract.create({
      data: {
        content,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, contract }, { status: 201 });
  } catch (err) {
    console.error('[CONTRACT UPDATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
