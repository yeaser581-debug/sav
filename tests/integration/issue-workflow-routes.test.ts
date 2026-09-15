import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { rm, readdir } from 'fs/promises';
import path from 'path';
import { PATCH as patchIssue } from '@/app/api/issues/[id]/route';
import { POST as resolveIssue } from '@/app/api/issues/[id]/resolve/route';
import { POST as scheduleVisit } from '@/app/api/issues/[id]/visits/route';
import { POST as postMessage } from '@/app/api/issues/[id]/messages/route';
import { prisma } from '@/lib/prisma';
import { signToken, type JWTPayload } from '@/lib/auth';
import { decideIssueChange } from '@/lib/issue-workflow';
import { toSnapshot, whereStillMatches } from '@/lib/issue-workflow-server';
import { resetDb, seedAdmin, seedAgent, seedClient, seedIssue } from '../helpers/db';
import { authedRequest, routeParams } from '../helpers/request';

const touchedProofDirs = new Set<number>();

beforeEach(resetDb);

afterEach(async () => {
  await Promise.all(
    [...touchedProofDirs].map(id =>
      rm(path.join(process.cwd(), 'public', 'uploads', 'proof', String(id)), { recursive: true, force: true })
    )
  );
  touchedProofDirs.clear();
});

type Who = JWTPayload;

const asAdmin = (a: { id: number; email: string }): Who => ({ id: a.id, email: a.email, role: 'admin' });
const asAgent = (a: { id: number; email: string }): Who => ({ id: a.id, email: a.email, role: 'agent' });
const asClient = (c: { id: number; login: string }): Who => ({ id: c.id, email: c.login, role: 'client' });

function patch(issueId: number | string, who: Who, body: unknown) {
  return patchIssue(
    authedRequest(`/api/issues/${issueId}`, who, { method: 'PATCH', body }),
    routeParams({ id: String(issueId) })
  );
}

function rawPatch(issueId: number, who: Who, rawBody: string) {
  const headers = new Headers({ cookie: `token=${signToken(who)}`, 'content-type': 'application/json' });
  const req = new NextRequest(`http://localhost:3000/api/issues/${issueId}`, { method: 'PATCH', headers, body: rawBody });
  return patchIssue(req, routeParams({ id: String(issueId) }));
}

function resolve(issueId: number, who: Who, files: File[], note?: string) {
  touchedProofDirs.add(issueId);
  const form = new FormData();
  for (const file of files) form.append('files', file);
  if (note !== undefined) form.append('note', note);
  const headers = new Headers({ cookie: `token=${signToken(who)}` });
  const req = new NextRequest(`http://localhost:3000/api/issues/${issueId}/resolve`, { method: 'POST', headers, body: form });
  return resolveIssue(req, routeParams({ id: String(issueId) }));
}

const photo = (name = 'preuve.jpg') => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], name, { type: 'image/jpeg' });

async function proofFilesOnDisk(issueId: number): Promise<string[]> {
  return readdir(path.join(process.cwd(), 'public', 'uploads', 'proof', String(issueId))).catch(() => []);
}

async function row(issueId: number) {
  return prisma.issue.findUniqueOrThrow({ where: { id: issueId } });
}

