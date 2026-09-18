import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { POST as signIn } from '@/app/api/auth/sign-in/route';
import { prisma } from '@/lib/prisma';
import { clearAll } from '@/lib/rate-limit';
import { SIGN_IN_ERROR } from '@/lib/sign-in';
import { resetDb, seedAdmin, seedAgent, seedClient, PASSWORD } from '../helpers/db';
import { unauthedRequest } from '../helpers/request';

beforeEach(async () => {
  await resetDb();
  clearAll();
});

const attempt = (identifier: string, password: string) =>
  signIn(unauthedRequest('/api/auth/sign-in', { method: 'POST', body: { identifier, password } }));

async function user(res: Response) {
  expect(res.status, await res.clone().text()).toBe(200);
  return (await res.json()).user;
}

describe('one field, three kinds of account', () => {
  it('signs in an admin by email', async () => {
    const admin = await seedAdmin({ email: 'boss@aftersales.ma', isSuperAdmin: true });
    const data = await user(await attempt(admin.email, PASSWORD));
    expect(data).toMatchObject({ role: 'admin', isSuperAdmin: true });
  });

  it('signs in an agent by email', async () => {
    const agent = await seedAgent({ email: 'youssef@aftersales.ma' });
    expect(await user(await attempt(agent.email, PASSWORD))).toMatchObject({ role: 'agent' });
  });

  it('signs in a resident by unit code', async () => {
    await seedClient({ login: 'gz-t1-3-a-a-21', name: 'Ghrib Hakima' });
    const data = await user(await attempt('gz-t1-3-a-a-21', PASSWORD));
    expect(data).toMatchObject({ role: 'client', login: 'gz-t1-3-a-a-21' });
  });

  it('ignores case and stray spaces in the identifier', async () => {
    await seedClient({ login: 'gz-t1-3-a-a-21' });
    expect(await user(await attempt('  GZ-T1-3-A-A-21 ', PASSWORD))).toMatchObject({ role: 'client' });
  });

  it('sets the session cookie', async () => {
    await seedClient({ login: 'gz-t1-3-a-a-21' });
    const res = await attempt('gz-t1-3-a-a-21', PASSWORD);
    expect(res.headers.get('set-cookie')).toMatch(/token=.+HttpOnly/i);
  });
});

describe('what it refuses', () => {
  it.each([
    ['unknown unit code', 'gz-t1-9-z-a-99', PASSWORD],
    ['unknown email', 'personne@nulle-part.ma', PASSWORD],
    ['wrong password', 'gz-t1-3-a-a-21', 'pas-le-bon'],
  ])('refuses an %s with the same message', async (_case, identifier, password) => {
    await seedClient({ login: 'gz-t1-3-a-a-21' });
    const res = await attempt(identifier, password);

    expect(res.status).toBe(401);
    // The same wording every time: a different one would confirm which unit
    // codes exist to anyone trying them in sequence.
    expect((await res.json()).error).toBe(SIGN_IN_ERROR);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('refuses a deleted resident', async () => {
    const client = await seedClient({ login: 'gz-t1-3-a-a-21' });
    await prisma.client.update({ where: { id: client.id }, data: { deletedAt: new Date() } });
    expect((await attempt('gz-t1-3-a-a-21', PASSWORD)).status).toBe(401);
  });

  it('refuses a deleted agent', async () => {
    const agent = await seedAgent({ email: 'parti@aftersales.ma' });
    await prisma.agent.update({ where: { id: agent.id }, data: { deletedAt: new Date() } });
    expect((await attempt(agent.email, PASSWORD)).status).toBe(401);
  });

  it('tells a deactivated admin why, since the password was right', async () => {
    const admin = await seedAdmin({ email: 'ancien@aftersales.ma', isActive: false });
    const res = await attempt(admin.email, PASSWORD);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('désactivé');
  });

  it.each([['', PASSWORD], ['gz-t1-3-a-a-21', '']])('asks for both fields (%s)', async (identifier, password) => {
    expect((await attempt(identifier, password)).status).toBe(400);
  });
});

describe('an email that exists as admin and as agent', () => {
  it('signs in whichever the password belongs to', async () => {
    const shared = 'double@aftersales.ma';
    await seedAdmin({ email: shared });
    await prisma.agent.create({
      data: { name: 'Agent Double', email: shared, passwordHash: await bcrypt.hash('agent-pass', 8) },
    });

    expect(await user(await attempt(shared, PASSWORD))).toMatchObject({ role: 'admin' });
    clearAll();
    expect(await user(await attempt(shared, 'agent-pass'))).toMatchObject({ role: 'agent' });
  });
});

describe('guessing is slowed down', () => {
  it('stops after repeated failures on one identifier', async () => {
    await seedClient({ login: 'gz-t1-3-a-a-21' });
    for (let i = 0; i < 8; i++) expect((await attempt('gz-t1-3-a-a-21', 'faux')).status).toBe(401);

    const blocked = await attempt('gz-t1-3-a-a-21', 'faux');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('stops a sweep across many identifiers from one address', async () => {
    // Unit codes are sequential: without a per-address ceiling, a script gets
    // eight fresh guesses on every door in the residence.
    let lastStatus = 0;
    for (let i = 0; i < 31; i++) {
      lastStatus = (await attempt(`gz-t1-0-a-a-${i}`, 'faux')).status;
    }
    expect(lastStatus).toBe(429);
  });

  it('lets a resident in once the right password is given', async () => {
    await seedClient({ login: 'gz-t1-3-a-a-21' });
    for (let i = 0; i < 3; i++) await attempt('gz-t1-3-a-a-21', 'faux');
    expect(await user(await attempt('gz-t1-3-a-a-21', PASSWORD))).toMatchObject({ role: 'client' });
  });
});
