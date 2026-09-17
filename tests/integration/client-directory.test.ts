import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listClients } from '@/app/api/clients/route';
import { GET as getClient, PATCH as patchClient } from '@/app/api/clients/[id]/route';
import { GET as getClientIssues } from '@/app/api/clients/[id]/issues/route';
import { GET as getClientQr } from '@/app/api/clients/[id]/qr/route';
import { GET as search } from '@/app/api/search/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedAgent, seedBuilding, seedClient, seedIssue } from '../helpers/db';
import { authedRequest, routeParams, unauthedRequest } from '../helpers/request';

beforeEach(resetDb);

let adminAuth: { id: number; email: string; role: 'admin' };

beforeEach(async () => {
  const admin = await seedAdmin();
  adminAuth = { id: admin.id, email: admin.email, role: 'admin' };
});

const asAdmin = (path: string, options?: { method?: string; body?: unknown }) => authedRequest(path, adminAuth, options);
const idParams = (id: number | string) => routeParams({ id: String(id) });

async function body(res: Response) {
  expect(res.status, await res.clone().text()).toBe(200);
  return res.json();
}

describe('who may read the directory', () => {
  it('turns away anyone who is not an admin, on every endpoint', async () => {
    const client = await seedClient();
    const agent = await seedAgent();
    const outsiders = [
      unauthedRequest,
      (p: string) => authedRequest(p, { id: agent.id, email: agent.email, role: 'agent' }),
      (p: string) => authedRequest(p, { id: client.id, email: client.login, role: 'client' }),
    ];

    for (const req of outsiders) {
      expect((await listClients(req('/api/clients'))).status).toBe(401);
      expect((await getClient(req(`/api/clients/${client.id}`), idParams(client.id))).status).toBe(401);
      expect((await getClientIssues(req(`/api/clients/${client.id}/issues`), idParams(client.id))).status).toBe(401);
      expect((await getClientQr(req(`/api/clients/${client.id}/qr`), idParams(client.id))).status).toBe(401);
      expect((await search(req('/api/search?q=test'))).status).toBe(401);
    }
  });

  it('marks personal answers as not cacheable', async () => {
    const res = await listClients(asAdmin('/api/clients'));
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});

describe('GET /api/clients', () => {
  it('never returns QR login tokens', async () => {
    await seedClient({ login: 'a' });
    const data = await body(await listClients(asAdmin('/api/clients')));
    expect(data.clients).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('qrToken');
  });

  it('leaves out deleted clients', async () => {
    const gone = await seedClient({ login: 'gone' });
    await seedClient({ login: 'here' });
    await prisma.client.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });

    const data = await body(await listClients(asAdmin('/api/clients')));
    expect(data.clients.map((c: { login: string }) => c.login)).toEqual(['here']);
    expect(data.total).toBe(1);
  });

  it('pages the list and reports the full total', async () => {
    const building = await seedBuilding();
    for (let i = 0; i < 5; i++) await seedClient({ login: `c${i}`, buildingId: building.id });

    const first = await body(await listClients(asAdmin('/api/clients?page=1&limit=2')));
    const third = await body(await listClients(asAdmin('/api/clients?page=3&limit=2')));

    expect(first.total).toBe(5);
    expect(first.clients).toHaveLength(2);
    expect(third.clients).toHaveLength(1);
  });

  describe('search', () => {
    beforeEach(async () => {
      const atlas = await prisma.building.create({ data: { name: 'Résidence Atlas' } });
      const oasis = await prisma.building.create({ data: { name: 'Les Oasis' } });
      await seedClient({ login: 'lahcen.elfaid', name: 'LAHCEN el faid', unitNumber: 'B12', buildingId: atlas.id });
      await seedClient({ login: 'salma.b', name: 'Salma Bennani', unitNumber: 'C3', buildingId: oasis.id });
      await prisma.client.update({ where: { login: 'lahcen.elfaid' }, data: { phone: '06 61 23 45 78', email: 'lahcen@mail.test' } });
      await prisma.client.update({ where: { login: 'salma.b' }, data: { phone: '+212 670-110239' } });
    });

    const found = async (q: string) => {
      const data = await body(await listClients(asAdmin(`/api/clients?q=${encodeURIComponent(q)}`)));
      return data.clients.map((c: { login: string }) => c.login).sort();
    };

    it.each([
      ['lahcen', ['lahcen.elfaid']],
      ['el faid', ['lahcen.elfaid']],
      ['salma.b', ['salma.b']],
      ['b12', ['lahcen.elfaid']],
      ['atlas', ['lahcen.elfaid']],
      ['mail.test', ['lahcen.elfaid']],
      ['nobody', []],
    ])('finds %s by name, login, flat, building or email', async (q, expected) => {
      expect(await found(q)).toEqual(expected);
    });

    it.each([
      ['0661234578', ['lahcen.elfaid']],
      ['06 61 23 45 78', ['lahcen.elfaid']],
      ['+212661234578', ['lahcen.elfaid']],
      ['0670110239', ['salma.b']],
      ['110239', ['salma.b']],
    ])('finds %s whatever way the phone was typed', async (q, expected) => {
      expect(await found(q)).toEqual(expected);
    });

    it('does not find a deleted client by phone', async () => {
      await prisma.client.update({ where: { login: 'salma.b' }, data: { deletedAt: new Date() } });
      expect(await found('0670110239')).toEqual([]);
    });

    it('treats % and _ as plain characters, not wildcards', async () => {
      expect(await found('%')).toEqual([]);
      expect(await found('_')).toEqual([]);
    });
  });

  it('summarises each client’s claims in one pass', async () => {
    const busy = await seedClient({ login: 'busy' });
    await seedClient({ login: 'quiet' });
    await seedIssue({ clientId: busy.id, status: 'IN_PROGRESS' });
    await seedIssue({ clientId: busy.id, status: 'DISPUTED' });
    await seedIssue({ clientId: busy.id, status: 'CONFIRMED' });

    const data = await body(await listClients(asAdmin('/api/clients')));
    const byLogin = Object.fromEntries(data.clients.map((c: { login: string; claims: unknown }) => [c.login, c.claims]));

    expect(byLogin.busy).toMatchObject({ total: 3, open: 2 });
    expect(byLogin.busy.lastAt).not.toBeNull();
    expect(byLogin.quiet).toEqual({ total: 0, open: 0, lastAt: null });
  });
});

