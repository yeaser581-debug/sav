import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getActorName, logUpdate, logDelete } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const CLIENT_SELECT = {
  id: true, name: true, login: true, unitNumber: true, phone: true,
  email: true, qrToken: true, qrUsedAt: true, mustSetPassword: true,
  buildingId: true, createdAt: true,
} as const;

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
  const clientId = parseInt(id);
  const body = await req.json();

  try {
    const before = await prisma.client.findUnique({ where: { id: clientId }, select: CLIENT_SELECT });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const passwordHash = body.password?.trim() ? await bcrypt.hash(body.password.trim(), 10) : undefined;
    const newQrToken = body.regenerateQr === true ? crypto.randomBytes(32).toString('hex') : undefined;

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(body.login !== undefined && { login: body.login }),
        ...(body.name !== undefined && { name: body.name || null }),
        ...(body.unitNumber !== undefined && { unitNumber: body.unitNumber }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.buildingId && { buildingId: parseInt(body.buildingId) }),
        // Any password an admin sets is temporary: the resident must replace it
        // themselves before using the account further (see proxy.ts mustSetPassword gate).
        ...(passwordHash && { passwordHash, mustSetPassword: true }),
        ...(newQrToken && { qrToken: newQrToken, qrUsedAt: null }),
      },
      select: CLIENT_SELECT,
    });

    const actorName = await getActorName(payload);
    await logUpdate('Client', client.id, client.name || client.login, before, client, payload.id, actorName);

    return NextResponse.json(client);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Ce login est déjà utilisé par un autre client.' }, { status: 409 });
    }
    console.error('[CLIENT UPDATE ERROR]', err);
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
  const clientId = parseInt(id);

  try {
    const client = await prisma.client.update({ where: { id: clientId }, data: { deletedAt: new Date() } });

    const actorName = await getActorName(payload);
    await logDelete('Client', client.id, client.name || client.login, payload.id, actorName);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[CLIENT DELETE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
