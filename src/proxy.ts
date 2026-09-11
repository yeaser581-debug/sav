import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/client-login',
  '/api/auth/logout',
  '/api/auth/qr',
  '/api/auth/otp/send',
  '/api/auth/otp/verify',
];

const ROLE_PREFIXES: Record<string, string[]> = {
  admin: ['/admin'],
  agent: ['/agent'],
  client: ['/client'],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/uploads') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.startsWith('/icons')
  ) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get('cookie');
  const token = cookieHeader
    ?.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('token='))
    ?.split('=')
    .slice(1)
    .join('=') ?? null;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = verifyToken(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete('token');
    return res;
  }

  if (payload.role === 'admin') {
    const admin = await prisma.admin.findUnique({ where: { id: payload.id }, select: { isActive: true } });
    if (!admin || !admin.isActive) {
      const res = pathname.startsWith('/api')
        ? NextResponse.json({ error: 'ACCOUNT_DISABLED', message: 'Ce compte administrateur a été désactivé.' }, { status: 401 })
        : NextResponse.redirect(new URL('/login?error=disabled', request.url));
      res.cookies.delete('token');
      return res;
    }
  }

  let mustSetPassword = false;
  if (payload.role === 'client') {
    const client = await prisma.client.findUnique({ where: { id: payload.id }, select: { mustSetPassword: true } });
    mustSetPassword = client?.mustSetPassword === true;
    const ACTIVATION_ALLOWED = ['/client/activate', '/api/auth/set-password'];
    if (mustSetPassword && !ACTIVATION_ALLOWED.some(p => pathname.startsWith(p))) {
      return pathname.startsWith('/api')
        ? NextResponse.json({ error: 'MUST_SET_PASSWORD', message: 'Veuillez définir votre mot de passe avant de continuer.' }, { status: 403 })
        : NextResponse.redirect(new URL('/client/activate', request.url));
    }
  }

  const allowedPrefixes = ROLE_PREFIXES[payload.role] ?? [];
  const roleMatch = allowedPrefixes.some(p => pathname.startsWith(p));

  if (!pathname.startsWith('/api') && !roleMatch) {
    return NextResponse.redirect(new URL(`/${payload.role}`, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(payload.id));
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-super-admin', String(payload.isSuperAdmin === true));
  requestHeaders.set('x-must-set-password', String(mustSetPassword));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
