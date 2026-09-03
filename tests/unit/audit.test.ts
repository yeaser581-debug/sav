import { describe, it, expect, vi, beforeEach } from 'vitest';

const { auditLogCreate } = vi.hoisted(() => ({ auditLogCreate: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { create: auditLogCreate } },
}));

import { logUpdate } from '@/lib/audit';

beforeEach(() => {
  auditLogCreate.mockClear();
});

describe('logUpdate', () => {
  it('records only the fields that actually changed', async () => {
    await logUpdate('Agent', 1, 'Test Agent', { name: 'Old', phone: '123' }, { name: 'New', phone: '123' }, 9, 'Admin');
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    const data = auditLogCreate.mock.calls[0][0].data;
    expect(data.changes).toEqual({ name: { old: 'Old', new: 'New' } });
  });

  it('never diffs protected fields even when they change', async () => {
    await logUpdate(
      'Agent', 1, 'Test Agent',
      { passwordHash: 'a', qrToken: 'x', id: 1, createdAt: new Date('2026-01-01') },
      { passwordHash: 'b', qrToken: 'y', id: 1, createdAt: new Date('2026-02-01') },
      9, 'Admin'
    );
    expect(auditLogCreate).not.toHaveBeenCalled();
  });

  it('writes nothing for a no-op save', async () => {
    await logUpdate('Agent', 1, 'Test Agent', { name: 'Same' }, { name: 'Same' }, 9, 'Admin');
    expect(auditLogCreate).not.toHaveBeenCalled();
  });

  it('normalizes Date values to ISO strings before comparing, so an equivalent Date is not a false change', async () => {
    const before = new Date('2026-01-01T00:00:00.000Z');
    const after = new Date(before.getTime());
    await logUpdate('Agent', 1, 'Test Agent', { seenAt: before }, { seenAt: after }, 9, 'Admin');
    expect(auditLogCreate).not.toHaveBeenCalled();
  });

  it('treats undefined and null as equivalent via the ?? null normalization', async () => {
    await logUpdate('Agent', 1, 'Test Agent', { phone: undefined }, { phone: null }, 9, 'Admin');
    expect(auditLogCreate).not.toHaveBeenCalled();
  });
});
