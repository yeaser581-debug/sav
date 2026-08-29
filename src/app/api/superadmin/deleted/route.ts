import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

type DeletedItem = {
  entityType: 'Agent' | 'Client' | 'Area' | 'Building';
  id: number;
  label: string;
  subtitle: string;
  deletedAt: string;
  deletedByName: string | null;
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin' || !payload.isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [agents, clients, areas, buildings, deleteLogs] = await Promise.all([
    prisma.agent.findMany({ where: { deletedAt: { not: null } }, select: { id: true, name: true, email: true, deletedAt: true } }),
    prisma.client.findMany({ where: { deletedAt: { not: null } }, select: { id: true, name: true, login: true, deletedAt: true } }),
    prisma.area.findMany({ where: { deletedAt: { not: null } }, select: { id: true, name: true, deletedAt: true } }),
    prisma.building.findMany({ where: { deletedAt: { not: null } }, select: { id: true, name: true, address: true, deletedAt: true } }),
    prisma.auditLog.findMany({ where: { action: 'DELETE' }, orderBy: { createdAt: 'desc' } }),
  ]);

  const latestDeleteBy = new Map<string, string>();
  for (const log of deleteLogs) {
    const key = `${log.entityType}:${log.entityId}`;
    if (!latestDeleteBy.has(key)) latestDeleteBy.set(key, log.performedByName);
  }

  const items: DeletedItem[] = [
    ...agents.map(a => ({
      entityType: 'Agent' as const, id: a.id, label: a.name, subtitle: a.email,
      deletedAt: a.deletedAt!.toISOString(), deletedByName: latestDeleteBy.get(`Agent:${a.id}`) ?? null,
    })),
    ...clients.map(c => ({
      entityType: 'Client' as const, id: c.id, label: c.name || c.login, subtitle: c.login,
      deletedAt: c.deletedAt!.toISOString(), deletedByName: latestDeleteBy.get(`Client:${c.id}`) ?? null,
    })),
    ...areas.map(a => ({
      entityType: 'Area' as const, id: a.id, label: a.name, subtitle: 'Zone',
      deletedAt: a.deletedAt!.toISOString(), deletedByName: latestDeleteBy.get(`Area:${a.id}`) ?? null,
    })),
    ...buildings.map(b => ({
      entityType: 'Building' as const, id: b.id, label: b.name, subtitle: b.address || 'Immeuble',
      deletedAt: b.deletedAt!.toISOString(), deletedByName: latestDeleteBy.get(`Building:${b.id}`) ?? null,
    })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  return NextResponse.json(items);
}
