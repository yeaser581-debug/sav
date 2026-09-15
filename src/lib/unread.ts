import { prisma } from '@/lib/prisma';
import { adminHasUnread } from '@/lib/read-state';

export async function adminUnreadIds(issues: { id: number; adminLastReadAt: Date | null }[]): Promise<Set<number>> {
  if (issues.length === 0) return new Set();

  const latest = await prisma.issueMessage.groupBy({
    by: ['issueId'],
    where: { issueId: { in: issues.map(i => i.id) }, senderType: 'CLIENT' },
    _max: { createdAt: true },
  });
  const latestByIssue = new Map(latest.map(row => [row.issueId, row._max.createdAt]));

  return new Set(
    issues
      .filter(issue => adminHasUnread({
        adminLastReadAt: issue.adminLastReadAt,
        latestClientMessageAt: latestByIssue.get(issue.id) ?? null,
      }))
      .map(issue => issue.id)
  );
}

export async function countAdminUnread(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n
    FROM Issue i
    WHERE i.adminLastReadAt IS NULL
       OR EXISTS (
         SELECT 1 FROM IssueMessage m
         WHERE m.issueId = i.id
           AND m.senderType = 'CLIENT'
           AND m.createdAt > i.adminLastReadAt
       )
  `;
  return Number(rows[0]?.n ?? 0);
}
