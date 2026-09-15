import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isIssueStatus, isSeverity, type Expectation, type IssueSnapshot } from '@/lib/issue-workflow';

export function toSnapshot(issue: {
  status: string;
  clientId: number;
  agentId: number | null;
  severity: string | null;
}): IssueSnapshot {
  if (!isIssueStatus(issue.status)) {
    throw new Error(`Unknown issue status in database: ${issue.status}`);
  }
  return {
    status: issue.status,
    clientId: issue.clientId,
    agentId: issue.agentId,
    severity: isSeverity(issue.severity) ? issue.severity : null,
  };
}

export function whereStillMatches(issueId: number, expect: Expectation): Prisma.IssueWhereInput {
  return { id: issueId, ...expect };
}

export async function isActiveAgent(agentId: number): Promise<boolean> {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, deletedAt: null }, select: { id: true } });
  return agent !== null;
}

export function parseIssueId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export class StaleIssueError extends Error {
  constructor() {
    super('The issue changed between the decision and the write.');
    this.name = 'StaleIssueError';
  }
}

export const STALE_ISSUE_MESSAGE = 'La réclamation vient d’être modifiée par quelqu’un d’autre. Rechargez la page et réessayez.';
