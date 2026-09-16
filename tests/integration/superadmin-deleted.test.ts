import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listDeleted } from '@/app/api/superadmin/deleted/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedClient } from '../helpers/db';
import { authedRequest, unauthedRequest } from '../helpers/request';

beforeEach(resetDb);

const superAdmin = { id: 1, email: 'super@test.local', role: 'admin' as const, isSuperAdmin: true };

// Deleted at a known instant, so the merge order across the four tables is
// something the test can actually assert rather than guess.
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);

async function deletedArea(name: string, minutesAgo: number) {
  return prisma.area.create({ data: { name, deletedAt: at(minutesAgo) } });
}

async function deletedAgent(name: string, minutesAgo: number) {
  return prisma.agent.create({
    data: { name, email: `${name}@test.local`, passwordHash: 'x', deletedAt: at(minutesAgo) },
  });
}

async function deletedBuilding(name: string, minutesAgo: number) {
  return prisma.building.create({ data: { name, deletedAt: at(minutesAgo) } });
}

function labels(body: { items: { label: string }[] }) {
  return body.items.map(i => i.label);
}

describe('GET /api/superadmin/deleted', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await listDeleted(unauthedRequest('/api/superadmin/deleted'));
    expect(res.status).toBe(401);
  });

  it('rejects an admin who is not a super admin', async () => {
    const admin = await seedAdmin();
    const res = await listDeleted(
      authedRequest('/api/superadmin/deleted', { id: admin.id, email: admin.email, role: 'admin' })
    );
    expect(res.status).toBe(401);
  });

  it('counts every deleted entity, not just the page it returns', async () => {
    for (let i = 0; i < 8; i++) await deletedArea(`Zone ${i}`, i);
    for (let i = 0; i < 4; i++) await deletedBuilding(`Immeuble ${i}`, i);

    const res = await listDeleted(authedRequest('/api/superadmin/deleted?page=1&limit=5', superAdmin));
    const body = await res.json();

    expect(body.total).toBe(12);
    expect(body.items).toHaveLength(5);
  });

  it('orders the merged tables by deletion date, newest first', async () => {
    await deletedArea('Zone ancienne', 30);
    await deletedAgent('agent-recent', 1);
    await deletedBuilding('Immeuble moyen', 10);

    const res = await listDeleted(authedRequest('/api/superadmin/deleted', superAdmin));
    const body = await res.json();

    expect(labels(body)).toEqual(['agent-recent', 'Immeuble moyen', 'Zone ancienne']);
  });

  // Deliberately lopsided: one table supplies almost every row, so a page-2
  // fetch that only reached `limit` rows per table would come back short.
  it('continues that same order onto the next page, with no row repeated or skipped', async () => {
    for (let i = 0; i < 9; i++) await deletedArea(`Zone ${i}`, i);
    await deletedBuilding('Immeuble', 0.5);

    const [first, second] = await Promise.all([
      listDeleted(authedRequest('/api/superadmin/deleted?page=1&limit=4', superAdmin)).then(r => r.json()),
      listDeleted(authedRequest('/api/superadmin/deleted?page=2&limit=4', superAdmin)).then(r => r.json()),
    ]);

    const all = await listDeleted(authedRequest('/api/superadmin/deleted?limit=100', superAdmin)).then(r => r.json());

    expect(labels(first)).toHaveLength(4);
    expect(labels(second)).toHaveLength(4);
    expect(labels(first)).toEqual(labels(all).slice(0, 4));
    expect(labels(second)).toEqual(labels(all).slice(4, 8));
    expect(new Set([...labels(first), ...labels(second)]).size).toBe(8);
  });

  it('returns an empty page past the end rather than failing', async () => {
    await deletedArea('Zone', 1);

    const res = await listDeleted(authedRequest('/api/superadmin/deleted?page=9&limit=15', superAdmin));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(1);
  });

  it('names who deleted each row on the page it is showing', async () => {
    const area = await deletedArea('Zone supprimée', 1);
    await prisma.auditLog.create({
      data: {
        entityType: 'Area', entityId: area.id, entityLabel: 'Zone supprimée',
        action: 'DELETE', performedByName: 'Reda', performedById: 1,
      },
    });

    const res = await listDeleted(authedRequest('/api/superadmin/deleted', superAdmin));
    const body = await res.json();

    expect(body.items[0].deletedByName).toBe('Reda');
  });

  it('ignores entities that are not deleted', async () => {
    await seedClient({ login: 'still.here' });
    await deletedArea('Zone', 1);

    const res = await listDeleted(authedRequest('/api/superadmin/deleted', superAdmin));
    const body = await res.json();

    expect(body.total).toBe(1);
    expect(labels(body)).toEqual(['Zone']);
  });

  it('clamps a limit that would return the whole table', async () => {
    for (let i = 0; i < 3; i++) await deletedArea(`Zone ${i}`, i);

    const res = await listDeleted(authedRequest('/api/superadmin/deleted?limit=5000', superAdmin));
    const body = await res.json();

    expect(body.limit).toBe(100);
  });

  it('falls back to the first page when the page number is not a number', async () => {
    await deletedArea('Zone', 1);

    const res = await listDeleted(authedRequest('/api/superadmin/deleted?page=abc&limit=xyz', superAdmin));
    const body = await res.json();

    expect(body.page).toBe(1);
    expect(body.limit).toBe(15);
    expect(body.items).toHaveLength(1);
  });
});
