import { describe, it, expect, beforeEach } from 'vitest';
import { PATCH as patchIssue } from '@/app/api/issues/[id]/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedAgent, seedClient, seedIssue } from '../helpers/db';
import { authedRequest, unauthedRequest, routeParams } from '../helpers/request';

beforeEach(resetDb);

async function patch(id: number, payload: Parameters<typeof authedRequest>[1] | null, body: Record<string, unknown>) {
  const req = payload
    ? authedRequest(`/api/issues/${id}`, payload, { method: 'PATCH', body })
    : unauthedRequest(`/api/issues/${id}`, { method: 'PATCH', body });
  return patchIssue(req, routeParams({ id: String(id) }));
}

describe('PATCH /api/issues/[id]', () => {
  it('rejects an unauthenticated request', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id });
    const res = await patch(issue.id, null, { status: 'CONFIRMED' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a nonexistent issue', async () => {
    const admin = await seedAdmin();
    const res = await patch(999999, { id: admin.id, email: admin.email, role: 'admin' }, { status: 'CONFIRMED' });
    expect(res.status).toBe(404);
  });

  describe('client', () => {
    it('can confirm the resolution of their own issue, which closes it', async () => {
      const client = await seedClient();
      const issue = await seedIssue({ clientId: client.id, status: 'RESOLVED' });
      const res = await patch(issue.id, { id: client.id, email: client.login, role: 'client' }, { status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      const updated = await prisma.issue.findUnique({ where: { id: issue.id } });
      expect(updated?.status).toBe('CONFIRMED');
      expect(updated?.closedAt).not.toBeNull();
    });

    it('cannot act on another client\'s issue', async () => {
      const owner = await seedClient({ login: 'owner' });
      const other = await seedClient({ login: 'other' });
      const issue = await seedIssue({ clientId: owner.id, status: 'RESOLVED' });

      const res = await patch(issue.id, { id: other.id, email: other.login, role: 'client' }, { status: 'CONFIRMED' });
      expect(res.status).toBe(403);
    });

    it('cannot set a status outside confirm/dispute', async () => {
      const client = await seedClient();
      const issue = await seedIssue({ clientId: client.id, status: 'RESOLVED' });

      const res = await patch(issue.id, { id: client.id, email: client.login, role: 'client' }, { status: 'IN_PROGRESS' });
      expect(res.status).toBe(403);
    });

    it('cannot set severity even on their own issue', async () => {
      const client = await seedClient();
      const issue = await seedIssue({ clientId: client.id, status: 'RESOLVED', severity: null });

      await patch(issue.id, { id: client.id, email: client.login, role: 'client' }, { status: 'CONFIRMED', severity: 'CRITICAL' });
      const updated = await prisma.issue.findUnique({ where: { id: issue.id } });
      expect(updated?.severity).toBeNull();
    });

    it('disputing records the reason and notifies every admin', async () => {
      const client = await seedClient();
      await seedAdmin({ email: 'a1@test.local' });
      await seedAdmin({ email: 'a2@test.local' });
      const issue = await seedIssue({ clientId: client.id, status: 'RESOLVED' });

      const res = await patch(issue.id, { id: client.id, email: client.login, role: 'client' }, { status: 'DISPUTED', disputeReason: 'Toujours cassé' });
      const data = await res.json();

      expect(data.disputeReason).toBe('Toujours cassé');
      expect(data.targetUserIds).toHaveLength(2);
    });
  });

  describe('agent', () => {
    it('claiming an unassigned pending issue assigns it to themself', async () => {
      const client = await seedClient();
      const agent = await seedAgent();
      const issue = await seedIssue({ clientId: client.id, status: 'PENDING_AGENT', agentId: null });

      const res = await patch(issue.id, { id: agent.id, email: agent.email, role: 'agent' }, { status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);

      const updated = await prisma.issue.findUnique({ where: { id: issue.id } });
      expect(updated?.agentId).toBe(agent.id);
      expect(updated?.status).toBe('IN_PROGRESS');
    });

    it('can reject an unassigned pending issue', async () => {
      const client = await seedClient();
      const agent = await seedAgent();
      const issue = await seedIssue({ clientId: client.id, status: 'PENDING_AGENT', agentId: null });

      const res = await patch(issue.id, { id: agent.id, email: agent.email, role: 'agent' }, { status: 'REJECTED' });
      expect(res.status).toBe(200);
    });

    it('cannot act on an issue assigned to a different agent', async () => {
      const client = await seedClient();
      const owner = await seedAgent({ email: 'owner@test.local' });
      const other = await seedAgent({ email: 'other@test.local' });
      const issue = await seedIssue({ clientId: client.id, status: 'IN_PROGRESS', agentId: owner.id });

      const res = await patch(issue.id, { id: other.id, email: other.email, role: 'agent' }, { status: 'RESOLVED' });
      expect(res.status).toBe(403);
    });

    it('resolving their own issue sets resolvedAt', async () => {
      const client = await seedClient();
      const agent = await seedAgent();
      const issue = await seedIssue({ clientId: client.id, status: 'IN_PROGRESS', agentId: agent.id });

      await patch(issue.id, { id: agent.id, email: agent.email, role: 'agent' }, { status: 'RESOLVED' });
      const updated = await prisma.issue.findUnique({ where: { id: issue.id } });
      expect(updated?.resolvedAt).not.toBeNull();
    });
  });

  describe('admin', () => {
    it('can set severity and assign an agent directly', async () => {
      const client = await seedClient();
      const agent = await seedAgent();
      const admin = await seedAdmin();
      const issue = await seedIssue({ clientId: client.id, status: 'PENDING_AGENT' });

      await patch(issue.id, { id: admin.id, email: admin.email, role: 'admin' }, { severity: 'CRITICAL', agentId: agent.id, status: 'IN_PROGRESS' });
      const updated = await prisma.issue.findUnique({ where: { id: issue.id } });
      expect(updated?.severity).toBe('CRITICAL');
      expect(updated?.agentId).toBe(agent.id);
    });

    it('reopening a disputed issue clears the dispute reason and notifies the agent', async () => {
      const client = await seedClient();
      const agent = await seedAgent();
      const admin = await seedAdmin();
      const issue = await seedIssue({ clientId: client.id, status: 'DISPUTED', agentId: agent.id });
      await prisma.issue.update({ where: { id: issue.id }, data: { disputeReason: 'Pas content' } });

      const res = await patch(issue.id, { id: admin.id, email: admin.email, role: 'admin' }, { status: 'IN_PROGRESS' });
      const data = await res.json();

      expect(data.disputeReason).toBeNull();
      expect(data.targetUserIds).toEqual([agent.id]);
    });
  });
});
