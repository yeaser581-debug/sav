import { NextRequest, NextResponse } from 'next/server';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function consume(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function enforce(
  req: NextRequest,
  scope: string,
  { limit, windowMs, identifier }: { limit: number; windowMs: number; identifier?: string }
): NextResponse | null {
  const key = `${scope}:${clientIp(req)}:${(identifier ?? '').toLowerCase()}`;
  const { allowed, retryAfter } = consume(key, limit, windowMs);
  if (allowed) return null;

  return NextResponse.json(
    { error: 'Trop de tentatives. Veuillez réessayer dans quelques instants.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

export function reset(key: string) {
  buckets.delete(key);
}

export function clearAll() {
  buckets.clear();
}
