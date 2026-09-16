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

const DEFAULT_LIMIT = 15;

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'admin' || !payload.isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)) || DEFAULT_LIMIT));

  // The four tables are merged and sorted here, so the requested page can only
  // contain rows from the newest `page * limit` of each one - anything older
  // cannot reach it even if a single table supplies every row. That bound keeps
  // the queries from growing with the whole trash.
  const deleted = { deletedAt: { not: null } };
  const newest = { orderBy: { deletedAt: 'desc' }, take: page * limit } as const;

  const [agents, clients, areas, buildings, agentCount, clientCount, areaCount, buildingCount] = await Promise.all([
    prisma.agent.findMany({ where: deleted, select: { id: true, name: true, email: true, deletedAt: true }, ...newest }),
    prisma.client.findMany({ where: deleted, select: { id: true, name: true, login: true, deletedAt: true }, ...newest }),
    prisma.area.findMany({ where: deleted, select: { id: true, name: true, deletedAt: true }, ...newest }),
    prisma.building.findMany({ where: deleted, select: { id: true, name: true, address: true, deletedAt: true }, ...newest }),
    prisma.agent.count({ where: deleted }),
    prisma.client.count({ where: deleted }),
    prisma.area.count({ where: deleted }),
    prisma.building.count({ where: deleted }),
  ]);

  const merged: DeletedItem[] = [
    ...agents.map(a => ({
      entityType: 'Agent' as const, id: a.id, label: a.name, subtitle: a.email,
      deletedAt: a.deletedAt!.toISOString(), deletedByName: null,
    })),
    ...clients.map(c => ({
      entityType: 'Client' as const, id: c.id, label: c.name || c.login, subtitle: c.login,
      deletedAt: c.deletedAt!.toISOString(), deletedByName: null,
    })),
    ...areas.map(a => ({
      entityType: 'Area' as const, id: a.id, label: a.name, subtitle: 'Zone',
      deletedAt: a.deletedAt!.toISOString(), deletedByName: null,
    })),
    ...buildings.map(b => ({
      entityType: 'Building' as const, id: b.id, label: b.name, subtitle: b.address || 'Immeuble',
      deletedAt: b.deletedAt!.toISOString(), deletedByName: null,
    })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const items = merged.slice((page - 1) * limit, page * limit);

  // Who deleted them is only looked up for the rows actually being shown.
  const logs = items.length
    ? await prisma.auditLog.findMany({
        where: { action: 'DELETE', OR: items.map(i => ({ entityType: i.entityType, entityId: i.id })) },
        orderBy: { createdAt: 'desc' },
        select: { entityType: true, entityId: true, performedByName: true },
      })
    : [];

  const latestDeleteBy = new Map<string, string>();
  for (const log of logs) {
    const key = `${log.entityType}:${log.entityId}`;
    if (!latestDeleteBy.has(key)) latestDeleteBy.set(key, log.performedByName);
  }
  for (const item of items) {
    item.deletedByName = latestDeleteBy.get(`${item.entityType}:${item.id}`) ?? null;
  }

  const total = agentCount + clientCount + areaCount + buildingCount;
  return NextResponse.json({ items, total, page, limit });
}