describe('the holes that were open are closed', () => {
  it('a resident cannot confirm a claim that was never resolved', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id, status: 'IN_PROGRESS' });

    const res = await patch(issue.id, asClient(client), { status: 'CONFIRMED' });

    expect(res.status).toBe(409);
    const after = await row(issue.id);
    expect(after.status).toBe('IN_PROGRESS');
    expect(after.closedAt).toBeNull();
  });

  it('a resident cannot confirm a claim still waiting for an agent', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id, status: 'PENDING_AGENT' });

    expect((await patch(issue.id, asClient(client), { status: 'CONFIRMED' })).status).toBe(409);
    expect((await row(issue.id)).status).toBe('PENDING_AGENT');
  });

  it('an agent cannot mark their claim confirmed on the resident\'s behalf', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'RESOLVED' });

    expect((await patch(issue.id, asAgent(agent), { status: 'CONFIRMED' })).status).toBe(403);
    expect((await row(issue.id)).status).toBe('RESOLVED');
  });

  it('an agent cannot resolve without proof through the update route', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'IN_PROGRESS' });

    expect((await patch(issue.id, asAgent(agent), { status: 'RESOLVED' })).status).toBe(403);
    const after = await row(issue.id);
    expect(after.status).toBe('IN_PROGRESS');
    expect(after.resolvedAt).toBeNull();
  });

  it('an agent cannot downgrade the priority of their claim to escape its deadline', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'IN_PROGRESS', severity: 'CRITICAL' });

    expect((await patch(issue.id, asAgent(agent), { severity: 'LOW' })).status).toBe(403);
    expect((await row(issue.id)).severity).toBe('CRITICAL');
  });

  it('an agent cannot reopen, or send back to pending, a claim they hold', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'RESOLVED' });

    expect((await patch(issue.id, asAgent(agent), { status: 'IN_PROGRESS', severity: 'LOW' })).status).toBe(409);
    expect((await patch(issue.id, asAgent(agent), { status: 'PENDING_AGENT' })).status).toBe(403);
    expect((await row(issue.id)).status).toBe('RESOLVED');
  });

  it('an admin cannot confirm, resolve, or send a claim back to pending', async () => {
    const admin = await seedAdmin();
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'RESOLVED' });

    for (const status of ['CONFIRMED', 'RESOLVED', 'PENDING_AGENT']) {
      expect((await patch(issue.id, asAdmin(admin), { status })).status).toBe(403);
    }
    expect((await row(issue.id)).status).toBe('RESOLVED');
  });

  it('an admin cannot reject a claim already in progress', async () => {
    const admin = await seedAdmin();
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'IN_PROGRESS' });

    expect((await patch(issue.id, asAdmin(admin), { status: 'REJECTED', rejectionReason: 'x' })).status).toBe(409);
    expect((await row(issue.id)).status).toBe('IN_PROGRESS');
  });
});

describe('bad input is refused cleanly instead of crashing', () => {
  it('an unknown status is a 400, not a server error', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue();
    expect((await patch(issue.id, asAdmin(admin), { status: 'CLOSED' })).status).toBe(400);
  });

  it('an unknown priority is a 400', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue();
    expect((await patch(issue.id, asAdmin(admin), { severity: 'URGENT' })).status).toBe(400);
  });

  it('a field the route does not accept is a 400 that names it', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue();
    const res = await patch(issue.id, asAdmin(admin), { deadlineAt: 'not-a-date' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('deadlineAt');
  });

  it('a body that is not JSON is a 400', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue();
    expect((await rawPatch(issue.id, asAdmin(admin), '{not json')).status).toBe(400);
  });

  it('a claim id that is not a number is a 404, not a server error', async () => {
    const admin = await seedAdmin();
    expect((await patch('abc', asAdmin(admin), { severity: 'LOW' })).status).toBe(404);
  });

  it('assigning an agent that does not exist is a 400 and changes nothing', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue();

    expect((await patch(issue.id, asAdmin(admin), { status: 'IN_PROGRESS', agentId: 999999 })).status).toBe(400);
    const after = await row(issue.id);
    expect(after.status).toBe('PENDING_AGENT');
    expect(after.agentId).toBeNull();
  });

  it('assigning a deactivated agent is refused', async () => {
    const admin = await seedAdmin();
    const agent = await seedAgent();
    await prisma.agent.update({ where: { id: agent.id }, data: { deletedAt: new Date() } });
    const issue = await seedIssue();

    expect((await patch(issue.id, asAdmin(admin), { status: 'IN_PROGRESS', agentId: agent.id })).status).toBe(400);
    expect((await row(issue.id)).agentId).toBeNull();
  });

  it('a deactivated agent whose session is still open cannot take claims', async () => {
    const agent = await seedAgent();
    await prisma.agent.update({ where: { id: agent.id }, data: { deletedAt: new Date() } });
    const issue = await seedIssue();

    expect((await patch(issue.id, asAgent(agent), { status: 'IN_PROGRESS', severity: 'LOW' })).status).toBe(403);
    expect((await row(issue.id)).agentId).toBeNull();
  });

  it('an oversized reason is a 400', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue();
    const res = await patch(issue.id, asAdmin(admin), { status: 'REJECTED', rejectionReason: 'a'.repeat(5000) });
    expect(res.status).toBe(400);
    expect((await row(issue.id)).status).toBe('PENDING_AGENT');
  });

  it('a dispute without a reason is refused, as the screen already requires', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id, status: 'RESOLVED' });

    expect((await patch(issue.id, asClient(client), { status: 'DISPUTED' })).status).toBe(400);
    expect((await row(issue.id)).status).toBe('RESOLVED');
  });
});

