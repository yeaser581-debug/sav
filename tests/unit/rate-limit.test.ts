import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { consume, clearAll, clientIp, enforce } from '@/lib/rate-limit';

beforeEach(() => {
  clearAll();
});

afterEach(() => {
  vi.useRealTimers();
});

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/auth/login', { headers });
}

describe('consume', () => {
  it('allows up to the limit then blocks', () => {
    for (let i = 0; i < 3; i++) {
      expect(consume('k', 3, 1000).allowed).toBe(true);
    }
    expect(consume('k', 3, 1000).allowed).toBe(false);
  });

  it('keeps separate counters per key', () => {
    consume('a', 1, 1000);
    expect(consume('a', 1, 1000).allowed).toBe(false);
    expect(consume('b', 1, 1000).allowed).toBe(true);
  });

  it('reports a positive retryAfter when blocked', () => {
    consume('k', 1, 60_000);
    const result = consume('k', 1, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it('resets once the window has elapsed', () => {
    vi.useFakeTimers();
    consume('k', 1, 1000);
    expect(consume('k', 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(consume('k', 1, 1000).allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('prefers the first x-forwarded-for entry', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
  });

  it('returns unknown when no ip header is present', () => {
    expect(clientIp(req())).toBe('unknown');
  });
});

describe('enforce', () => {
  const opts = { limit: 2, windowMs: 60_000 };

  it('returns null while under the limit', () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1' });
    expect(enforce(r, 'login', { ...opts, identifier: 'a@b.c' })).toBeNull();
  });

  it('returns a 429 with Retry-After once over the limit', () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1' });
    enforce(r, 'login', { ...opts, identifier: 'a@b.c' });
    enforce(r, 'login', { ...opts, identifier: 'a@b.c' });
    const blocked = enforce(r, 'login', { ...opts, identifier: 'a@b.c' });

    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(Number(blocked!.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('isolates identifiers on the same ip', () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1' });
    enforce(r, 'login', { ...opts, identifier: 'one@b.c' });
    enforce(r, 'login', { ...opts, identifier: 'one@b.c' });
    expect(enforce(r, 'login', { ...opts, identifier: 'one@b.c' })).not.toBeNull();
    expect(enforce(r, 'login', { ...opts, identifier: 'two@b.c' })).toBeNull();
  });

  it('isolates ips using the same identifier', () => {
    const a = req({ 'x-forwarded-for': '1.1.1.1' });
    const b = req({ 'x-forwarded-for': '2.2.2.2' });
    enforce(a, 'login', { ...opts, identifier: 'a@b.c' });
    enforce(a, 'login', { ...opts, identifier: 'a@b.c' });
    expect(enforce(a, 'login', { ...opts, identifier: 'a@b.c' })).not.toBeNull();
    expect(enforce(b, 'login', { ...opts, identifier: 'a@b.c' })).toBeNull();
  });

  it('treats identifiers case-insensitively', () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1' });
    enforce(r, 'login', { ...opts, identifier: 'User@B.c' });
    enforce(r, 'login', { ...opts, identifier: 'user@b.c' });
    expect(enforce(r, 'login', { ...opts, identifier: 'USER@B.C' })).not.toBeNull();
  });

  it('isolates scopes', () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1' });
    enforce(r, 'login', { ...opts, identifier: 'a@b.c' });
    enforce(r, 'login', { ...opts, identifier: 'a@b.c' });
    expect(enforce(r, 'login', { ...opts, identifier: 'a@b.c' })).not.toBeNull();
    expect(enforce(r, 'otp-send', { ...opts, identifier: 'a@b.c' })).toBeNull();
  });
});
