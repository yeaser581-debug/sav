import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, code, newPassword } = await req.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const otp = await prisma.oTP.findFirst({
      where: {
        email,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Mark OTP as used
    await prisma.oTP.update({ where: { id: otp.id }, data: { used: true } });

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update whichever user type has this email
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (admin) {
      await prisma.admin.update({ where: { email }, data: { passwordHash } });
    } else {
      const agent = await prisma.agent.findUnique({ where: { email } });
      if (agent) {
        await prisma.agent.update({ where: { email }, data: { passwordHash } });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[OTP VERIFY ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
