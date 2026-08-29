import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=missing_token', req.url));
    }

    const client = await prisma.client.findFirst({ where: { qrToken: token, deletedAt: null } });

    if (!client) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
    }

    // The QR code is a one-time activation key, not a permanent login: once scanned,
    // it's marked used and can never be replayed (e.g. from a photo of the door sticker).
    if (client.qrUsedAt) {
      return NextResponse.redirect(new URL('/login?error=qr_used', req.url));
    }
    await prisma.client.update({ where: { id: client.id }, data: { qrUsedAt: new Date() } });

    const jwtToken = signToken({
      id: client.id,
      email: client.email ?? client.login,
      role: 'client',
    });

    const res = NextResponse.redirect(new URL('/client', req.url));
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
    return NextResponse.redirect(new URL('/login?error=server_error', req.url));
  }
}