describe('overriding a rejection', () => {
  it('an admin assigning an agent brings a rejected claim back and clears the reason', async () => {
    const admin = await seedAdmin();
    const agent = await seedAgent();
    const issue = await seedIssue({ status: 'REJECTED' });
    await prisma.issue.update({ where: { id: issue.id }, data: { rejectionReason: 'Rejeté à tort' } });

    const res = await patch(issue.id, asAdmin(admin), { agentId: agent.id, status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    const after = await row(issue.id);
    expect(after.status).toBe('IN_PROGRESS');
    expect(after.agentId).toBe(agent.id);
    expect(after.rejectionReason).toBeNull();
  });

  it('an agent cannot bring back a rejected claim', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ status: 'REJECTED' });

    expect((await patch(issue.id, asAgent(agent), { status: 'IN_PROGRESS', severity: 'LOW' })).status).toBe(403);
    expect((await row(issue.id)).status).toBe('REJECTED');
  });
});

describe('repeated requests (the offline outbox replays them)', () => {
  it('a repeated dispute succeeds without notifying the admins twice or overwriting the reason', async () => {
    const client = await seedClient();
    const a1 = await seedAdmin({ email: 'a1@test.local' });
    const a2 = await seedAdmin({ email: 'a2@test.local' });
    const issue = await seedIssue({ clientId: client.id, status: 'RESOLVED' });

    const first = await patch(issue.id, asClient(client), { status: 'DISPUTED', disputeReason: 'Première version' });
    const again = await patch(issue.id, asClient(client), { status: 'DISPUTED', disputeReason: 'Renvoi' });

    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    const body = await again.json();
    expect(body.unchanged).toBe(true);
    expect(body.targetUserIds).toEqual([]);

    expect((await row(issue.id)).disputeReason).toBe('Première version');
    for (const admin of [a1, a2]) {
      expect(await prisma.notification.count({ where: { userId: admin.id, userRole: 'admin' } })).toBe(1);
    }
  });

  it('a repeated confirmation succeeds and keeps the original closing time', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id, status: 'RESOLVED' });

    await patch(issue.id, asClient(client), { status: 'CONFIRMED' });
    const closedAt = (await row(issue.id)).closedAt;

    const again = await patch(issue.id, asClient(client), { status: 'CONFIRMED' });
    expect(again.status).toBe(200);
    expect((await row(issue.id)).closedAt).toEqual(closedAt);
  });

  it('a repeated rejection does not notify the resident twice', async () => {
    const client = await seedClient();
    const admin = await seedAdmin();
    const issue = await seedIssue({ clientId: client.id });

    await patch(issue.id, asAdmin(admin), { status: 'REJECTED', rejectionReason: 'Doublon' });
    const again = await patch(issue.id, asAdmin(admin), { status: 'REJECTED', rejectionReason: 'Doublon' });

    expect(again.status).toBe(200);
    expect(await prisma.notification.count({ where: { userId: client.id, userRole: 'client' } })).toBe(1);
  });

  it('a repeated claim by the same agent succeeds', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue();

    await patch(issue.id, asAgent(agent), { status: 'IN_PROGRESS', severity: 'MEDIUM' });
    expect((await patch(issue.id, asAgent(agent), { status: 'IN_PROGRESS', severity: 'MEDIUM' })).status).toBe(200);
  });
});