describe('GET /api/clients/[id]', () => {
  it('returns the client with building, zone and agent, without the QR token', async () => {
    const agent = await seedAgent({ name: 'Youssef Amrani' });
    const area = await prisma.area.create({ data: { name: 'Zone Nord', agentId: agent.id } });
    const building = await prisma.building.create({ data: { name: 'Résidence Atlas', address: 'Bd Anfa', areaId: area.id } });
    const client = await seedClient({ buildingId: building.id });

    const data = await body(await getClient(asAdmin(`/api/clients/${client.id}`), idParams(client.id)));

    expect(data.client.building).toMatchObject({
      name: 'Résidence Atlas', address: 'Bd Anfa',
      area: { name: 'Zone Nord', agent: { id: agent.id, name: 'Youssef Amrani' } },
    });
    expect(JSON.stringify(data)).not.toContain('qrToken');
    expect(JSON.stringify(data)).not.toContain('passwordHash');
  });

  it('does not name an agent who has been removed', async () => {
    const agent = await seedAgent();
    await prisma.agent.update({ where: { id: agent.id }, data: { deletedAt: new Date() } });
    const area = await prisma.area.create({ data: { name: 'Zone Sud', agentId: agent.id } });
    const building = await prisma.building.create({ data: { name: 'B', areaId: area.id } });
    const client = await seedClient({ buildingId: building.id });

    const data = await body(await getClient(asAdmin(`/api/clients/${client.id}`), idParams(client.id)));
    expect(data.client.building.area.agent).toBeNull();
  });

  it('counts claims by status and averages resolution time', async () => {
    const client = await seedClient();
    await seedIssue({ clientId: client.id, status: 'PENDING_AGENT' });
    await seedIssue({ clientId: client.id, status: 'DISPUTED' });
    const resolved = await seedIssue({ clientId: client.id, status: 'RESOLVED' });
    const created = new Date('2026-03-01T08:00:00Z');
    await prisma.issue.update({
      where: { id: resolved.id },
      data: { createdAt: created, resolvedAt: new Date(created.getTime() + 30 * 3_600_000) },
    });

    const { stats } = await body(await getClient(asAdmin(`/api/clients/${client.id}`), idParams(client.id)));

    expect(stats).toMatchObject({ total: 3, open: 2, resolved: 1, disputed: 1, rejected: 0, avgResolutionHours: 30 });
  });

  it.each(['999999', 'abc', '0', '-1', '1.5'])('answers 404 for %s', async id => {
    const res = await getClient(asAdmin(`/api/clients/${id}`), idParams(id));
    expect(res.status).toBe(404);
  });

  it('answers 404 for a deleted client', async () => {
    const client = await seedClient();
    await prisma.client.update({ where: { id: client.id }, data: { deletedAt: new Date() } });
    const res = await getClient(asAdmin(`/api/clients/${client.id}`), idParams(client.id));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/clients/[id]', () => {
  it('no longer echoes the QR token back, even when it was just regenerated', async () => {
    const client = await seedClient();
    const res = await patchClient(
      asAdmin(`/api/clients/${client.id}`, { method: 'PATCH', body: { regenerateQr: true } }),
      idParams(client.id),
    );
    const data = await body(res);
    expect(data).not.toHaveProperty('qrToken');

    const after = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(after.qrToken).not.toBe(client.qrToken);
  });
});

describe('GET /api/clients/[id]/issues', () => {
  async function seedHistory() {
    const agent = await seedAgent({ name: 'Youssef' });
    const client = await seedClient();
    const other = await seedClient({ login: 'other' });
    const at = (d: number) => new Date(Date.UTC(2026, 5, d));

    const specs = [
      { status: 'PENDING_AGENT', day: 1 },
      { status: 'IN_PROGRESS', day: 2 },
      { status: 'DISPUTED', day: 3 },
      { status: 'RESOLVED', day: 4 },
      { status: 'CONFIRMED', day: 5 },
      { status: 'REJECTED', day: 6 },
    ] as const;
    const ids: number[] = [];
    for (const s of specs) {
      const issue = await seedIssue({ clientId: client.id, status: s.status, agentId: s.status === 'PENDING_AGENT' ? null : agent.id });
      await prisma.issue.update({ where: { id: issue.id }, data: { createdAt: at(s.day) } });
      ids.push(issue.id);
    }
    await seedIssue({ clientId: other.id, originalDescription: 'Not theirs' });
    return { client, ids };
  }

  const list = async (clientId: number, qs = '') =>
    body(await getClientIssues(asAdmin(`/api/clients/${clientId}/issues${qs}`), idParams(clientId)));

  it('lists only this client’s claims, newest first', async () => {
    const { client, ids } = await seedHistory();
    const data = await list(client.id);
    expect(data.total).toBe(6);
    expect(data.issues.map((i: { id: number }) => i.id)).toEqual([...ids].reverse());
  });

  it.each([
    ['open', ['PENDING_AGENT', 'IN_PROGRESS', 'DISPUTED']],
    ['resolved', ['RESOLVED', 'CONFIRMED']],
    ['disputed', ['DISPUTED']],
    ['rejected', ['REJECTED']],
  ])('filters %s claims', async (filter, statuses) => {
    const { client } = await seedHistory();
    const data = await list(client.id, `?status=${filter}`);
    expect(data.filter).toBe(filter);
    expect(data.issues.map((i: { status: string }) => i.status).sort()).toEqual([...statuses].sort());
    expect(data.total).toBe(statuses.length);
  });

  it('ignores an unknown filter instead of failing', async () => {
    const { client } = await seedHistory();
    const data = await list(client.id, '?status=bogus');
    expect(data.filter).toBe('all');
    expect(data.total).toBe(6);
  });

  it('pages the history', async () => {
    const { client, ids } = await seedHistory();
    const second = await list(client.id, '?page=2&limit=4');
    expect(second.issues.map((i: { id: number }) => i.id)).toEqual([ids[1], ids[0]]);
    expect(second.total).toBe(6);
  });

  it('carries the agent, a short description and the latest message', async () => {
    const client = await seedClient();
    const agent = await seedAgent({ name: 'Youssef' });
    const issue = await seedIssue({ clientId: client.id, agentId: agent.id, status: 'IN_PROGRESS', originalDescription: 'Fuite '.repeat(100) });
    await prisma.issueMessage.create({ data: { issueId: issue.id, senderId: client.id, senderType: 'CLIENT', message: 'first', createdAt: new Date('2026-01-01') } });
    await prisma.issueMessage.create({ data: { issueId: issue.id, senderId: agent.id, senderType: 'ADMIN', message: 'Le plombier passe jeudi.', createdAt: new Date('2026-01-02') } });

    const [row] = (await list(client.id)).issues;
    expect(row.agent).toEqual({ name: 'Youssef' });
    expect(row.description.length).toBeLessThanOrEqual(160);
    expect(row.lastMessage).toMatchObject({ message: 'Le plombier passe jeudi.', senderType: 'ADMIN' });
    expect(row).not.toHaveProperty('originalDescription');
  });

  it('answers 404 for a client that does not exist or was deleted', async () => {
    const client = await seedClient();
    await prisma.client.update({ where: { id: client.id }, data: { deletedAt: new Date() } });
    expect((await getClientIssues(asAdmin('/x'), idParams(client.id))).status).toBe(404);
    expect((await getClientIssues(asAdmin('/x'), idParams(987654))).status).toBe(404);
  });
});

describe('GET /api/clients/[id]/qr', () => {
  it('hands out one client’s token on request', async () => {
    const client = await seedClient();
    const data = await body(await getClientQr(asAdmin(`/api/clients/${client.id}/qr`), idParams(client.id)));
    expect(data).toEqual({ qrToken: client.qrToken, qrUsedAt: null });
  });

  it('answers 404 for a deleted client', async () => {
    const client = await seedClient();
    await prisma.client.update({ where: { id: client.id }, data: { deletedAt: new Date() } });
    expect((await getClientQr(asAdmin('/x'), idParams(client.id))).status).toBe(404);
  });
});

describe('GET /api/search', () => {
  it('does nothing below two characters', async () => {
    await seedClient({ name: 'Ali' });
    const data = await body(await search(asAdmin('/api/search?q=a')));
    expect(data).toMatchObject({ clients: [], issues: [] });
  });

  it('finds clients and their claims together', async () => {
    const client = await seedClient({ login: 'lahcen', name: 'Lahcen El Faid', unitNumber: 'B12' });
    await seedIssue({ clientId: client.id, originalDescription: 'Fuite cuisine' });

    const data = await body(await search(asAdmin('/api/search?q=b12')));
    expect(data.clients.map((c: { login: string }) => c.login)).toEqual(['lahcen']);
    expect(data.issues).toHaveLength(1);
    expect(data.issues[0].client).toMatchObject({ id: client.id, name: 'Lahcen El Faid' });
    expect(JSON.stringify(data)).not.toContain('qrToken');
  });

  it('puts an exact claim number first', async () => {
    const client = await seedClient();
    const target = await seedIssue({ clientId: client.id, originalDescription: 'Old one' });
    await prisma.issue.update({ where: { id: target.id }, data: { createdAt: new Date('2020-01-01') } });
    for (let i = 0; i < 3; i++) await seedIssue({ clientId: client.id, originalDescription: `Voir aussi #${target.id}` });

    const data = await body(await search(asAdmin(`/api/search?q=%23${target.id}`)));
    expect(data.issues).toHaveLength(4);
    expect(data.issues[0].id).toBe(target.id);
  });

  it('caps each group at five results', async () => {
    const building = await seedBuilding();
    for (let i = 0; i < 8; i++) {
      const c = await seedClient({ login: `dup${i}`, name: `Dupont ${i}`, buildingId: building.id });
      await seedIssue({ clientId: c.id, originalDescription: 'Dupont problem' });
    }
    const data = await body(await search(asAdmin('/api/search?q=dupont')));
    expect(data.clients).toHaveLength(5);
    expect(data.issues).toHaveLength(5);
  });

  it('hides claims of deleted clients', async () => {
    const client = await seedClient({ name: 'Ghost' });
    await seedIssue({ clientId: client.id, originalDescription: 'Ghost claim' });
    await prisma.client.update({ where: { id: client.id }, data: { deletedAt: new Date() } });

    const data = await body(await search(asAdmin('/api/search?q=ghost')));
    expect(data).toMatchObject({ clients: [], issues: [] });
  });
});
