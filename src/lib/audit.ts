import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { JWTPayload } from '@/lib/auth';

export type AuditEntityType = 'Agent' | 'Client' | 'Area' | 'Building' | 'Admin';

const SKIP_FIELDS = new Set(['id', 'createdAt', 'passwordHash', 'qrToken']);

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

export async function getActorName(payload: JWTPayload): Promise<string> {
  if (payload.role === 'admin') {
    const admin = await prisma.admin.findUnique({ where: { id: payload.id }, select: { name: true } });
    return admin?.name || payload.email;
  }
  return payload.email;
}

export async function logUpdate(
  entityType: AuditEntityType,
  entityId: number,
  entityLabel: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  performedById: number,
  performedByName: string,
) {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (SKIP_FIELDS.has(key)) continue;
    const beforeVal = normalize(before[key]);
    const afterVal = normalize(after[key]);
    if (beforeVal !== afterVal) {
      changes[key] = { old: beforeVal, new: afterVal };
    }
  }
  if (Object.keys(changes).length === 0) return;

  await prisma.auditLog.create({
    data: { entityType, entityId, entityLabel, action: 'UPDATE', changes: changes as Prisma.InputJsonValue, performedById, performedByName },
  });
}

export async function logDelete(
  entityType: AuditEntityType,
  entityId: number,
  entityLabel: string,
  performedById: number,
  performedByName: string,
) {
  await prisma.auditLog.create({
    data: { entityType, entityId, entityLabel, action: 'DELETE', performedById, performedByName },
  });
}

export async function logRestore(
  entityType: AuditEntityType,
  entityId: number,
  entityLabel: string,
  performedById: number,
  performedByName: string,
) {
  await prisma.auditLog.create({
    data: { entityType, entityId, entityLabel, action: 'RESTORE', performedById, performedByName },
  });
}
