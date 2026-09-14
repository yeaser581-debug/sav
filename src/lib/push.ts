import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:contact@aftersales.local';

let configured = false;

export function pushConfigured(): boolean {
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  link?: string;
  tag?: string;
};

export async function sendPush(userId: number, userRole: string, payload: PushPayload) {
  if (!pushConfigured()) return { sent: 0, removed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId, userRole } });
  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          stale.push(sub.endpoint);
        } else {
          console.error('[PUSH] send failed', status, (err as Error).message);
        }
      }
    })
  );

  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
  }

  return { sent, removed: stale.length };
}

export async function sendPushToMany(targets: { userId: number; userRole: string }[], payload: PushPayload) {
  const results = await Promise.all(targets.map(t => sendPush(t.userId, t.userRole, payload)));
  return results.reduce(
    (acc, r) => ({ sent: acc.sent + r.sent, removed: acc.removed + r.removed }),
    { sent: 0, removed: 0 }
  );
}
