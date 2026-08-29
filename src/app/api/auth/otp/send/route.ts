import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Check if user exists (admin or agent)
    const admin = await prisma.admin.findUnique({ where: { email } });
    const agent = await prisma.agent.findFirst({ where: { email, deletedAt: null } });

    if (!admin && !agent) {
      // Don't reveal if user exists
      return NextResponse.json({ success: true });
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous OTPs for this email
    await prisma.oTP.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    await prisma.oTP.create({
      data: { email, code, expiresAt },
    });

    await transporter.sendMail({
      from: `"After-Sales Platform" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: 'Votre code de réinitialisation',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Code de vérification</h2>
          <p>Voici votre code de réinitialisation de mot de passe :</p>
          <div style="background: #f4f4f8; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">${code}</span>
          </div>
          <p style="color: #666;">Ce code expire dans <strong>10 minutes</strong>.</p>
          <p style="color: #666; font-size: 12px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[OTP SEND ERROR]', err);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
