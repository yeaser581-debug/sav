import { describe, it, expect } from 'vitest';
import {
  isMessageSeen,
  latestMessageAt,
  adminHasUnread,
  clientHasUnread,
  readTimestamp,
  formatSeenAt,
} from '@/lib/read-state';

const T = (iso: string) => new Date(iso);

describe('isMessageSeen', () => {
  it('is seen when the other party read after it was sent', () => {
    expect(isMessageSeen('2026-09-15T10:00:00Z', '2026-09-15T10:05:00Z')).toBe(true);
  });

  it('is seen when read at the exact moment it was sent', () => {
    expect(isMessageSeen('2026-09-15T10:00:00Z', '2026-09-15T10:00:00Z')).toBe(true);
  });

  it('is not seen when the last read predates the message', () => {
    expect(isMessageSeen('2026-09-15T10:05:00Z', '2026-09-15T10:00:00Z')).toBe(false);
  });

  it('is not seen when the other party has never read', () => {
    expect(isMessageSeen('2026-09-15T10:00:00Z', null)).toBe(false);
  });

  it('does not claim seen on a malformed date', () => {
    expect(isMessageSeen('not-a-date', '2026-09-15T10:00:00Z')).toBe(false);
  });
});

describe('latestMessageAt', () => {
  const messages = [
    { senderType: 'CLIENT', createdAt: '2026-09-15T09:00:00Z' },
    { senderType: 'ADMIN', createdAt: '2026-09-15T11:00:00Z' },
    { senderType: 'CLIENT', createdAt: '2026-09-15T10:00:00Z' },
  ];

  it('finds the newest message from one side, regardless of order', () => {
    expect(latestMessageAt(messages, 'CLIENT')).toEqual(T('2026-09-15T10:00:00Z'));
  });

  it('ignores the other side', () => {
    expect(latestMessageAt(messages, 'ADMIN')).toEqual(T('2026-09-15T11:00:00Z'));
  });

  it('returns null when that side never wrote', () => {
    expect(latestMessageAt([{ senderType: 'ADMIN', createdAt: '2026-09-15T11:00:00Z' }], 'CLIENT')).toBeNull();
  });
});

describe('adminHasUnread', () => {
  it('treats a claim no admin has opened as unread, even with no messages', () => {
    expect(adminHasUnread({ adminLastReadAt: null, latestClientMessageAt: null })).toBe(true);
  });

  it('is read once opened and the resident has not written since', () => {
    expect(adminHasUnread({ adminLastReadAt: '2026-09-15T10:00:00Z', latestClientMessageAt: '2026-09-15T09:00:00Z' })).toBe(false);
  });

  it('becomes unread again when the resident writes after the last opening', () => {
    expect(adminHasUnread({ adminLastReadAt: '2026-09-15T10:00:00Z', latestClientMessageAt: '2026-09-15T10:01:00Z' })).toBe(true);
  });
});

describe('clientHasUnread', () => {
  it('has nothing unread when the administration never wrote', () => {
    expect(clientHasUnread({ clientLastReadAt: null, latestAdminMessageAt: null })).toBe(false);
  });

  it('is unread when the administration wrote and the resident never opened', () => {
    expect(clientHasUnread({ clientLastReadAt: null, latestAdminMessageAt: '2026-09-15T10:00:00Z' })).toBe(true);
  });

  it('is read once opened after the last admin message', () => {
    expect(clientHasUnread({ clientLastReadAt: '2026-09-15T10:05:00Z', latestAdminMessageAt: '2026-09-15T10:00:00Z' })).toBe(false);
  });
});

describe('readTimestamp', () => {
  it('uses the current time normally', () => {
    const now = T('2026-09-15T10:00:00Z');
    expect(readTimestamp(now, '2026-09-15T09:00:00Z')).toEqual(now);
  });

  it('never stamps a read earlier than the message it is reading', () => {
    const now = T('2026-09-15T10:00:00Z');
    expect(readTimestamp(now, '2026-09-15T10:00:02Z')).toEqual(T('2026-09-15T10:00:02Z'));
  });
});

describe('formatSeenAt', () => {
  const now = new Date(2026, 8, 15, 18, 0);

  it('says today for a read earlier the same day', () => {
    expect(formatSeenAt(new Date(2026, 8, 15, 9, 28), now)).toBe('aujourd’hui à 09:28');
  });

  it('says yesterday for the previous day', () => {
    expect(formatSeenAt(new Date(2026, 8, 14, 23, 5), now)).toBe('hier à 23:05');
  });

  it('gives the date for anything older', () => {
    expect(formatSeenAt(new Date(2026, 5, 11, 17, 46), now)).toBe('le 11 juin à 17:46');
  });

  it('returns nothing for a missing date rather than "Invalid Date"', () => {
    expect(formatSeenAt(null, now)).toBe('');
  });
});
