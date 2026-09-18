import { describe, it, expect, beforeEach } from 'vitest';
import { POST as bulkDelete } from '@/app/api/admin/bulk-delete/route';
import { prisma } from '@/lib/prisma';
import { MAX_BULK_IDS } from '@/lib/bulk-delete';
import { resetDb, seedAdmin, seedAgent, seedBuilding, seedClient, seedIssue } from '../helpers/db';
import { authedRequest, unauthedRequest } from '../helpers/request';

beforeEach(resetDb);

let admin: { id: number; email: string; role: 'admin' };

beforeEach(async () => {
  const row = await seedAdmin();
  admin = { id: row.id, email: row.email, role: 'admin' };
});

const ask = (body: unknown) => authedRequest('/api/admin/bulk-delete', admin, { method: 'POST', body });

async function body(res: Response) {
  expect(res.status, await res.clone().text()).toBe(200);
  return res.json();
}

describe('who may delete in bulk', () => {
  it('turns away an agent, a client and an anonymous caller', async () => {
    const client = await seedClient();
    const agent = await seedAgent();
    const payload = { entity: 'clients', ids: [client.id] };

    const callers = [
      unauthedRequest('/api/admin/bulk-delete', { method: 'POST', body: payload }),
      authedRequest('/api/admin/bulk-delete', { id: agent.id, email: agent.email, role: 'agent' }, { method: 'POST', body: payload }),
      authedRequest('/api/admin/bulk-delete', { id: client.id, email: client.login, role: 'client' }, { method: 'POST', body: payload }),
    ];
    for (const req of callers) expect((await bulkDelete(req)).status).toBe(401);

    const after = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(after.deletedAt).toBeNull();
  });
});

describe('what the request may ask for', () => {
  it.each([
    [{ entity: 'issues', ids: [1] }, 'inconnu'],
    [{ entity: 'clients', ids: [] }, 'Aucun'],
    [{ entity: 'clients', ids: ['1'] }, 'invalide'],
    [{ entity: 'clients', ids: [0] }, 'invalide'],
    [{ entity: 'clients' }, 'Aucun'],
    [{ ids: [1] }, 'inconnu'],
  ])('refuses %j', async (payload, hint) => {
    const res = await bulkDelete(ask(payload));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(hint);
  });

  it('refuses more than the cap in one request', async () => {
    const ids = Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => i + 1);
    const res = await bulkDelete(ask({ entity: 'clients', ids }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(String(MAX_BULK_IDS));
  });
});

describe('deleting clients', () => {
  it('removes every selected row and leaves the others alone', async () => {
    const building = await seedBuilding();
    const a = await seedClient({ login: 'a', buildingId: building.id });
    const b = await seedClient({ login: 'b', buildingId: building.id });
    const keep = await seedClient({ login: 'keep', buildingId: building.id });

    const data = await body(await bulkDelete(ask({ entity: 'clients', ids: [a.id, b.id] })));
    expect(data).toMatchObject({ deleted: 2, refused: [] });

    const rows = await prisma.client.findMany({ orderBy: { login: 'asc' }, select: { login: true, deletedAt: true } });
    expect(rows.map(r => [r.login, r.deletedAt !== null])).toEqual([['a', true], ['b', true], ['keep', false]]);
    expect(keep.id).toBeGreaterThan(0);
  });

  it('writes one audit entry per row, as deleting them one by one would', async () => {
    const a = await seedClient({ login: 'a', name: 'Ait Saad' });
    const b = await seedClient({ login: 'b', name: 'Alali Fouad' });

    await body(await bulkDelete(ask({ entity: 'clients', ids: [a.id, b.id] })));

    const logs = await prisma.auditLog.findMany({ where: { action: 'DELETE', entityType: 'Client' } });
    expect(logs).toHaveLength(2);
    expect(logs.map(l => l.entityLabel).sort()).toEqual(['Ait Saad', 'Alali Fouad']);
    expect(logs[0].performedById).toBe(admin.id);
  });

  it('ignores ids that do not exist instead of failing the whole batch', async () => {
    const client = await seedClient();
    const data = await body(await bulkDelete(ask({ entity: 'clients', ids: [client.id, 999999] })));
    expect(data).toMatchObject({ deleted: 1, missing: 1 });
  });

  it('does not delete a client twice', async () => {
    const client = await seedClient();
    await body(await bulkDelete(ask({ entity: 'clients', ids: [client.id] })));
    const second = await body(await bulkDelete(ask({ entity: 'clients', ids: [client.id] })));

    expect(second.deleted).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'DELETE' } })).toBe(1);
  });
});

describe('deleting agents', () => {
  it('refuses an agent with active claims, and says why', async () => {
    const busy = await seedAgent({ email: 'busy@test.local', name: 'Busy Agent' });
    const free = await seedAgent({ email: 'free@test.local', name: 'Free Agent' });
    const client = await seedClient();
    await seedIssue({ clientId: client.id, agentId: busy.id, status: 'IN_PROGRESS' });

    const data = await body(await bulkDelete(ask({ entity: 'agents', ids: [busy.id, free.id] })));

    expect(data.deleted).toBe(1);
    expect(data.refused).toHaveLength(1);
    expect(data.refused[0]).toMatchObject({ id: busy.id, name: 'Busy Agent' });
    expect(data.refused[0].reason).toContain('réclamation');

    expect((await prisma.agent.findUniqueOrThrow({ where: { id: busy.id } })).deletedAt).toBeNull();
    expect((await prisma.agent.findUniqueOrThrow({ where: { id: free.id } })).deletedAt).not.toBeNull();
  });

  it('allows an agent whose claims are all closed', async () => {
    const agent = await seedAgent();
    const client = await seedClient();
    await seedIssue({ clientId: client.id, agentId: agent.id, status: 'CONFIRMED' });

    const data = await body(await bulkDelete(ask({ entity: 'agents', ids: [agent.id] })));
    expect(data).toMatchObject({ deleted: 1, refused: [] });
  });
});

describe('deleting zones and buildings', () => {
  it('deletes zones', async () => {
    const zone = await prisma.area.create({ data: { name: 'Zone Nord' } });
    const data = await body(await bulkDelete(ask({ entity: 'areas', ids: [zone.id] })));

    expect(data.deleted).toBe(1);
    expect((await prisma.area.findUniqueOrThrow({ where: { id: zone.id } })).deletedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { entityType: 'Area', action: 'DELETE' } })).toBe(1);
  });

  it('deletes buildings and leaves their residents registered', async () => {
    const building = await seedBuilding();
    const client = await seedClient({ buildingId: building.id });

    const data = await body(await bulkDelete(ask({ entity: 'buildings', ids: [building.id] })));

    expect(data.deleted).toBe(1);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).deletedAt).toBeNull();
  });
});
