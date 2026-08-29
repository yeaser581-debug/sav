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

  // Allow public routes
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Allow Next.js internals & static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/uploads')
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

  // `proxy` always runs on the Node.js runtime (Next.js 16), so we can safely
  // verify the JWT signature here (not just decode it) and hit the database below.
  const payload = verifyToken(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete('token');
    return res;
  }

  // An admin account can be disabled (or a super admin demoted) after the token
  // was issued. JWTs are stateless, so we re-check live status on every request
  // instead of only at login — a disabled admin is kicked out immediately.
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

  // A client's first login (via QR or an admin-issued temporary password) must be
  // followed by setting their own password before anything else is accessible —
  // otherwise whatever was printed on the door remains a permanent credential.
  if (payload.role === 'client') {
    const client = await prisma.client.findUnique({ where: { id: payload.id }, select: { mustSetPassword: true } });
    const ACTIVATION_ALLOWED = ['/client/activate', '/api/auth/set-password'];
    if (client?.mustSetPassword && !ACTIVATION_ALLOWED.some(p => pathname.startsWith(p))) {
      return pathname.startsWith('/api')
        ? NextResponse.json({ error: 'MUST_SET_PASSWORD', message: 'Veuillez définir votre mot de passe avant de continuer.' }, { status: 403 })
        : NextResponse.redirect(new URL('/client/activate', request.url));
    }
  }

  // Role-based route protection
  const allowedPrefixes = ROLE_PREFIXES[payload.role] ?? [];
  const roleMatch = allowedPrefixes.some(p => pathname.startsWith(p));

  // The API routes handle their own authorization (verifying the token and role),
  // so we don't need to block /api/* requests here based on URL prefixes.

  // For page routes
  if (!pathname.startsWith('/api') && !roleMatch) {
    return NextResponse.redirect(new URL(`/${payload.role}`, request.url));
  }

  // Inject user info as headers for server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(payload.id));
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-super-admin', String(payload.isSuperAdmin === true));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
