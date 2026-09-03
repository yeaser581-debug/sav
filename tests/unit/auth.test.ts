import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, getTokenFromCookieHeader, type JWTPayload } from '@/lib/auth';

const payload: JWTPayload = { id: 1, email: 'a@b.com', role: 'admin', isSuperAdmin: true };

describe('signToken / verifyToken', () => {
  it('round-trips a payload', () => {
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it('rejects a garbage token', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
  });

  it('rejects a tampered token', () => {
    const token = signToken(payload);
    const tampered = token.slice(0, -2) + (token.at(-2) === 'a' ? 'b' : 'a') + token.at(-1);
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });
});

describe('getTokenFromCookieHeader', () => {
  it('extracts the named cookie among several', () => {
    const header = 'foo=bar; token=abc123; baz=qux';
    expect(getTokenFromCookieHeader(header, 'token')).toBe('abc123');
  });

  it('handles a token value containing "="', () => {
    const header = 'token=abc.def==';
    expect(getTokenFromCookieHeader(header, 'token')).toBe('abc.def==');
  });

  it('returns null when the cookie is absent', () => {
    expect(getTokenFromCookieHeader('foo=bar', 'token')).toBeNull();
  });

  it('returns null for a null header', () => {
    expect(getTokenFromCookieHeader(null, 'token')).toBeNull();
  });
});
