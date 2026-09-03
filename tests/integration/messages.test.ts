import { describe, it, expect, beforeEach } from 'vitest';
import { POST as postMessage } from '@/app/api/issues/[id]/messages/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedAgent, seedClient, seedIssue } from '../helpers/db';
import { authedRequest, unauthedRequest, routeParams } from '../helpers/request';

beforeEach(resetDb);

async function send(issueId: number, payload: Parameters<typeof authedRequest>[1] | null, body: Record<string, unknown>) {
  const req = payload
    ? authedRequest(`/api/issues/${issueId}/messages`, payload, { method: 'POST', body })
    : unauthedRequest(`/api/issues/${issueId}/messages`, { method: 'POST', body });
  return postMessage(req, routeParams({ id: String(issueId) }));
}

describe('POST /api/issues/[id]/messages (JSON)', () => {
  it('rejects an unauthenticated request', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id });
    const res = await send(issue.id, null, { content: 'Bonjour' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a nonexistent issue', async () => {
    const client = await seedClient();
    const res = await send(999999, { id: client.id, email: client.login, role: 'client' }, { content: 'Bonjour' });
    expect(res.status).toBe(404);
  });

  it('lets the owning client send a message', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id });

    const res = await send(issue.id, { id: client.id, email: client.login, role: 'client' }, { content: 'Le probleme persiste' });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message.senderType).toBe('CLIENT');
  });

  it('lets admin send a message', async () => {
    const client = await seedClient();
    const admin = await seedAdmin();
    const issue = await seedIssue({ clientId: client.id });

    const res = await send(issue.id, { id: admin.id, email: admin.email, role: 'admin' }, { content: 'On regarde ca' });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message.senderType).toBe('ADMIN');
  });

  it('forbids an agent from messaging (chat is client/admin only)', async () => {
    const client = await seedClient();
    const agent = await seedAgent();
    const issue = await seedIssue({ clientId: client.id, agentId: agent.id });

    const res = await send(issue.id, { id: agent.id, email: agent.email, role: 'agent' }, { content: 'Salut' });
    expect(res.status).toBe(403);
  });

  it('forbids a client from messaging someone else\'s issue', async () => {
    const owner = await seedClient({ login: 'owner' });
    const other = await seedClient({ login: 'other' });
    const issue = await seedIssue({ clientId: owner.id });

    const res = await send(issue.id, { id: other.id, email: other.login, role: 'client' }, { content: 'Salut' });
    expect(res.status).toBe(403);
  });

  it('rejects empty content', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id });

    const res = await send(issue.id, { id: client.id, email: client.login, role: 'client' }, { content: '   ' });
    expect(res.status).toBe(400);
  });

  it('is idempotent on a retried clientRequestId', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id });
    const authPayload = { id: client.id, email: client.login, role: 'client' as const };
    const body = { content: 'Un seul message svp', clientRequestId: 'msg-retry-1' };

    const first = await send(issue.id, authPayload, body);
    const second = await send(issue.id, authPayload, body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);

    const count = await prisma.issueMessage.count({ where: { clientRequestId: 'msg-retry-1' } });
    expect(count).toBe(1);
  });
});
