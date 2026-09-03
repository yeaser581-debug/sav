import { NextRequest } from 'next/server';
import { signToken, type JWTPayload } from '@/lib/auth';

type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>;

const BASE_URL = 'http://localhost:3000';

export function authedRequest(path: string, payload: JWTPayload, options: { method?: string; body?: unknown } = {}) {
  const token = signToken(payload);
  const headers = new Headers();
  headers.set('cookie', `token=${token}`);

  const init: NextRequestInit = { method: options.method ?? 'GET' };
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(options.body);
  }
  init.headers = headers;

  return new NextRequest(`${BASE_URL}${path}`, init);
}

export function unauthedRequest(path: string, options: { method?: string; body?: unknown } = {}) {
  const headers = new Headers();
  const init: NextRequestInit = { method: options.method ?? 'GET' };
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(options.body);
  }
  init.headers = headers;

  return new NextRequest(`${BASE_URL}${path}`, init);
}

export function routeParams<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}