describe('simultaneous changes', () => {
  it('when two agents take the same claim at once, exactly one gets it', async () => {
    const first = await seedAgent({ email: 'first@test.local' });
    const second = await seedAgent({ email: 'second@test.local' });
    const issue = await seedIssue();

    const responses = await Promise.all([
      patch(issue.id, asAgent(first), { status: 'IN_PROGRESS', severity: 'MEDIUM' }),
      patch(issue.id, asAgent(second), { status: 'IN_PROGRESS', severity: 'MEDIUM' }),
    ]);

    const statuses = responses.map(r => r.status);
    expect(statuses.filter(s => s === 200)).toHaveLength(1);
    expect(statuses.filter(s => s === 403 || s === 409)).toHaveLength(1);

    const winner = statuses[0] === 200 ? first : second;
    expect((await row(issue.id)).agentId).toBe(winner.id);
  });

  it('a decision made on a stale reading writes nothing', async () => {
    const late = await seedAgent({ email: 'late@test.local' });
    const early = await seedAgent({ email: 'early@test.local' });
    const issue = await seedIssue();

    const staleSnapshot = toSnapshot(await row(issue.id));
    const decision = decideIssueChange({ role: 'agent', id: late.id }, staleSnapshot, { status: 'IN_PROGRESS', severity: 'LOW' }, new Date());
    expect(decision.outcome).toBe('apply');
    if (decision.outcome !== 'apply') return;

    await prisma.issue.update({ where: { id: issue.id }, data: { status: 'IN_PROGRESS', agentId: early.id } });

    const { count } = await prisma.issue.updateMany({ where: whereStillMatches(issue.id, decision.expect), data: decision.data });
    expect(count).toBe(0);
    expect((await row(issue.id)).agentId).toBe(early.id);
  });

  it('a resident confirming while an admin reopens: the second to arrive is refused', async () => {
    const client = await seedClient();
    const admin = await seedAdmin();
    const agent = await seedAgent();
    const issue = await seedIssue({ clientId: client.id, agentId: agent.id, status: 'DISPUTED' });

    expect((await patch(issue.id, asAdmin(admin), { status: 'IN_PROGRESS' })).status).toBe(200);
    expect((await patch(issue.id, asClient(client), { status: 'CONFIRMED' })).status).toBe(409);
    expect((await row(issue.id)).status).toBe('IN_PROGRESS');
  });
});

describe('POST /api/issues/[id]/resolve', () => {
  it('resolves an in-progress claim with proof and notifies the resident once', async () => {
    const client = await seedClient();
    const agent = await seedAgent();
    const issue = await seedIssue({ clientId: client.id, agentId: agent.id, status: 'IN_PROGRESS' });

    const res = await resolve(issue.id, asAgent(agent), [photo()], 'Joint remplacé');

    expect(res.status).toBe(201);
    const after = await row(issue.id);
    expect(after.status).toBe('RESOLVED');
    expect(after.resolvedAt).not.toBeNull();
    expect(await prisma.resolutionProof.count({ where: { issueId: issue.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: client.id, userRole: 'client' } })).toBe(1);
    expect(await proofFilesOnDisk(issue.id)).toHaveLength(1);
  });

  it('refuses a claim that is not in progress, before saving any file', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'RESOLVED' });

    const res = await resolve(issue.id, asAgent(agent), [photo()]);

    expect(res.status).toBe(409);
    expect(await prisma.resolutionProof.count({ where: { issueId: issue.id } })).toBe(0);
    expect(await proofFilesOnDisk(issue.id)).toHaveLength(0);
  });

  it('refuses an agent who is not assigned', async () => {
    const owner = await seedAgent({ email: 'owner@test.local' });
    const other = await seedAgent({ email: 'other@test.local' });
    const issue = await seedIssue({ agentId: owner.id, status: 'IN_PROGRESS' });

    expect((await resolve(issue.id, asAgent(other), [photo()])).status).toBe(403);
    expect((await row(issue.id)).status).toBe('IN_PROGRESS');
  });

  it('still requires at least one photo or video', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'IN_PROGRESS' });

    expect((await resolve(issue.id, asAgent(agent), [])).status).toBe(400);
    expect((await row(issue.id)).status).toBe('IN_PROGRESS');
  });

  it('a double submission resolves once: one set of proof, one notification, no orphan files', async () => {
    const client = await seedClient();
    const agent = await seedAgent();
    const issue = await seedIssue({ clientId: client.id, agentId: agent.id, status: 'IN_PROGRESS' });

    const responses = await Promise.all([
      resolve(issue.id, asAgent(agent), [photo('a.jpg'), photo('b.jpg')]),
      resolve(issue.id, asAgent(agent), [photo('c.jpg'), photo('d.jpg')]),
    ]);

    const statuses = responses.map(r => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await prisma.resolutionProof.count({ where: { issueId: issue.id } })).toBe(2);
    expect(await prisma.notification.count({ where: { userId: client.id, userRole: 'client' } })).toBe(1);
    expect(await proofFilesOnDisk(issue.id)).toHaveLength(2);
  });
});

