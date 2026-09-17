import { describe, it, expect, beforeEach } from 'vitest';
import { POST as createClient, GET as listClients } from '@/app/api/clients/route';
import { PATCH as patchClient } from '@/app/api/clients/[id]/route';
import { POST as createAgent } from '@/app/api/agents/route';
import { POST as createArea } from '@/app/api/areas/route';
import { POST as createBuilding } from '@/app/api/buildings/route';
import { POST as createIssue } from '@/app/api/issues/route';
import { POST as postMessage } from '@/app/api/issues/[id]/messages/route';
import { prisma } from '@/lib/prisma';
import { LIMITS } from '@/lib/limits';
import { resetDb, seedAdmin, seedBuilding, seedClient, seedIssue } from '../helpers/db';
import { authedRequest, routeParams } from '../helpers/request';

beforeEach(resetDb);

let admin: { id: number; email: string; role: 'admin' };
let buildingId: string;

beforeEach(async () => {
  const row = await seedAdmin();
  admin = { id: row.id, email: row.email, role: 'admin' };
  buildingId = String((await seedBuilding()).id);
});

const over = (limit: number) => 'a'.repeat(limit + 1);
const asAdmin = (path: string, body: unknown) => authedRequest(path, admin, { method: 'POST', body });

async function refusal(res: Response) {
  expect(res.status).toBe(400);
  const { error } = await res.json();
  expect(error).toMatch(/ne peut pas dépasser \d+ caractères\./);
  return error as string;
}

describe('a value longer than the column can hold is refused, not sent to the database', () => {
  it('refuses an over-long client name and writes nothing', async () => {
    const res = await createClient(asAdmin('/api/clients', {
      login: 'new.client', password: 'password123', unitNumber: 'A1', name: over(LIMITS.name), buildingId,
    }));
    expect(await refusal(res)).toContain('Le nom');
    expect(await prisma.client.count()).toBe(0);
  });

  it.each([
    ['login', { login: over(LIMITS.login), password: 'p', unitNumber: 'A1' }, 'L’identifiant'],
    ['unit number', { login: 'a', password: 'p', unitNumber: over(LIMITS.unitNumber) }, 'Le numéro d’unité'],
    ['phone', { login: 'a', password: 'p', unitNumber: 'A1', phone: over(LIMITS.phone) }, 'Le téléphone'],
    ['email', { login: 'a', password: 'p', unitNumber: 'A1', email: over(LIMITS.email) }, 'L’email'],
    ['password', { login: 'a', password: over(LIMITS.password), unitNumber: 'A1' }, 'Le mot de passe'],
  ])('refuses an over-long %s', async (_field, body, label) => {
    expect(await refusal(await createClient(asAdmin('/api/clients', { ...body, buildingId })))).toContain(label);
  });

  it('refuses an over-long name when updating a client, leaving the old one in place', async () => {
    const client = await seedClient({ name: 'Original' });
    const res = await patchClient(
      authedRequest(`/api/clients/${client.id}`, admin, { method: 'PATCH', body: { name: over(LIMITS.name) } }),
      routeParams({ id: String(client.id) }),
    );
    await refusal(res);
    const after = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(after.name).toBe('Original');
  });

  it('refuses an over-long agent name', async () => {
    const res = await createAgent(asAdmin('/api/agents', { name: over(LIMITS.name), email: 'a@test.local', password: 'p' }));
    await refusal(res);
    expect(await prisma.agent.count()).toBe(0);
  });

  it('refuses an over-long zone name', async () => {
    await refusal(await createArea(asAdmin('/api/areas', { name: over(LIMITS.name) })));
    expect(await prisma.area.count()).toBe(0);
  });

  it('refuses an over-long building address', async () => {
    const res = await createBuilding(asAdmin('/api/buildings', { name: 'Atlas', address: over(LIMITS.address) }));
    expect(await refusal(res)).toContain('L’adresse');
    expect(await prisma.building.count({ where: { name: 'Atlas' } })).toBe(0);
  });

  it('refuses an over-long claim description', async () => {
    const client = await seedClient();
    const res = await createIssue(
      authedRequest('/api/issues', { id: client.id, email: client.login, role: 'client' }, {
        method: 'POST', body: { description: over(LIMITS.description) },
      }),
    );
    expect(await refusal(res)).toContain('La description');
    expect(await prisma.issue.count()).toBe(0);
  });

  it('refuses an over-long chat message', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id, status: 'IN_PROGRESS' });
    const res = await postMessage(
      authedRequest(`/api/issues/${issue.id}/messages`, { id: client.id, email: client.login, role: 'client' }, {
        method: 'POST', body: { content: over(LIMITS.message) },
      }),
      routeParams({ id: String(issue.id) }),
    );
    expect(await refusal(res)).toContain('Le message');
    expect(await prisma.issueMessage.count()).toBe(0);
  });
});

describe('a client always belongs to a building', () => {
  it('asks for one instead of failing in the database', async () => {
    const res = await createClient(asAdmin('/api/clients', { login: 'no.building', password: 'password123', unitNumber: 'A1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('immeuble');
    expect(await prisma.client.count()).toBe(0);
  });
});

describe('values that fit are still accepted', () => {
  it('accepts a name of exactly the limit', async () => {
    const name = 'a'.repeat(LIMITS.name);
    const res = await createClient(asAdmin('/api/clients', {
      login: 'edge.case', password: 'password123', unitNumber: 'A1', name, buildingId,
    }));
    expect(res.status).toBe(201);

    const data = await listClients(authedRequest('/api/clients', admin)).then(r => r.json());
    expect(data.clients[0].name).toHaveLength(LIMITS.name);
  });
});
