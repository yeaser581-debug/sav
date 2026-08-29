import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    let user: { id: number; email: string; passwordHash: string; name: string; isSuperAdmin?: boolean; isActive?: boolean } | null = null;

    if (role === 'admin') {
      user = await prisma.admin.findUnique({ where: { email } });
    } else if (role === 'agent') {
      user = await prisma.agent.findFirst({ where: { email, deletedAt: null } });
    } else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (role === 'admin' && user.isActive === false) {
      return NextResponse.json({ error: 'Ce compte administrateur a été désactivé.' }, { status: 403 });
    }

    const isSuperAdmin = role === 'admin' ? user.isSuperAdmin === true : undefined;
    const token = signToken({ id: user.id, email: user.email, role, ...(isSuperAdmin && { isSuperAdmin }) });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role, isSuperAdmin },
    });

    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