describe('POST /api/issues/[id]/visits', () => {
  const visit = (issueId: number, who: Who, body: unknown) =>
    scheduleVisit(authedRequest(`/api/issues/${issueId}/visits`, who, { method: 'POST', body }), routeParams({ id: String(issueId) }));

  it('schedules a visit on a claim in progress', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'IN_PROGRESS' });

    expect((await visit(issue.id, asAgent(agent), { scheduledAt: '2026-10-01T09:00' })).status).toBe(201);
    expect(await prisma.visit.count({ where: { issueId: issue.id } })).toBe(1);
  });

  it.each(['RESOLVED', 'CONFIRMED', 'DISPUTED'] as const)('refuses a visit on a %s claim', async (status) => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status });

    expect((await visit(issue.id, asAgent(agent), { scheduledAt: '2026-10-01T09:00' })).status).toBe(409);
    expect(await prisma.visit.count({ where: { issueId: issue.id } })).toBe(0);
  });

  it('refuses an invalid date instead of crashing', async () => {
    const agent = await seedAgent();
    const issue = await seedIssue({ agentId: agent.id, status: 'IN_PROGRESS' });

    expect((await visit(issue.id, asAgent(agent), { scheduledAt: 'demain matin' })).status).toBe(400);
    expect(await prisma.visit.count({ where: { issueId: issue.id } })).toBe(0);
  });

  it('refuses an agent who is not assigned, and an admin', async () => {
    const owner = await seedAgent({ email: 'owner@test.local' });
    const other = await seedAgent({ email: 'other@test.local' });
    const admin = await seedAdmin();
    const issue = await seedIssue({ agentId: owner.id, status: 'IN_PROGRESS' });

    expect((await visit(issue.id, asAgent(other), { scheduledAt: '2026-10-01T09:00' })).status).toBe(403);
    expect((await visit(issue.id, asAdmin(admin), { scheduledAt: '2026-10-01T09:00' })).status).toBe(403);
  });
});

describe('messages on closed claims', () => {
  const send = (issueId: number, who: Who, body: unknown) =>
    postMessage(authedRequest(`/api/issues/${issueId}/messages`, who, { method: 'POST', body }), routeParams({ id: String(issueId) }));

  it.each(['CONFIRMED', 'REJECTED'] as const)('a resident cannot write on a %s claim', async (status) => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id, status });

    expect((await send(issue.id, asClient(client), { content: 'Bonjour' })).status).toBe(409);
    expect(await prisma.issueMessage.count({ where: { issueId: issue.id } })).toBe(0);
  });

  it('an admin can still write on a closed claim', async () => {
    const admin = await seedAdmin();
    const issue = await seedIssue({ status: 'CONFIRMED' });

    expect((await send(issue.id, asAdmin(admin), { content: 'Suivi' })).status).toBe(201);
  });

  it('a resident message saved before the claim closed, then replayed, still reports success', async () => {
    const client = await seedClient();
    const issue = await seedIssue({ clientId: client.id, status: 'IN_PROGRESS' });
    const clientRequestId = '11111111-2222-3333-4444-555555555555';

    expect((await send(issue.id, asClient(client), { content: 'Merci', clientRequestId })).status).toBe(201);
    await prisma.issue.update({ where: { id: issue.id }, data: { status: 'CONFIRMED' } });

    expect((await send(issue.id, asClient(client), { content: 'Merci', clientRequestId })).status).toBe(200);
    expect(await prisma.issueMessage.count({ where: { issueId: issue.id } })).toBe(1);
  });
});
