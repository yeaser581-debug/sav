import { describe, it, expect, beforeEach } from 'vitest';
import { POST as markRead } from '@/app/api/issues/[id]/read/route';
import { GET as listIssues } from '@/app/api/issues/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedAgent, seedClient, seedIssue } from '../helpers/db';
import { authedRequest, unauthedRequest, routeParams } from '../helpers/request';

beforeEach(async () => {
  await resetDb();
});

async function addMessage(issueId: number, senderType: 'CLIENT' | 'ADMIN', senderId: number, createdAt: Date) {
  return prisma.issueMessage.create({
    data: { issueId, senderType, senderId, message: 'msg', createdAt },
  });
}

const read = (issueId: number, payload: Parameters<typeof authedRequest>[1]) =>
  markRead(authedRequest(`/api/issues/${issueId}/read`, payload, { method: 'POST' }), routeParams({ id: String(issueId) }));

describe('POST /api/issues/[id]/read', () => {
  it('rejects an unauthenticated request', async () => {
    const issue = await seedIssue();
    const res = await markRead(unauthedRequest(`/api/issues/${issue.id}/read`, { method: 'POST' }), routeParams({ id: String(issue.id) }));
    expect(res.status).toBe(401);
  });

  it('marks a never-opened claim as read by the administration', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue();

    const res = await read(issue.id, { id: admin.id, email: admin.email, role: 'admin' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.changed).toBe(true);
    const row = await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(row.adminLastReadAt).not.toBeNull();
    expect(row.clientLastReadAt).toBeNull();
  });

  it('is shared: a second admin opening an already-read claim changes nothing', async () => {
    const first = await seedAdmin({ email: 'a@x.com' });
    const second = await seedAdmin({ email: 'b@x.com' });
    const issue = await seedIssue();

    await read(issue.id, { id: first.id, email: first.email, role: 'admin' });
    const stamped = (await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } })).adminLastReadAt;

    const res = await read(issue.id, { id: second.id, email: second.email, role: 'admin' });
    expect((await res.json()).changed).toBe(false);
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } })).adminLastReadAt).toEqual(stamped);
  });

  it('does not rewrite the read time when nothing new arrived', async () => {
    const client = await seedClient();
    const admin = await seedAdmin();
    const issue = await seedIssue({ clientId: client.id });
    await addMessage(issue.id, 'ADMIN', admin.id, new Date(Date.now() - 60_000));

    await read(issue.id, { id: client.id, email: client.login, role: 'client' });
    const first = (await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } })).clientLastReadAt;

    const res = await read(issue.id, { id: client.id, email: client.login, role: 'client' });
    expect((await res.json()).changed).toBe(false);
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } })).clientLastReadAt).toEqual(first);
  });

  it('marks read again when the resident wrote after the last opening', async () => {
    const client = await seedClient();
    const admin = await seedAdmin();
    const issue = await seedIssue({ clientId: client.id });
    const earlier = new Date(Date.now() - 120_000);
    await prisma.issue.update({ where: { id: issue.id }, data: { adminLastReadAt: earlier } });
    await addMessage(issue.id, 'CLIENT', client.id, new Date(Date.now() - 60_000));

    const res = await read(issue.id, { id: admin.id, email: admin.email, role: 'admin' });
    expect((await res.json()).changed).toBe(true);
    const row = await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(row.adminLastReadAt!.getTime()).toBeGreaterThan(earlier.getTime());
  });

  it('stamps a resident read without a message waiting as nothing to do', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id });

    const res = await read(issue.id, { id: client.id, email: client.login, role: 'client' });
    expect((await res.json()).changed).toBe(false);
  });

  it('forbids a resident from marking someone else\'s claim', async () => {
    const owner = await seedClient({ login: 'owner' });
    const other = await seedClient({ login: 'other' });
    const issue = await seedIssue({ clientId: owner.id });

    const res = await read(issue.id, { id: other.id, email: other.login, role: 'client' });
    expect(res.status).toBe(403);
  });

  it('forbids agents, who are not part of the conversation', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id });

    const res = await read(issue.id, { id: agent.id, email: agent.email, role: 'agent' });
    expect(res.status).toBe(403);
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } })).adminLastReadAt).toBeNull();
  });

  it('returns 404 for a claim that does not exist', async () => {
    const admin = await seedAdmin();
    const res = await read(999999, { id: admin.id, email: admin.email, role: 'admin' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/issues — admin unread', () => {
  it('flags each row and counts unread claims', async () => {
    const admin = await seedAdmin();
    const client = await seedClient();

    const neverOpened = await seedIssue({ clientId: client.id, originalDescription: 'never opened' });

    const readQuiet = await seedIssue({ clientId: client.id, originalDescription: 'read, quiet' });
    await prisma.issue.update({ where: { id: readQuiet.id }, data: { adminLastReadAt: new Date() } });

    const readThenReply = await seedIssue({ clientId: client.id, originalDescription: 'read, then resident replied' });
    await prisma.issue.update({ where: { id: readThenReply.id }, data: { adminLastReadAt: new Date(Date.now() - 120_000) } });
    await addMessage(readThenReply.id, 'CLIENT', client.id, new Date(Date.now() - 60_000));

    const readThenAdminReply = await seedIssue({ clientId: client.id, originalDescription: 'read, then admin replied' });
    await prisma.issue.update({ where: { id: readThenAdminReply.id }, data: { adminLastReadAt: new Date(Date.now() - 120_000) } });
    await addMessage(readThenAdminReply.id, 'ADMIN', admin.id, new Date(Date.now() - 60_000));

    const res = await listIssues(authedRequest('/api/issues', { id: admin.id, email: admin.email, role: 'admin' }));
    const body = await res.json();

    const byId = new Map<number, { unread: boolean }>(body.issues.map((i: { id: number; unread: boolean }) => [i.id, i]));
    expect(byId.get(neverOpened.id)?.unread).toBe(true);
    expect(byId.get(readQuiet.id)?.unread).toBe(false);
    expect(byId.get(readThenReply.id)?.unread).toBe(true);
    expect(byId.get(readThenAdminReply.id)?.unread).toBe(false);
    expect(body.counts.unread).toBe(2);
  });

  it('counts unread across every page, not just the one returned', async () => {
    const admin = await seedAdmin();
    const client = await seedClient();
    for (let i = 0; i < 3; i++) await seedIssue({ clientId: client.id });

    const res = await listIssues(authedRequest('/api/issues?limit=1', { id: admin.id, email: admin.email, role: 'admin' }));
    const body = await res.json();

    expect(body.issues).toHaveLength(1);
    expect(body.counts.unread).toBe(3);
  });

  it('exposes the administration read time to the resident on their own list', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id });
    const at = new Date('2026-09-15T09:28:00Z');
    await prisma.issue.update({ where: { id: issue.id }, data: { adminLastReadAt: at } });

    const res = await listIssues(authedRequest('/api/issues', { id: client.id, email: client.login, role: 'client' }));
    const body = await res.json();

    expect(new Date(body.issues[0].adminLastReadAt)).toEqual(at);
    expect(body.counts.unread).toBeUndefined();
  });
});
