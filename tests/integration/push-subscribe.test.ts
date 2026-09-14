import { describe, it, expect, beforeEach } from 'vitest';
import { POST as subscribe, DELETE as unsubscribe } from '@/app/api/push/subscribe/route';
import { prisma } from '@/lib/prisma';
import { resetDb, seedAdmin, seedClient } from '../helpers/db';
import { authedRequest, unauthedRequest } from '../helpers/request';

beforeEach(async () => {
  await prisma.pushSubscription.deleteMany();
  await resetDb();
});

const sub = (endpoint: string) => ({
  endpoint,
  keys: { p256dh: 'BPublicKeyValue', auth: 'AuthSecret' },
});

describe('POST /api/push/subscribe', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await subscribe(unauthedRequest('/api/push/subscribe', { method: 'POST', body: sub('https://push.example/a') }));
    expect(res.status).toBe(401);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('stores a subscription against the signed-in user', async () => {
    const client = await seedClient();
    const res = await subscribe(
      authedRequest('/api/push/subscribe', { id: client.id, email: client.login, role: 'client' }, { method: 'POST', body: sub('https://push.example/a') })
    );
    expect(res.status).toBe(200);

    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: client.id, userRole: 'client', endpoint: 'https://push.example/a' });
  });

  it('rejects a payload missing its keys', async () => {
    const client = await seedClient();
    const res = await subscribe(
      authedRequest('/api/push/subscribe', { id: client.id, email: client.login, role: 'client' }, { method: 'POST', body: { endpoint: 'https://push.example/a' } })
    );
    expect(res.status).toBe(400);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('rejects an over-long endpoint rather than truncating it', async () => {
    const client = await seedClient();
    const res = await subscribe(
      authedRequest('/api/push/subscribe', { id: client.id, email: client.login, role: 'client' }, { method: 'POST', body: sub('https://push.example/' + 'x'.repeat(600)) })
    );
    expect(res.status).toBe(400);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('re-registering the same device does not duplicate the row', async () => {
    const client = await seedClient();
    const payload = { id: client.id, email: client.login, role: 'client' as const };

    await subscribe(authedRequest('/api/push/subscribe', payload, { method: 'POST', body: sub('https://push.example/a') }));
    await subscribe(authedRequest('/api/push/subscribe', payload, { method: 'POST', body: sub('https://push.example/a') }));

    expect(await prisma.pushSubscription.count()).toBe(1);
  });

  it('reassigns a device when a different user signs in on it', async () => {
    const first = await seedClient({ login: 'first' });
    const admin = await seedAdmin();

    await subscribe(authedRequest('/api/push/subscribe', { id: first.id, email: first.login, role: 'client' }, { method: 'POST', body: sub('https://push.example/shared') }));
    await subscribe(authedRequest('/api/push/subscribe', { id: admin.id, email: admin.email, role: 'admin' }, { method: 'POST', body: sub('https://push.example/shared') }));

    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: admin.id, userRole: 'admin' });
  });

  it('keeps separate devices for the same user', async () => {
    const client = await seedClient();
    const payload = { id: client.id, email: client.login, role: 'client' as const };

    await subscribe(authedRequest('/api/push/subscribe', payload, { method: 'POST', body: sub('https://push.example/phone') }));
    await subscribe(authedRequest('/api/push/subscribe', payload, { method: 'POST', body: sub('https://push.example/laptop') }));

    expect(await prisma.pushSubscription.count()).toBe(2);
  });
});

describe('DELETE /api/push/subscribe', () => {
  it('removes the caller\'s own subscription', async () => {
    const client = await seedClient();
    const payload = { id: client.id, email: client.login, role: 'client' as const };

    await subscribe(authedRequest('/api/push/subscribe', payload, { method: 'POST', body: sub('https://push.example/a') }));
    const res = await unsubscribe(authedRequest('/api/push/subscribe', payload, { method: 'DELETE', body: { endpoint: 'https://push.example/a' } }));

    expect(res.status).toBe(200);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('will not delete a subscription belonging to someone else', async () => {
    const owner = await seedClient({ login: 'owner' });
    const other = await seedClient({ login: 'other' });

    await subscribe(authedRequest('/api/push/subscribe', { id: owner.id, email: owner.login, role: 'client' }, { method: 'POST', body: sub('https://push.example/a') }));
    await unsubscribe(authedRequest('/api/push/subscribe', { id: other.id, email: other.login, role: 'client' }, { method: 'DELETE', body: { endpoint: 'https://push.example/a' } }));

    expect(await prisma.pushSubscription.count()).toBe(1);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await unsubscribe(unauthedRequest('/api/push/subscribe', { method: 'DELETE', body: { endpoint: 'https://push.example/a' } }));
    expect(res.status).toBe(401);
  });
});
