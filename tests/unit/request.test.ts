import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { getPublicBaseUrl } from '@/lib/request';

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers: new Headers(headers) });
}

describe('getPublicBaseUrl', () => {
  it('prefers x-forwarded-host/proto when a proxy sets them', () => {
    const result = getPublicBaseUrl(req('http://localhost:8080/api/auth/qr', {
      'x-forwarded-host': 'sav-production-10b4.up.railway.app',
      'x-forwarded-proto': 'https',
    }));
    expect(result).toBe('https://sav-production-10b4.up.railway.app');
  });

  it('falls back to the plain host header when there is no proxy', () => {
    const result = getPublicBaseUrl(req('http://localhost:3100/api/auth/qr', {
      host: 'localhost:3100',
    }));
    expect(result).toBe('http://localhost:3100');
  });

  it('falls back to req.url when no host header is present at all', () => {
    const result = getPublicBaseUrl(req('http://localhost:3000/api/auth/qr'));
    expect(result).toBe('http://localhost:3000/api/auth/qr');
  });
});
