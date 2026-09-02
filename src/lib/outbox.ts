export type OutboxMeta = { kind: 'issue' | 'message' | 'status'; issueId?: number };

export type OutboxEntry = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
  meta?: OutboxMeta;
};

type OutboxEvent =
  | { type: 'queued'; entry: OutboxEntry }
  | { type: 'sent'; id: string; meta?: OutboxMeta }
  | { type: 'failed'; id: string; meta?: OutboxMeta };

const DB_NAME = 'sav-outbox';
const STORE = 'queue';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllEntries(): Promise<OutboxEntry[]> {
  const entries = await withStore<OutboxEntry[]>('readonly', store => store.getAll());
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

async function put(entry: OutboxEntry): Promise<void> {
  await withStore('readwrite', store => store.put(entry));
}

async function remove(id: string): Promise<void> {
  await withStore('readwrite', store => store.delete(id));
}

const listeners = new Set<(event: OutboxEvent) => void>();

function emit(event: OutboxEvent) {
  listeners.forEach(cb => cb(event));
}

export function subscribe(cb: (event: OutboxEvent) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function getPendingCount(): Promise<number> {
  return (await getAllEntries()).length;
}

async function enqueue(url: string, method: string, headers: Record<string, string>, body: string, id: string, meta?: OutboxMeta) {
  const entry: OutboxEntry = { id, url, method, headers, body, createdAt: Date.now(), meta };
  await put(entry);
  emit({ type: 'queued', entry });
  return entry;
}

export async function outboxFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
  id: string,
  meta?: OutboxMeta
): Promise<{ status: 'sent'; res: Response } | { status: 'queued'; id: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueue(url, init.method, init.headers, init.body, id, meta);
    return { status: 'queued', id };
  }

  try {
    const res = await fetch(url, init);
    return { status: 'sent', res };
  } catch {
    await enqueue(url, init.method, init.headers, init.body, id, meta);
    return { status: 'queued', id };
  }
}

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const entries = await getAllEntries();
    for (const entry of entries) {
      let res: Response;
      try {
        res = await fetch(entry.url, { method: entry.method, headers: entry.headers, body: entry.body });
      } catch {
        break;
      }

      if (res.ok) {
        await remove(entry.id);
        emit({ type: 'sent', id: entry.id, meta: entry.meta });
      } else if (res.status === 401) {
        break;
      } else {
        await remove(entry.id);
        emit({ type: 'failed', id: entry.id, meta: entry.meta });
      }
    }
  } finally {
    flushing = false;
  }
}
