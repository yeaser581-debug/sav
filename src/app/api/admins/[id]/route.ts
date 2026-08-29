import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getActorName, logUpdate } from '@/lib/audit';
import bcrypt from 'bcryptjs';

const ADMIN_SELECT = { id: true, name: true, email: true, isSuperAdmin: true, isActive: true, createdAt: true } as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin' || !payload.isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const adminId = parseInt(id);
  const body = await req.json();

  try {
    const before = await prisma.admin.findUnique({ where: { id: adminId }, select: ADMIN_SELECT });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (payload.id === adminId && (body.isSuperAdmin === false || body.isActive === false)) {
      return NextResponse.json({
        error: 'Vous ne pouvez pas retirer vos propres privilèges super admin ni désactiver votre propre compte. Demandez à un autre super admin.',
      }, { status: 400 });
    }

    if ((body.isSuperAdmin === false || body.isActive === false) && before.isSuperAdmin && before.isActive) {
      const otherActiveSuperAdmins = await prisma.admin.count({
        where: { isSuperAdmin: true, isActive: true, NOT: { id: adminId } },
      });
      if (otherActiveSuperAdmins === 0) {
        return NextResponse.json({
          error: 'Impossible : ce serait le dernier super admin actif du système.',
        }, { status: 400 });
      }
    }

    const passwordHash = body.password?.trim() ? await bcrypt.hash(body.password.trim(), 10) : undefined;

    const admin = await prisma.admin.update({
      where: { id: adminId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.isSuperAdmin !== undefined && { isSuperAdmin: body.isSuperAdmin === true }),
        ...(body.isActive !== undefined && { isActive: body.isActive === true }),
        ...(passwordHash && { passwordHash }),
      },
      select: ADMIN_SELECT,
    });

    const actorName = await getActorName(payload);
    await logUpdate('Admin', admin.id, admin.name, before, admin, payload.id, actorName);

    return NextResponse.json(admin);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Cet email est déjà utilisé par un autre administrateur.' }, { status: 409 });
    }
    console.error('[ADMIN UPDATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
