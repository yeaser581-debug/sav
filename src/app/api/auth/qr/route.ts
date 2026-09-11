import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { getPublicBaseUrl } from '@/lib/request';
import { consume, clientIp } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const baseUrl = getPublicBaseUrl(req);

  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=missing_token', baseUrl));
    }

    const { allowed } = consume(`qr:${clientIp(req)}`, 20, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.redirect(new URL('/login?error=rate_limited', baseUrl));
    }

    const client = await prisma.client.findFirst({ where: { qrToken: token, deletedAt: null } });

    if (!client) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', baseUrl));
    }

    if (client.qrUsedAt) {
      return NextResponse.redirect(new URL('/login?error=qr_used', baseUrl));
    }
    await prisma.client.update({ where: { id: client.id }, data: { qrUsedAt: new Date() } });

    const jwtToken = signToken({
      id: client.id,
      email: client.email ?? client.login,
      role: 'client',
    });

    const res = NextResponse.redirect(new URL('/client', baseUrl));
    res.cookies.set('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[QR LOGIN ERROR]', err);
    return NextResponse.redirect(new URL('/login?error=server_error', baseUrl));
  }
}
