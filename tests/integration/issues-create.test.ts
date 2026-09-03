import { describe, it, expect, beforeEach } from 'vitest';
import { POST as createIssue } from '@/app/api/issues/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedClient, seedAdmin } from '../helpers/db';
import { authedRequest, unauthedRequest } from '../helpers/request';

beforeEach(resetDb);

describe('POST /api/issues', () => {
  it('lets a client create an issue', async () => {
    const client = await seedClient();
    const res = await createIssue(authedRequest('/api/issues', { id: client.id, email: client.login, role: 'client' }, {
      method: 'POST',
      body: { description: 'Fuite au robinet de la cuisine', media: [] },
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.issueId).toBeTypeOf('number');

    const issue = await prisma.issue.findUnique({ where: { id: data.issueId } });
    expect(issue?.clientId).toBe(client.id);
    expect(issue?.status).toBe('PENDING_AGENT');
  });

  it('rejects an empty description', async () => {
    const client = await seedClient();
    const res = await createIssue(authedRequest('/api/issues', { id: client.id, email: client.login, role: 'client' }, {
      method: 'POST',
      body: { description: '   ', media: [] },
    }));
    expect(res.status).toBe(400);
  });

  it('rejects a non-client role', async () => {
    const admin = await seedAdmin();
    const res = await createIssue(authedRequest('/api/issues', { id: admin.id, email: admin.email, role: 'admin' }, {
      method: 'POST',
      body: { description: 'Test', media: [] },
    }));
    expect(res.status).toBe(401);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await createIssue(unauthedRequest('/api/issues', { method: 'POST', body: { description: 'Test', media: [] } }));
    expect(res.status).toBe(401);
  });

  it('is idempotent on a retried clientRequestId', async () => {
    const client = await seedClient();
    const clientRequestId = 'retry-key-1';
    const body = { description: 'Fuite au robinet', media: [], clientRequestId };
    const authPayload = { id: client.id, email: client.login, role: 'client' as const };

    const first = await createIssue(authedRequest('/api/issues', authPayload, { method: 'POST', body }));
    const second = await createIssue(authedRequest('/api/issues', authPayload, { method: 'POST', body }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const firstData = await first.json();
    const secondData = await second.json();
    expect(secondData.issueId).toBe(firstData.issueId);

    const count = await prisma.issue.count({ where: { clientRequestId } });
    expect(count).toBe(1);
  });
});
