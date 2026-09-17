// Reads behind the client list, the client page and the quick search. Every
// query selects only what the screen shows, pages its results, and never
// returns a client's QR login token.

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  HISTORY_FILTERS, OPEN_STATUSES, QUICK_SEARCH_LIMIT,
  excerpt, issueNumber, likeLiteral, phoneDigits, summarizeClaims,
  type ClaimStats, type HistoryFilter,
} from '@/lib/client-search';

export const CLIENT_PUBLIC_SELECT = {
  id: true, name: true, login: true, unitNumber: true, phone: true, email: true,
  qrUsedAt: true, mustSetPassword: true, buildingId: true, createdAt: true,
} as const satisfies Prisma.ClientSelect;

const ACTIVE = { deletedAt: null } as const;

// Phones are stored as typed, spaces and all, so the match on digits has to
// strip them in SQL. Only runs when the query looks like a phone number.
async function clientIdsByPhone(digits: string): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM Client
    WHERE deletedAt IS NULL
      AND phone IS NOT NULL
      AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '.', ''), '(', ''), ')', '') LIKE ${`%${digits}%`}
    LIMIT 200`;
  return rows.map(r => Number(r.id));
}

async function clientSearchWhere(query: string): Promise<Prisma.ClientWhereInput> {
  if (!query) return ACTIVE;
  const text = likeLiteral(query);

  const terms: Prisma.ClientWhereInput[] = [
    { name: { contains: text } },
    { login: { contains: text } },
    { email: { contains: text } },
    { unitNumber: { contains: text } },
    { phone: { contains: text } },
    { building: { name: { contains: text } } },
  ];

  const digits = phoneDigits(query);
  if (digits) {
    const ids = await clientIdsByPhone(digits);
    if (ids.length) terms.push({ id: { in: ids } });
  }

  return { ...ACTIVE, OR: terms };
}

export type ClientListItem = {
  id: number;
  name: string | null;
  login: string;
  unitNumber: string | null;
  phone: string | null;
  email: string | null;
  qrUsedAt: Date | null;
  mustSetPassword: boolean;
  buildingId: number;
  createdAt: Date;
  building: { id: number; name: string } | null;
  claims: { total: number; open: number; lastAt: Date | null };
};

export async function listClients({ query, page, limit }: { query: string; page: number; limit: number }) {
  const where = await clientSearchWhere(query);

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      select: { ...CLIENT_PUBLIC_SELECT, building: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  // One grouped query for the whole page instead of one per client.
  const groups = rows.length
    ? await prisma.issue.groupBy({
        by: ['clientId', 'status'],
        where: { clientId: { in: rows.map(r => r.id) } },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];

  const open = new Set<string>(OPEN_STATUSES);
  const claimsByClient = new Map<number, ClientListItem['claims']>();
  for (const g of groups) {
    const c = claimsByClient.get(g.clientId) ?? { total: 0, open: 0, lastAt: null };
    c.total += g._count._all;
    if (open.has(g.status)) c.open += g._count._all;
    const last = g._max.createdAt;
    if (last && (!c.lastAt || last > c.lastAt)) c.lastAt = last;
    claimsByClient.set(g.clientId, c);
  }

  const clients: ClientListItem[] = rows.map(r => ({
    ...r,
    claims: claimsByClient.get(r.id) ?? { total: 0, open: 0, lastAt: null },
  }));

  return { clients, total, page, limit };
}

export type ClientProfile = {
  client: Omit<ClientListItem, 'building' | 'claims'> & {
    building: {
      id: number; name: string; address: string | null;
      area: { id: number; name: string; agent: { id: number; name: string } | null } | null;
    } | null;
  };
  stats: ClaimStats;
};

export async function getClientProfile(clientId: number): Promise<ClientProfile | null> {
  const row = await prisma.client.findFirst({
    where: { id: clientId, ...ACTIVE },
    select: {
      ...CLIENT_PUBLIC_SELECT,
      building: {
        select: {
          id: true, name: true, address: true,
          area: { select: { id: true, name: true, agent: { select: { id: true, name: true, deletedAt: true } } } },
        },
      },
    },
  });
  if (!row) return null;

  const [groups, resolved] = await Promise.all([
    prisma.issue.groupBy({ by: ['status'], where: { clientId }, _count: { _all: true } }),
    prisma.issue.findMany({
      where: { clientId, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    }),
  ]);

  // A removed agent is not the zone's agent any more.
  const agent = row.building?.area?.agent;
  const building = row.building && {
    ...row.building,
    area: row.building.area && {
      ...row.building.area,
      agent: agent && !agent.deletedAt ? { id: agent.id, name: agent.name } : null,
    },
  };

  return {
    client: { ...row, building },
    stats: summarizeClaims(groups.map(g => ({ status: g.status, count: g._count._all })), resolved),
  };
}

export async function clientExists(clientId: number): Promise<boolean> {
  const row = await prisma.client.findFirst({ where: { id: clientId, ...ACTIVE }, select: { id: true } });
  return row !== null;
}

export async function listClientIssues({ clientId, filter, page, limit }: {
  clientId: number; filter: HistoryFilter; page: number; limit: number;
}) {
  const statuses = HISTORY_FILTERS[filter];
  const where: Prisma.IssueWhereInput = {
    clientId,
    ...(statuses && { status: { in: [...statuses] } }),
  };

  const [rows, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      select: {
        id: true, status: true, severity: true, originalDescription: true,
        createdAt: true, resolvedAt: true,
        agent: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { message: true, mediaType: true, senderType: true, createdAt: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.issue.count({ where }),
  ]);

  const issues = rows.map(({ messages, originalDescription, ...rest }) => {
    const last = messages[0];
    return {
      ...rest,
      description: excerpt(originalDescription),
      lastMessage: last ? { ...last, message: excerpt(last.message, 90) ?? '' } : null,
    };
  });

  return { issues, total, page, limit };
}

export async function quickSearch(query: string) {
  const id = issueNumber(query);
  const clientWhere = await clientSearchWhere(query);
  const text = likeLiteral(query);

  const issueTerms: Prisma.IssueWhereInput[] = [
    { originalDescription: { contains: text } },
    { client: { is: { OR: [{ name: { contains: text } }, { unitNumber: { contains: text } }, { login: { contains: text } }] } } },
  ];
  if (id) issueTerms.unshift({ id });

  const [clients, issues] = await Promise.all([
    prisma.client.findMany({
      where: clientWhere,
      select: { id: true, name: true, login: true, unitNumber: true, phone: true, building: { select: { name: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: QUICK_SEARCH_LIMIT,
    }),
    prisma.issue.findMany({
      where: { OR: issueTerms, client: { is: ACTIVE } },
      select: {
        id: true, status: true, originalDescription: true, createdAt: true,
        client: { select: { id: true, name: true, login: true, unitNumber: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: QUICK_SEARCH_LIMIT,
    }),
  ]);

  // An exact claim number goes first, whatever its date.
  if (id) issues.sort((a, b) => Number(b.id === id) - Number(a.id === id));

  return {
    clients,
    issues: issues.map(({ originalDescription, ...rest }) => ({ ...rest, description: excerpt(originalDescription, 90) })),
  };
}
