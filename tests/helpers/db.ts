import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { IssueStatus, Severity } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function resetDb() {
  await prisma.$transaction([
    prisma.issueMessage.deleteMany(),
    prisma.resolutionProof.deleteMany(),
    prisma.visit.deleteMany(),
    prisma.issueMedia.deleteMany(),
    prisma.issue.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.oTP.deleteMany(),
    prisma.client.deleteMany(),
    prisma.building.deleteMany(),
    prisma.area.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.agent.deleteMany(),
    prisma.admin.deleteMany(),
  ]);
}

export const PASSWORD = 'password123';
let passwordHashCache: string | null = null;

async function passwordHash() {
  passwordHashCache ??= await bcrypt.hash(PASSWORD, 10);
  return passwordHashCache;
}

export async function seedAdmin(overrides: Partial<{ email: string; name: string; isSuperAdmin: boolean; isActive: boolean }> = {}) {
  return prisma.admin.create({
    data: {
      name: overrides.name ?? 'Test Admin',
      email: overrides.email ?? 'admin@test.local',
      passwordHash: await passwordHash(),
      isSuperAdmin: overrides.isSuperAdmin ?? false,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function seedAgent(overrides: Partial<{ email: string; name: string }> = {}) {
  return prisma.agent.create({
    data: {
      name: overrides.name ?? 'Test Agent',
      email: overrides.email ?? 'agent@test.local',
      passwordHash: await passwordHash(),
    },
  });
}

export async function seedBuilding() {
  return prisma.building.create({ data: { name: 'Test Building' } });
}

export async function seedClient(overrides: Partial<{ login: string; name: string; unitNumber: string; buildingId: number; mustSetPassword: boolean }> = {}) {
  const buildingId = overrides.buildingId ?? (await seedBuilding()).id;
  return prisma.client.create({
    data: {
      name: overrides.name ?? 'Test Client',
      login: overrides.login ?? 'test.client',
      unitNumber: overrides.unitNumber ?? 'A1',
      passwordHash: await passwordHash(),
      qrToken: crypto.randomBytes(16).toString('hex'),
      mustSetPassword: overrides.mustSetPassword ?? false,
      buildingId,
    },
  });
}

export async function seedIssue(overrides: Partial<{
  clientId: number;
  agentId: number | null;
  status: IssueStatus;
  severity: Severity | null;
  originalDescription: string;
  clientRequestId: string;
}> = {}) {
  const clientId = overrides.clientId ?? (await seedClient()).id;
  return prisma.issue.create({
    data: {
      clientId,
      agentId: overrides.agentId ?? null,
      status: overrides.status ?? 'PENDING_AGENT',
      severity: overrides.severity ?? null,
      originalDescription: overrides.originalDescription ?? 'Test issue',
      clientRequestId: overrides.clientRequestId,
    },
  });
}
