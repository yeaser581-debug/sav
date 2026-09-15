type Stamp = string | Date | null | undefined;

function time(value: Stamp): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function isMessageSeen(messageCreatedAt: Stamp, otherPartyLastReadAt: Stamp): boolean {
  const sent = time(messageCreatedAt);
  const read = time(otherPartyLastReadAt);
  return sent !== null && read !== null && read >= sent;
}

export function latestMessageAt(
  messages: { senderType: string; createdAt: Stamp }[],
  senderType: 'CLIENT' | 'ADMIN'
): Date | null {
  let latest: number | null = null;
  for (const m of messages) {
    if (m.senderType !== senderType) continue;
    const ms = time(m.createdAt);
    if (ms !== null && (latest === null || ms > latest)) latest = ms;
  }
  return latest === null ? null : new Date(latest);
}

export function adminHasUnread({
  adminLastReadAt,
  latestClientMessageAt,
}: {
  adminLastReadAt: Stamp;
  latestClientMessageAt: Stamp;
}): boolean {
  const read = time(adminLastReadAt);
  if (read === null) return true;
  const latest = time(latestClientMessageAt);
  return latest !== null && latest > read;
}

export function clientHasUnread({
  clientLastReadAt,
  latestAdminMessageAt,
}: {
  clientLastReadAt: Stamp;
  latestAdminMessageAt: Stamp;
}): boolean {
  const latest = time(latestAdminMessageAt);
  if (latest === null) return false;
  const read = time(clientLastReadAt);
  return read === null || latest > read;
}

export function readTimestamp(now: Date, latestIncomingAt: Stamp): Date {
  const latest = time(latestIncomingAt);
  return latest !== null && latest > now.getTime() ? new Date(latest) : now;
}

export function formatSeenAt(value: Stamp, now: Date = new Date()): string {
  const ms = time(value);
  if (ms === null) return '';
  const date = new Date(ms);
  const hour = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) return `aujourd’hui à ${hour}`;
  if (days === 1) return `hier à ${hour}`;
  return `le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${hour}`;
}

const ISSUE_READ_EVENT = 'issue:read';

export function announceIssueRead(issueId: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ISSUE_READ_EVENT, { detail: { issueId } }));
}

export function onIssueRead(handler: (issueId: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const issueId = (event as CustomEvent<{ issueId: number }>).detail?.issueId;
    if (typeof issueId === 'number') handler(issueId);
  };
  window.addEventListener(ISSUE_READ_EVENT, listener);
  return () => window.removeEventListener(ISSUE_READ_EVENT, listener);
}
