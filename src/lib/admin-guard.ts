import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, type JWTPayload } from '@/lib/auth';

// Answers that describe one person must not be kept by a browser or proxy cache.
export const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

export function adminFrom(req: NextRequest): JWTPayload | null {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  return payload?.role === 'admin' ? payload : null;
}

// A route segment that is a positive whole number, or null.
export function parseId(raw: string): number | null {
  if (!/^\d{1,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
}

export function notFound(message = 'Client introuvable.') {
  return NextResponse.json({ error: message }, { status: 404, headers: PRIVATE_HEADERS });
}

export function privateJson(body: unknown) {
  return NextResponse.json(body, { headers: PRIVATE_HEADERS });
}
