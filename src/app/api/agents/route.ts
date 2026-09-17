import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { LIMITS, checkLengths } from '@/lib/limits';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, phone: true, createdAt: true },
  });

  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, email, password, phone } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tooLong = checkLengths([
      ['Le nom', name, LIMITS.name],
      ['L’email', email, LIMITS.email],
      ['Le mot de passe', password, LIMITS.password],
      ['Le téléphone', phone, LIMITS.phone],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });


    const passwordHash = await bcrypt.hash(password, 10);

    const agent = await prisma.agent.create({
      data: {
        name,
        email,
        passwordHash,
        phone,
      },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });

    return NextResponse.json({ success: true, agent }, { status: 201 });
  } catch (err) {
    console.error('[AGENT CREATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
