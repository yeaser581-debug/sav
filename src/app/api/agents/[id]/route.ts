import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getActorName, logUpdate, logDelete } from '@/lib/audit';
import bcrypt from 'bcryptjs';

const AGENT_SELECT = { id: true, name: true, email: true, phone: true, createdAt: true } as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const agentId = parseInt(id);
  const body = await req.json();

  try {
    const before = await prisma.agent.findUnique({ where: { id: agentId }, select: AGENT_SELECT });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const passwordHash = body.password?.trim() ? await bcrypt.hash(body.password.trim(), 10) : undefined;

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(passwordHash && { passwordHash }),
      },
      select: AGENT_SELECT,
    });

    const actorName = await getActorName(payload);
    await logUpdate('Agent', agent.id, agent.name, before, agent, payload.id, actorName);

    return NextResponse.json(agent);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Cet email est déjà utilisé par un autre agent.' }, { status: 409 });
    }
    console.error('[AGENT UPDATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const agentId = parseInt(id);

  try {
    const activeCount = await prisma.issue.count({
      where: { agentId, status: { in: ['IN_PROGRESS', 'RESOLVED', 'DISPUTED'] } },
    });
    if (activeCount > 0) {
      return NextResponse.json({
        error: `Cet agent a ${activeCount} réclamation${activeCount > 1 ? 's' : ''} active${activeCount > 1 ? 's' : ''}. Réassignez-les avant de le supprimer.`,
      }, { status: 409 });
    }

    const agent = await prisma.agent.update({ where: { id: agentId }, data: { deletedAt: new Date() } });

    const actorName = await getActorName(payload);
    await logDelete('Agent', agent.id, agent.name, payload.id, actorName);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[AGENT DELETE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
