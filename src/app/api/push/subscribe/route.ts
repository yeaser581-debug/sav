import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function authenticate(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  return token ? verifyToken(token) : null;
}

export async function POST(req: NextRequest) {
  const payload = authenticate(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : '';

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Abonnement invalide.' }, { status: 400 });
  }
  if (endpoint.length > 512) {
    return NextResponse.json({ error: 'Endpoint trop long.' }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: payload.id, userRole: payload.role, p256dh, auth },
    create: { endpoint, userId: payload.id, userRole: payload.role, p256dh, auth },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const payload = authenticate(req);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return NextResponse.json({ error: 'Endpoint requis.' }, { status: 400 });

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: payload.id, userRole: payload.role } });

  return NextResponse.json({ success: true });
}
