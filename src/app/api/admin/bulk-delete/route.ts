import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorName, logDelete } from '@/lib/audit';
import { adminFrom, privateJson, unauthorized } from '@/lib/admin-guard';
import { BULK_ENTITIES, parseBulkRequest, type BulkEntity } from '@/lib/bulk-delete';

type Row = { id: number; name: string };
type Refusal = { id: number; name: string; reason: string };

/** Rows the admin may delete, and what stands in the way of each. */
async function load(entity: BulkEntity, ids: number[]): Promise<{ rows: Row[]; refusals: Refusal[] }> {
  const where = { id: { in: ids }, deletedAt: null };

  if (entity === 'clients') {
    const rows = await prisma.client.findMany({ where, select: { id: true, name: true, login: true } });
    return { rows: rows.map(r => ({ id: r.id, name: r.name || r.login })), refusals: [] };
  }

  if (entity === 'agents') {
    const rows = await prisma.agent.findMany({ where, select: { id: true, name: true } });
    // The same guard as deleting one agent: their open work must be reassigned
    // first, or it would be left with nobody responsible.
    const busy = await prisma.issue.groupBy({
      by: ['agentId'],
      where: { agentId: { in: rows.map(r => r.id) }, status: { in: ['IN_PROGRESS', 'RESOLVED', 'DISPUTED'] } },
      _count: { _all: true },
    });
    const counts = new Map(busy.flatMap(b => (b.agentId ? [[b.agentId, b._count._all] as const] : [])));

    const refusals = rows
      .filter(r => counts.has(r.id))
      .map(r => {
        const n = counts.get(r.id)!;
        return { id: r.id, name: r.name, reason: `${n} réclamation${n > 1 ? 's' : ''} active${n > 1 ? 's' : ''} à réassigner.` };
      });
    return { rows: rows.filter(r => !counts.has(r.id)), refusals };
  }

  if (entity === 'areas') {
    const rows = await prisma.area.findMany({ where, select: { id: true, name: true } });
    return { rows, refusals: [] };
  }

  const rows = await prisma.building.findMany({ where, select: { id: true, name: true } });
  return { rows, refusals: [] };
}

async function softDelete(entity: BulkEntity, ids: number[]) {
  const data = { deletedAt: new Date() };
  const where = { id: { in: ids } };
  if (entity === 'clients') return prisma.client.updateMany({ where, data });
  if (entity === 'agents') return prisma.agent.updateMany({ where, data });
  if (entity === 'areas') return prisma.area.updateMany({ where, data });
  return prisma.building.updateMany({ where, data });
}

/**
 * Deletes several rows at once, with the same rules and the same audit trail as
 * deleting them one by one. Rows that may not go are reported, not skipped in
 * silence.
 */
export async function POST(req: NextRequest) {
  const admin = adminFrom(req);
  if (!admin) return unauthorized();

  const parsed = parseBulkRequest(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { entity, ids } = parsed;

  try {
    const { rows, refusals } = await load(entity, ids);
    if (rows.length === 0) {
      return privateJson({ deleted: 0, refused: refusals, missing: ids.length - refusals.length });
    }

    await softDelete(entity, rows.map(r => r.id));

    const actorName = await getActorName(admin);
    for (const row of rows) {
      await logDelete(BULK_ENTITIES[entity].audit, row.id, row.name, admin.id, actorName);
    }

    return privateJson({
      deleted: rows.length,
      refused: refusals,
      missing: ids.length - rows.length - refusals.length,
    });
  } catch (err) {
    console.error('[BULK DELETE ERROR]', err);
    return NextResponse.json({ error: 'Suppression impossible.' }, { status: 500 });
  }
}
