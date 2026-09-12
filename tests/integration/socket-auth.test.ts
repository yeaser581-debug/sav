import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedAgent, seedClient, seedIssue } from '../helpers/db';

import socketAuth from '@/lib/socket-auth.js';
const { principalIsValid, canAccessIssue } = socketAuth;

beforeEach(resetDb);

describe('principalIsValid', () => {
  it('accepts an active admin', async () => {
    const admin = await seedAdmin({ isActive: true });
    expect(await principalIsValid(prisma, { id: admin.id, role: 'admin' })).toBe(true);
  });

  it('rejects a deactivated admin', async () => {
    const admin = await seedAdmin({ isActive: false });
    expect(await principalIsValid(prisma, { id: admin.id, role: 'admin' })).toBe(false);
  });

  it('accepts a live agent', async () => {
    const agent = await seedAgent();
    expect(await principalIsValid(prisma, { id: agent.id, role: 'agent' })).toBe(true);
  });

  it('rejects a soft-deleted agent', async () => {
    const agent = await seedAgent();
    await prisma.agent.update({ where: { id: agent.id }, data: { deletedAt: new Date() } });
    expect(await principalIsValid(prisma, { id: agent.id, role: 'agent' })).toBe(false);
  });

  it('accepts a live client', async () => {
    const client = await seedClient();
    expect(await principalIsValid(prisma, { id: client.id, role: 'client' })).toBe(true);
  });

  it('rejects a soft-deleted client', async () => {
    const client = await seedClient();
    await prisma.client.update({ where: { id: client.id }, data: { deletedAt: new Date() } });
    expect(await principalIsValid(prisma, { id: client.id, role: 'client' })).toBe(false);
  });

  it('rejects an id that no longer exists', async () => {
    expect(await principalIsValid(prisma, { id: 999999, role: 'admin' })).toBe(false);
    expect(await principalIsValid(prisma, { id: 999999, role: 'agent' })).toBe(false);
    expect(await principalIsValid(prisma, { id: 999999, role: 'client' })).toBe(false);
  });

  it('rejects malformed principals', async () => {
    expect(await principalIsValid(prisma, null)).toBe(false);
    expect(await principalIsValid(prisma, { role: 'admin' })).toBe(false);
    expect(await principalIsValid(prisma, { id: 1.5, role: 'admin' })).toBe(false);
    expect(await principalIsValid(prisma, { id: 1, role: 'superuser' })).toBe(false);
  });
});

describe('canAccessIssue', () => {
  it('lets an admin into any issue', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue();
    expect(await canAccessIssue(prisma, { id: admin.id, role: 'admin' }, issue.id)).toBe(true);
  });

  it('lets a client into its own issue', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id });
    expect(await canAccessIssue(prisma, { id: client.id, role: 'client' }, issue.id)).toBe(true);
  });

  it("keeps a client out of another client's issue", async () => {
    const owner = await seedClient({ login: 'owner' });
    const intruder = await seedClient({ login: 'intruder' });
    const issue = await seedIssue({ clientId: owner.id });
    expect(await canAccessIssue(prisma, { id: intruder.id, role: 'client' }, issue.id)).toBe(false);
  });

  it('lets an agent into an issue assigned to it', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'IN_PROGRESS' });
    expect(await canAccessIssue(prisma, { id: agent.id, role: 'agent' }, issue.id)).toBe(true);
  });

  it('lets any agent into an unclaimed PENDING_AGENT issue', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ status: 'PENDING_AGENT' });
    expect(await canAccessIssue(prisma, { id: agent.id, role: 'agent' }, issue.id)).toBe(true);
  });

  it("keeps an agent out of another agent's claimed issue", async () => {
    const mine = await seedAgent({ email: 'mine@test.local' });
    const theirs = await seedAgent({ email: 'theirs@test.local' });
    const issue = await seedIssue({ agentId: theirs.id, status: 'IN_PROGRESS' });
    expect(await canAccessIssue(prisma, { id: mine.id, role: 'agent' }, issue.id)).toBe(false);
  });

  it('rejects a non-existent issue', async () => {
    const client = await seedClient();
    expect(await canAccessIssue(prisma, { id: client.id, role: 'client' }, 999999)).toBe(false);
  });

  it('rejects malformed issue ids', async () => {
    const client = await seedClient();
    const user = { id: client.id, role: 'client' };
    expect(await canAccessIssue(prisma, user, NaN)).toBe(false);
    expect(await canAccessIssue(prisma, user, 0)).toBe(false);
    expect(await canAccessIssue(prisma, user, -1)).toBe(false);
    expect(await canAccessIssue(prisma, user, 1.5)).toBe(false);
  });
});
