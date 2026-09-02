import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { DashboardStats, StatusBreakdownCard } from '@/components/admin/DashboardStats';
import { TriageWidget } from '@/components/admin/issues/TriageWidget';

// This page always queries live data per-request and can never be prerendered at
// build time anyway (the DB isn't reachable from the build environment on most
// hosts, Railway included) — force-dynamic makes that explicit instead of relying
// on Next.js to infer it, which crashed the build rather than gracefully bailing.
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [totalIssues, pendingIssuesCount, agentCount, clientCount] = await Promise.all([
    prisma.issue.count(),
    prisma.issue.count({ where: { status: 'PENDING_AGENT' } }),
    prisma.agent.count(),
    prisma.client.count(),
  ]);

  const activeConversations = await prisma.issue.findMany({
    where: { status: { in: ['PENDING_AGENT', 'IN_PROGRESS', 'DISPUTED'] } },
    orderBy: [{ severity: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 5,
    include: {
      client: { select: { unitNumber: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { message: true, mediaType: true, senderType: true, createdAt: true } },
    },
  });

  const statusCounts = await prisma.issue.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) {
    statusMap[row.status] = row._count.status;
  }

  const severityCounts = await prisma.issue.groupBy({
    by: ['severity'],
    _count: { severity: true },
  });
  const severityMap: Record<string, number> = {};
  for (const row of severityCounts) {
    if (row.severity) severityMap[row.severity] = row._count.severity;
  }

  const [agentsRaw, clientsRaw, pendingIssuesRaw] = await Promise.all([
    prisma.agent.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { issues: true } } },
    }),
    prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        building: { select: { name: true } },
        _count: { select: { issues: true } },
      },
    }),
    prisma.issue.findMany({
      where: { status: 'PENDING_AGENT' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { client: { select: { unitNumber: true } } },
    }),
  ]);

  const agents = agentsRaw.map(a => ({
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    issueCount: a._count.issues,
    createdAt: a.createdAt.toISOString(),
  }));

  const clients = clientsRaw.map(c => ({
    id: c.id,
    name: c.name,
    unitNumber: c.unitNumber,
    login: c.login,
    phone: c.phone,
    email: c.email,
    buildingName: c.building?.name ?? null,
    issueCount: c._count.issues,
    createdAt: c.createdAt.toISOString(),
  }));

  const pendingIssuesList = pendingIssuesRaw.map(i => ({
    id: i.id,
    description: i.originalDescription,
    unitNumber: i.client?.unitNumber ?? null,
    severity: i.severity,
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Administration
          </span>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground text-sm">
            Vue d&apos;ensemble de la plateforme After-Sales — activité en temps réel.
          </p>
        </div>
        <Link href="/admin/issues" className={buttonVariants({ className: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" })}>
          Voir toutes les réclamations <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>

      {/* ── Stats Row ────────────────────────────────────────────── */}
      <DashboardStats
        totalIssues={totalIssues}
        pendingCount={pendingIssuesCount}
        agentCount={agentCount}
        clientCount={clientCount}
        severity={{
          CRITICAL: severityMap.CRITICAL ?? 0,
          MEDIUM: severityMap.MEDIUM ?? 0,
          LOW: severityMap.LOW ?? 0,
        }}
        agents={agents}
        clients={clients}
        pendingIssues={pendingIssuesList}
      />

      {/* ── Bottom Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Recent Issues Table (spans 2 cols) */}
        <Card className="lg:col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-border">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Conversations à traiter
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs mt-0.5">
                Réclamations actives, par priorité
              </CardDescription>
            </div>
            <Link href="/admin/issues" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-foreground hover:bg-accent gap-1.5" })}>
              Voir tout
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <TriageWidget
              issues={activeConversations.map(i => ({
                id: i.id,
                originalDescription: i.originalDescription,
                status: i.status,
                severity: i.severity,
                createdAt: i.createdAt.toISOString(),
                client: i.client,
                latestMessage: i.messages[0] ? { ...i.messages[0], createdAt: i.messages[0].createdAt.toISOString() } : null,
              }))}
            />
          </CardContent>
        </Card>

        {/* RIGHT: Status Breakdown */}
        <StatusBreakdownCard totalIssues={totalIssues} statusMap={statusMap} />

      </div>
    </div>
  );
}
