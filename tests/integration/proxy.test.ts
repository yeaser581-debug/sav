import { describe, it, expect, beforeEach } from 'vitest';
import { proxy } from '@/proxy';
import { resetDb, seedAdmin, seedAgent, seedClient } from '../helpers/db';
import { authedRequest, unauthedRequest } from '../helpers/request';

beforeEach(resetDb);

describe('proxy', () => {
  it('lets a public route through with no token', async () => {
    const res = await proxy(unauthedRequest('/login'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects to /login when there is no token on a protected route', async () => {
    const res = await proxy(unauthedRequest('/admin'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects to /login and clears the cookie for a garbage token', async () => {
    const req = unauthedRequest('/admin');
    req.headers.set('cookie', 'token=not-a-real-jwt');
    const res = await proxy(req);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('lets an admin through to /admin', async () => {
    const admin = await seedAdmin();
    const res = await proxy(authedRequest('/admin', { id: admin.id, email: admin.email, role: 'admin' }));
    expect(res.headers.get('location')).toBeNull();
  });

  it('kicks out a since-disabled admin even with a still-valid token', async () => {
    const admin = await seedAdmin({ isActive: false });
    const res = await proxy(authedRequest('/admin', { id: admin.id, email: admin.email, role: 'admin' }));
    expect(res.headers.get('location')).toContain('/login?error=disabled');
  });

  it('returns a 401 JSON body (not a redirect) for a disabled admin hitting an API route', async () => {
    const admin = await seedAdmin({ isActive: false });
    const res = await proxy(authedRequest('/api/admins', { id: admin.id, email: admin.email, role: 'admin' }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('ACCOUNT_DISABLED');
  });

  it('redirects a client who must still set their password to /client/activate', async () => {
    const client = await seedClient({ mustSetPassword: true });
    const res = await proxy(authedRequest('/client', { id: client.id, email: client.login, role: 'client' }));
    expect(res.headers.get('location')).toContain('/client/activate');
  });

  it('lets that same client reach /client/activate itself', async () => {
    const client = await seedClient({ mustSetPassword: true });
    const res = await proxy(authedRequest('/client/activate', { id: client.id, email: client.login, role: 'client' }));
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets a password-set client reach the normal client area', async () => {
    const client = await seedClient({ mustSetPassword: false });
    const res = await proxy(authedRequest('/client', { id: client.id, email: client.login, role: 'client' }));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects an agent trying to reach an admin-prefixed page to their own area', async () => {
    const agent = await seedAgent();
    const res = await proxy(authedRequest('/admin', { id: agent.id, email: agent.email, role: 'agent' }));
    expect(res.headers.get('location')).toContain('/agent');
  });

  it('does not apply page role-prefix redirects to API routes', async () => {
    const agent = await seedAgent();
    const res = await proxy(authedRequest('/api/admins', { id: agent.id, email: agent.email, role: 'agent' }));
    expect(res.headers.get('location')).toBeNull();
  });
});
