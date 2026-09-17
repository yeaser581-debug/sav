import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { adminFrom, privateJson, unauthorized } from '@/lib/admin-guard';
import { listClients } from '@/lib/client-directory';
import { CLIENT_PAGE_SIZE, normalizeQuery, parsePaging } from '@/lib/client-search';
import { LIMITS, checkLengths } from '@/lib/limits';

// The list never carries QR login tokens: those are fetched one client at a
// time from /api/clients/[id]/qr when an admin actually opens a QR code.
export async function GET(req: NextRequest) {
  if (!adminFrom(req)) return unauthorized();

  const params = req.nextUrl.searchParams;
  const { page, limit } = parsePaging(params, CLIENT_PAGE_SIZE);
  const result = await listClients({ query: normalizeQuery(params.get('q')), page, limit });

  return privateJson(result);
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

    if (!buildingId) {
      return NextResponse.json({ error: 'Sélectionnez l’immeuble du résident.' }, { status: 400 });
    }

    const tooLong = checkLengths([
      ['L’identifiant', login, LIMITS.login],
      ['Le mot de passe', password, LIMITS.password],
      ['Le nom', name, LIMITS.name],
      ['Le numéro d’unité', unitNumber, LIMITS.unitNumber],
      ['Le téléphone', phone, LIMITS.phone],
      ['L’email', email, LIMITS.email],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });


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
        buildingId: parseInt(buildingId),
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
