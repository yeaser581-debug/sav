import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, login: true, unitNumber: true, phone: true,
      email: true, qrToken: true, qrUsedAt: true, mustSetPassword: true,
      buildingId: true, createdAt: true,
    },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { login, password, name, unitNumber, phone, email, buildingId } = await req.json();

    if (!login || !password || !unitNumber) {
      return NextResponse.json({ error: 'Missing required fields: login, password, unitNumber' }, { status: 400 });
    }

    const existing = await prisma.client.findUnique({ where: { login } });
    if (existing) {
      return NextResponse.json({ error: `Le login "${login}" est déjà utilisé.` }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const qrToken = crypto.randomBytes(32).toString('hex');

    const client = await prisma.client.create({
      data: {
        login,
        passwordHash,
        qrToken,
        name: name || null,
        unitNumber,
        phone: phone || null,
        email: email || null,
        ...(buildingId && { buildingId: parseInt(buildingId) }),
      },
      select: {
        id: true, name: true, login: true, unitNumber: true, phone: true,
        email: true, qrToken: true, qrUsedAt: true, mustSetPassword: true,
        buildingId: true, createdAt: true,
      },
    });

    return NextResponse.json({ success: true, client }, { status: 201 });
  } catch (err) {
    console.error('[CLIENT CREATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
