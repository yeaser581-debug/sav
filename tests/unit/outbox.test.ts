import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as outbox from '@/lib/outbox';

function clearOutboxStore() {
  return new Promise<void>((resolve, reject) => {
    const openReq = indexedDB.open('sav-outbox', 1);
    openReq.onupgradeneeded = () => {
      if (!openReq.result.objectStoreNames.contains('queue')) {
        openReq.result.createObjectStore('queue', { keyPath: 'id' });
      }
    };
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction('queue', 'readwrite');
      tx.objectStore('queue').clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    openReq.onerror = () => reject(openReq.error);
  });
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await clearOutboxStore();
});

describe('outboxFetch', () => {
  it('returns sent and does not queue when the fetch succeeds', async () => {
    const res = new Response('{}', { status: 200 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));

    const result = await outbox.outboxFetch('/api/issues', { method: 'POST', headers: {}, body: '{}' }, 'id-1');

    expect(result.status).toBe('sent');
    expect(await outbox.getPendingCount()).toBe(0);
  });

  it('queues immediately without calling fetch when navigator.onLine is false', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', fetchMock);

    const result = await outbox.outboxFetch('/api/issues', { method: 'POST', headers: {}, body: '{}' }, 'id-2');

    expect(result.status).toBe('queued');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await outbox.getPendingCount()).toBe(1);
  });

  it('queues when fetch throws even though navigator says online', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await outbox.outboxFetch('/api/issues', { method: 'POST', headers: {}, body: '{}' }, 'id-3');

    expect(result.status).toBe('queued');
    expect(await outbox.getPendingCount()).toBe(1);
  });
});

describe('flushOutbox', () => {
  it('removes an entry and emits "sent" once it succeeds', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await outbox.outboxFetch('/api/issues', { method: 'POST', headers: {}, body: '{}' }, 'id-4', { kind: 'issue' });

    const events: string[] = [];
    const unsubscribe = outbox.subscribe((e) => events.push(e.type));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    await outbox.flushOutbox();
    unsubscribe();

    expect(events).toContain('sent');
    expect(await outbox.getPendingCount()).toBe(0);
  });

  it('stops the pass and keeps the entry queued on a 401 (session expired)', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await outbox.outboxFetch('/api/issues', { method: 'POST', headers: {}, body: '{}' }, 'id-5');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await outbox.flushOutbox();

    expect(await outbox.getPendingCount()).toBe(1);
  });

  it('drops a non-retryable failure (e.g. 400) and emits "failed"', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await outbox.outboxFetch('/api/issues', { method: 'POST', headers: {}, body: '{}' }, 'id-6');

    const events: string[] = [];
    const unsubscribe = outbox.subscribe((e) => events.push(e.type));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));
    await outbox.flushOutbox();
    unsubscribe();

    expect(events).toContain('failed');
    expect(await outbox.getPendingCount()).toBe(0);
  });

  it('leaves everything queued when still offline during the flush attempt', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await outbox.outboxFetch('/api/issues', { method: 'POST', headers: {}, body: '{}' }, 'id-7');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await outbox.flushOutbox();

    expect(await outbox.getPendingCount()).toBe(1);
  });
});
