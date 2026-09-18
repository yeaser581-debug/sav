import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { enforce } from '@/lib/rate-limit';
import { LIMITS, checkLengths } from '@/lib/limits';
import { SIGN_IN_ERROR, identifierKind, normalizeIdentifier } from '@/lib/sign-in';

const WINDOW_MS = 10 * 60 * 1000;
/** Attempts on one identifier: enough for a typo, not for guessing. */
const PER_IDENTIFIER = 8;
/**
 * Attempts from one address, whatever identifier is tried. Unit codes are
 * sequential, so without this a script could walk the whole residence eight
 * guesses at a time.
 */
const PER_ADDRESS = 30;

function refuse() {
  return NextResponse.json({ error: SIGN_IN_ERROR }, { status: 401 });
}

/** One entry point for residents and staff: the identifier says which. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = normalizeIdentifier(body.identifier);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Renseignez votre identifiant et votre mot de passe.' }, { status: 400 });
    }

    const tooLong = checkLengths([
      ['L’identifiant', identifier, LIMITS.email],
      ['Le mot de passe', password, LIMITS.password],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });

    const slowed = enforce(req, 'sign-in', { limit: PER_IDENTIFIER, windowMs: WINDOW_MS, identifier })
      ?? enforce(req, 'sign-in-ip', { limit: PER_ADDRESS, windowMs: WINDOW_MS });
    if (slowed) return slowed;

    if (identifierKind(identifier) === 'email') {
      const admin = await prisma.admin.findUnique({ where: { email: identifier } });
      if (admin && await bcrypt.compare(password, admin.passwordHash)) {
        if (!admin.isActive) {
          return NextResponse.json({ error: 'Ce compte administrateur a été désactivé.' }, { status: 403 });
        }
        return sessionFor(
          { id: admin.id, email: admin.email, role: 'admin', isSuperAdmin: admin.isSuperAdmin },
          { id: admin.id, name: admin.name, email: admin.email, role: 'admin', isSuperAdmin: admin.isSuperAdmin },
        );
      }

      const agent = await prisma.agent.findFirst({ where: { email: identifier, deletedAt: null } });
      if (agent && await bcrypt.compare(password, agent.passwordHash)) {
        return sessionFor(
          { id: agent.id, email: agent.email, role: 'agent' },
          { id: agent.id, name: agent.name, email: agent.email, role: 'agent' },
        );
      }

      return refuse();
    }

    const client = await prisma.client.findFirst({ where: { login: identifier, deletedAt: null } });
    if (client && await bcrypt.compare(password, client.passwordHash)) {
      return sessionFor(
        { id: client.id, email: client.email ?? client.login, role: 'client' },
        { id: client.id, name: client.name, login: client.login, role: 'client' },
      );
    }

    return refuse();
  } catch (err) {
    console.error('[SIGN IN ERROR]', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

function sessionFor(
  claims: { id: number; email: string; role: 'admin' | 'agent' | 'client'; isSuperAdmin?: boolean },
  user: Record<string, unknown>,
) {
  const res = NextResponse.json({ success: true, user });
  res.cookies.set('token', signToken(claims), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
