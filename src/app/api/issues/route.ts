import { NextRequest, NextResponse } from 'next/server';
import { Prisma, IssueStatus, Severity } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { readdir, rename, mkdir } from 'fs/promises';
import path from 'path';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESOLVED_STATUSES = ['RESOLVED', 'CONFIRMED'] as const;

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
  const search = searchParams.get('search')?.trim() || '';
  const statusParam = searchParams.get('status');
  const filterParam = searchParams.get('filter');
  const severityParam = searchParams.get('severity');

  // Role scope — used both for the paginated query and for the role-scoped counts
  let roleWhere: Prisma.IssueWhereInput = {};
  if (payload.role === 'client') {
    roleWhere = { clientId: payload.id };
  } else if (payload.role === 'agent') {
    roleWhere = {
      OR: [
        { agentId: payload.id },
        { status: 'PENDING_AGENT' },
      ],
    };
  }
  // admin sees all (empty roleWhere)

  // Extra filters on top of role scope
  const extraWhere: Prisma.IssueWhereInput[] = [];

  if (payload.role === 'admin' && statusParam && statusParam !== 'all' && statusParam in IssueStatus) {
    extraWhere.push({ status: statusParam as IssueStatus });
  }
  if (payload.role === 'admin' && severityParam && severityParam !== 'all' && severityParam in Severity) {
    extraWhere.push({ severity: severityParam as Severity });
  }
  if (payload.role !== 'admin' && filterParam) {
    if (filterParam === 'UNASSIGNED' || filterParam === 'PENDING') {
      extraWhere.push({ status: 'PENDING_AGENT' });
    } else if (filterParam === 'IN_PROGRESS') {
      extraWhere.push({ status: 'IN_PROGRESS' });
    } else if (filterParam === 'RESOLVED') {
      extraWhere.push({ status: { in: [...RESOLVED_STATUSES] } });
    }
  }
  if (search) {
    const isNumeric = /^\d+$/.test(search);
    extraWhere.push({
      OR: [
        { originalDescription: { contains: search } },
        ...(isNumeric ? [{ id: Number(search) }] : []),
        // Agents also search by resident unit number
        ...(payload.role === 'agent' ? [{ client: { unitNumber: { contains: search } } }] : []),
      ],
    });
  }

  const fullWhere: Prisma.IssueWhereInput = extraWhere.length
    ? { AND: [roleWhere, ...extraWhere] }
    : roleWhere;

  const orderBy: Prisma.IssueOrderByWithRelationInput[] = payload.role === 'admin'
    ? [{ severity: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }]
    : [{ createdAt: 'desc' }];

  const [issues, total, statusGroups, urgentCount] = await Promise.all([
    prisma.issue.findMany({
      where: fullWhere,
      include: { media: true, client: { select: { unitNumber: true } } },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.issue.count({ where: fullWhere }),
    prisma.issue.groupBy({ by: ['status'], where: roleWhere, _count: true }),
    payload.role === 'admin'
      ? prisma.issue.count({ where: { ...roleWhere, severity: 'CRITICAL' } })
      : Promise.resolve(0),
  ]);

  const statusCount = (status: string) =>
    statusGroups.find(g => g.status === status)?._count ?? 0;
  const roleTotal = statusGroups.reduce((sum, g) => sum + g._count, 0);
  const resolvedCount = RESOLVED_STATUSES.reduce((sum, s) => sum + statusCount(s), 0);

  const counts = payload.role === 'admin'
    ? { total: roleTotal, urgent: urgentCount, inProgress: statusCount('IN_PROGRESS'), resolved: resolvedCount }
    : payload.role === 'agent'
    ? { ALL: roleTotal, UNASSIGNED: statusCount('PENDING_AGENT'), IN_PROGRESS: statusCount('IN_PROGRESS'), RESOLVED: resolvedCount }
    : { ALL: roleTotal, PENDING: statusCount('PENDING_AGENT'), IN_PROGRESS: statusCount('IN_PROGRESS'), RESOLVED: resolvedCount };

  return NextResponse.json({ issues, total, page, limit, counts });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const description = body.description as string;
    const media = Array.isArray(body.media) ? body.media as { id: string; type: string }[] : [];

    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description required' }, { status: 400 });
    }

    // Get active contract
    const contract = await prisma.contract.findFirst({ where: { isActive: true } });

    // Create the issue
    const issue = await prisma.issue.create({
      data: {
        clientId: payload.id,
        originalDescription: description.trim(),
        status: 'PENDING_AGENT',
        contractId: contract?.id,
      },
    });

    // Move pre-uploaded temp media into the issue's permanent folder
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'issues', String(issue.id));
    const tempEntries = media.length ? await readdir(tempDir).catch(() => [] as string[]) : [];

    if (media.length) {
      await mkdir(uploadDir, { recursive: true });
    }

    for (const item of media) {
      if (!item?.id || !UUID_RE.test(item.id)) continue;
      const match = tempEntries.find(f => f.startsWith(`${item.id}.`));
      if (!match) continue;

      const ext = match.includes('.') ? match.split('.').pop() : 'bin';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      await rename(path.join(tempDir, match), path.join(uploadDir, filename));

      const mimeType = item.type || '';
      const mediaType = mimeType.startsWith('image/') ? 'PHOTO'
        : mimeType.startsWith('video/') ? 'VIDEO'
        : mimeType.startsWith('audio/') ? 'AUDIO'
        : 'TEXT';

      await prisma.issueMedia.create({
        data: {
          issueId: issue.id,
          type: mediaType,
          url: `/uploads/issues/${issue.id}/${filename}`,
        },
      });
    }

    return NextResponse.json({ success: true, issueId: issue.id }, { status: 201 });
  } catch (err) {
    console.error('[ISSUE CREATE ERROR]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
