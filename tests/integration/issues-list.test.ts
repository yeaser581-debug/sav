import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listIssues } from '@/app/api/issues/route';
import { resetDb, seedAdmin, seedAgent, seedClient, seedIssue } from '../helpers/db';
import { authedRequest, unauthedRequest } from '../helpers/request';

beforeEach(resetDb);

describe('GET /api/issues', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await listIssues(unauthedRequest('/api/issues'));
    expect(res.status).toBe(401);
  });

  it('scopes a client to only their own issues', async () => {
    const clientA = await seedClient({ login: 'a' });
    const clientB = await seedClient({ login: 'b' });
    await seedIssue({ clientId: clientA.id, originalDescription: 'Issue A' });
    await seedIssue({ clientId: clientB.id, originalDescription: 'Issue B' });

    const res = await listIssues(authedRequest('/api/issues', { id: clientA.id, email: clientA.login, role: 'client' }));
    const data = await res.json();

    expect(data.issues).toHaveLength(1);
    expect(data.issues[0].originalDescription).toBe('Issue A');
  });

  it('scopes an agent to their assigned issues plus every unassigned one', async () => {
    const agentA = await seedAgent({ email: 'a@test.local' });
    const agentB = await seedAgent({ email: 'b@test.local' });
    const client = await seedClient();
    await seedIssue({ clientId: client.id, agentId: agentA.id, status: 'IN_PROGRESS', originalDescription: 'Mine' });
    await seedIssue({ clientId: client.id, agentId: agentB.id, status: 'IN_PROGRESS', originalDescription: 'Not mine' });
    await seedIssue({ clientId: client.id, agentId: null, status: 'PENDING_AGENT', originalDescription: 'Unassigned' });

    const res = await listIssues(authedRequest('/api/issues', { id: agentA.id, email: agentA.email, role: 'agent' }));
    const data = await res.json();
    const descriptions = data.issues.map((i: { originalDescription: string }) => i.originalDescription).sort();

    expect(descriptions).toEqual(['Mine', 'Unassigned']);
  });

  it('lets admin see every issue regardless of client or agent', async () => {
    const client = await seedClient();
    await seedIssue({ clientId: client.id });
    await seedIssue({ clientId: client.id });
    const admin = await seedAdmin();

    const res = await listIssues(authedRequest('/api/issues', { id: admin.id, email: admin.email, role: 'admin' }));
    const data = await res.json();

    expect(data.total).toBe(2);
    expect(data.issues).toHaveLength(2);
  });

  it('paginates correctly', async () => {
    const client = await seedClient();
    for (let i = 0; i < 5; i++) await seedIssue({ clientId: client.id });
    const admin = await seedAdmin();
    const authPayload = { id: admin.id, email: admin.email, role: 'admin' as const };

    const page1 = await listIssues(authedRequest('/api/issues?page=1&limit=2', authPayload));
    const page1Data = await page1.json();
    const page3 = await listIssues(authedRequest('/api/issues?page=3&limit=2', authPayload));
    const page3Data = await page3.json();

    expect(page1Data.total).toBe(5);
    expect(page1Data.issues).toHaveLength(2);
    expect(page3Data.issues).toHaveLength(1);
  });

  it('filters admin results by status', async () => {
    const client = await seedClient();
    await seedIssue({ clientId: client.id, status: 'PENDING_AGENT' });
    await seedIssue({ clientId: client.id, status: 'RESOLVED' });
    const admin = await seedAdmin();

    const res = await listIssues(authedRequest('/api/issues?status=RESOLVED', { id: admin.id, email: admin.email, role: 'admin' }));
    const data = await res.json();

    expect(data.issues).toHaveLength(1);
    expect(data.issues[0].status).toBe('RESOLVED');
  });

  it('searches by description substring and by exact numeric id', async () => {
    const client = await seedClient();
    const target = await seedIssue({ clientId: client.id, originalDescription: 'Panne électrique au tableau' });
    await seedIssue({ clientId: client.id, originalDescription: 'Fuite d\'eau' });
    const admin = await seedAdmin();
    const authPayload = { id: admin.id, email: admin.email, role: 'admin' as const };

    const byText = await listIssues(authedRequest('/api/issues?search=électrique', authPayload));
    const byTextData = await byText.json();
    expect(byTextData.issues).toHaveLength(1);

    const byId = await listIssues(authedRequest(`/api/issues?search=${target.id}`, authPayload));
    const byIdData = await byId.json();
    expect(byIdData.issues.map((i: { id: number }) => i.id)).toContain(target.id);
  });

  it('returns role-shaped counts independent of the active filter', async () => {
    const client = await seedClient();
    await seedIssue({ clientId: client.id, status: 'PENDING_AGENT' });
    await seedIssue({ clientId: client.id, status: 'IN_PROGRESS' });
    await seedIssue({ clientId: client.id, status: 'RESOLVED' });
    const admin = await seedAdmin();

    const res = await listIssues(authedRequest('/api/issues?status=RESOLVED', { id: admin.id, email: admin.email, role: 'admin' }));
    const data = await res.json();

    expect(data.counts).toMatchObject({ total: 3, inProgress: 1, resolved: 1 });
  });
});
