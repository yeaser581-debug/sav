'use client';

import { useCallback, useEffect, useState } from 'react';

// Last good answer per URL for this tab. Shown straight away when a screen is
// reopened, then replaced by the fresh answer: no spinner on the way back.
const MAX_ENTRIES = 100;
const lastKnown = new Map<string, unknown>();

function remember(url: string, data: unknown) {
  lastKnown.delete(url);
  lastKnown.set(url, data);
  if (lastKnown.size > MAX_ENTRIES) lastKnown.delete(lastKnown.keys().next().value!);
}

// Drop remembered answers after a change, e.g. invalidateJson('/api/clients').
export function invalidateJson(prefix: string) {
  for (const key of [...lastKnown.keys()]) {
    if (key.startsWith(prefix)) lastKnown.delete(key);
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

type Result<T> = { key: string | null; url: string | null; data: T | null; error: HttpError | null };

/**
 * GET a JSON endpoint. A newer URL cancels the request for the older one, so
 * fast typing or paging never shows a stale answer. With `keepPrevious`, the
 * last page stays on screen while the next one loads. Pass `cache: false` for
 * answers that must not be kept in memory, such as login tokens.
 */
export function useJson<T>(url: string | null, { keepPrevious = false, cache = true } = {}) {
  const [nonce, setNonce] = useState(0);
  const key = url ? `${nonce}:${url}` : null;
  const [result, setResult] = useState<Result<T>>({ key: null, url: null, data: null, error: null });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new HttpError(res.status, (body && typeof body.error === 'string' && body.error) || 'Erreur de chargement.');
        }
        if (cache) remember(url, body);
        setResult({ key, url, data: body as T, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const error = err instanceof HttpError ? err : new HttpError(0, 'Erreur de connexion.');
        setResult(prev => ({ key, url, data: prev.url === url ? prev.data : null, error }));
      });

    return () => controller.abort();
  }, [url, key, cache]);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  const settled = key !== null && result.key === key;
  const remembered = url && cache ? (lastKnown.get(url) as T | undefined) : undefined;
  const carried = keepPrevious || result.url === url ? result.data : null;

  return {
    data: url ? (settled ? result.data : remembered ?? carried) : null,
    error: settled ? result.error : null,
    loading: url !== null && !settled,
    reload,
  };
}
