import { describe, it, expect, beforeEach } from 'vitest';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as clientLogin } from '@/app/api/auth/client-login/route';
import { resetDb, seedAdmin, seedAgent, seedClient, PASSWORD } from '../helpers/db';
import { unauthedRequest } from '../helpers/request';

beforeEach(resetDb);

describe('POST /api/auth/login', () => {
  it('logs an admin in and sets a token cookie', async () => {
    const admin = await seedAdmin({ email: 'a@test.local' });
    const res = await login(unauthedRequest('/api/auth/login', { method: 'POST', body: { email: admin.email, password: PASSWORD, role: 'admin' } }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toMatchObject({ id: admin.id, role: 'admin' });
    expect(res.cookies.get('token')?.value).toBeTruthy();
  });

  it('logs an agent in', async () => {
    const agent = await seedAgent({ email: 'agent@test.local' });
    const res = await login(unauthedRequest('/api/auth/login', { method: 'POST', body: { email: agent.email, password: PASSWORD, role: 'agent' } }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toMatchObject({ id: agent.id, role: 'agent' });
  });

  it('rejects a wrong password', async () => {
    const admin = await seedAdmin();
    const res = await login(unauthedRequest('/api/auth/login', { method: 'POST', body: { email: admin.email, password: 'wrong', role: 'admin' } }));
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    const res = await login(unauthedRequest('/api/auth/login', { method: 'POST', body: { email: 'nobody@test.local', password: PASSWORD, role: 'admin' } }));
    expect(res.status).toBe(401);
  });

  it('rejects a disabled admin even with the right password', async () => {
    const admin = await seedAdmin({ isActive: false });
    const res = await login(unauthedRequest('/api/auth/login', { method: 'POST', body: { email: admin.email, password: PASSWORD, role: 'admin' } }));
    expect(res.status).toBe(403);
  });

  it('rejects a request missing a field', async () => {
    const res = await login(unauthedRequest('/api/auth/login', { method: 'POST', body: { email: 'a@b.com', password: PASSWORD } }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/client-login', () => {
  it('logs a client in by their login (not email)', async () => {
    const client = await seedClient({ login: 'jean.dupont' });
    const res = await clientLogin(unauthedRequest('/api/auth/client-login', { method: 'POST', body: { login: client.login, password: PASSWORD } }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toMatchObject({ id: client.id, role: 'client' });
  });

  it('rejects a wrong password', async () => {
    const client = await seedClient();
    const res = await clientLogin(unauthedRequest('/api/auth/client-login', { method: 'POST', body: { login: client.login, password: 'wrong' } }));
    expect(res.status).toBe(401);
  });
});
