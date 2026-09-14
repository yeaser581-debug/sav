import { describe, it, expect, beforeEach, vi } from 'vitest';

const sendNotification = vi.fn();

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

const { sendPush, sendPushToMany } = await import('@/lib/push');
const { prisma } = await import('@/lib/prisma');
const { resetDb, seedClient, seedAdmin } = await import('../helpers/db');

async function addSubscription(userId: number, userRole: string, endpoint: string) {
  return prisma.pushSubscription.create({
    data: { userId, userRole, endpoint, p256dh: 'key', auth: 'auth' },
  });
}

beforeEach(async () => {
  sendNotification.mockReset();
  sendNotification.mockResolvedValue(undefined);
  await prisma.pushSubscription.deleteMany();
  await resetDb();
});

const payload = { title: 'Titre', body: 'Corps', link: '/client' };

describe('sendPush', () => {
  it('does nothing when the user has no device registered', async () => {
    const client = await seedClient();
    const result = await sendPush(client.id, 'client', payload);

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends to every device the user registered', async () => {
    const client = await seedClient();
    await addSubscription(client.id, 'client', 'https://push.example/phone');
    await addSubscription(client.id, 'client', 'https://push.example/laptop');

    const result = await sendPush(client.id, 'client', payload);

    expect(result.sent).toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it('sends the payload as JSON the service worker can read', async () => {
    const client = await seedClient();
    await addSubscription(client.id, 'client', 'https://push.example/phone');

    await sendPush(client.id, 'client', payload);

    const [subscription, body] = sendNotification.mock.calls[0];
    expect(subscription).toMatchObject({ endpoint: 'https://push.example/phone' });
    expect(JSON.parse(body as string)).toMatchObject({ title: 'Titre', body: 'Corps', link: '/client' });
  });

  it('does not reach a different role holding the same numeric id', async () => {
    const client = await seedClient();
    await addSubscription(client.id, 'admin', 'https://push.example/admin-device');

    const result = await sendPush(client.id, 'client', payload);

    expect(result.sent).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('deletes a subscription the push service reports as gone', async () => {
    const client = await seedClient();
    await addSubscription(client.id, 'client', 'https://push.example/dead');
    sendNotification.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));

    const result = await sendPush(client.id, 'client', payload);

    expect(result).toEqual({ sent: 0, removed: 1 });
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('keeps the subscription when the failure is transient', async () => {
    const client = await seedClient();
    await addSubscription(client.id, 'client', 'https://push.example/flaky');
    sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));

    const result = await sendPush(client.id, 'client', payload);

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(await prisma.pushSubscription.count()).toBe(1);
  });

  it('one dead device does not stop the others receiving it', async () => {
    const client = await seedClient();
    await addSubscription(client.id, 'client', 'https://push.example/dead');
    await addSubscription(client.id, 'client', 'https://push.example/alive');

    sendNotification.mockImplementation((sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith('/dead')) {
        return Promise.reject(Object.assign(new Error('gone'), { statusCode: 404 }));
      }
      return Promise.resolve(undefined);
    });

    const result = await sendPush(client.id, 'client', payload);

    expect(result).toEqual({ sent: 1, removed: 1 });
    const remaining = await prisma.pushSubscription.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].endpoint).toBe('https://push.example/alive');
  });
});

describe('sendPushToMany', () => {
  it('totals what it sent across recipients', async () => {
    const client = await seedClient();
    const admin = await seedAdmin();
    await addSubscription(client.id, 'client', 'https://push.example/client');
    await addSubscription(admin.id, 'admin', 'https://push.example/admin');

    const result = await sendPushToMany(
      [
        { userId: client.id, userRole: 'client' },
        { userId: admin.id, userRole: 'admin' },
      ],
      payload
    );

    expect(result).toEqual({ sent: 2, removed: 0 });
  });
});
