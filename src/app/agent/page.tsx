import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Clock, Wrench, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import { IssueTable } from '@/components/issues/IssueTable';

export default async function AgentDashboard() {
  const headersList = await headers();
  const userId = Number(headersList.get('x-user-id'));
  const userEmail = headersList.get('x-user-email') ?? 'Agent';
  const userName = userEmail.split('@')[0];
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Active tickets assigned to this agent
  const activeCount = await prisma.issue.count({
    where: { agentId: userId, status: 'IN_PROGRESS' },
  });

  // Tickets waiting for assignment (open to any agent)
  const unassignedCount = await prisma.issue.count({
    where: { status: 'PENDING_AGENT' },
  });

  // Scheduled visits coming up
  const upcomingVisitsCount = await prisma.visit.count({
    where: {
      issue: { agentId: userId },
      scheduledAt: { gt: new Date() },
      status: 'PROPOSED', // or CONFIRMED
    },
  });

  // Resolved tickets this month
  const resolvedCount = await prisma.issue.count({
    where: {
      agentId: userId,
      status: { in: ['RESOLVED', 'CONFIRMED'] },
    },
  });

  // Recent issues related to this agent or unassigned
  const issues = await prisma.issue.findMany({
    where: {
      OR: [
        { agentId: userId },
        { status: 'PENDING_AGENT' },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      client: {
        select: {
          name: true,
          unitNumber: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Espace Interventions
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">Bonjour, {formattedName}</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Suivez vos plannings de visites et gérez vos tickets d&apos;intervention.</p>
      </div>

      {/* KPI: "Mes tickets en cours" is the one number an agent actually acts on today —
          it gets the hero treatment; the rest stay secondary. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3">
        <Link
          href="/agent/issues?filter=IN_PROGRESS"
          className={`relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-6 flex flex-col justify-end min-h-44 shadow-sm transition-all duration-200 ${activeCount > 0 ? 'hover:shadow-md hover:-translate-y-0.5' : 'opacity-60'}`}
        >
          <svg className="absolute inset-0 w-full h-full opacity-[0.14] pointer-events-none" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <pattern id="agent-zellige" width="34" height="34" patternUnits="userSpaceOnUse">
                <rect x="3" y="3" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1" transform="rotate(45 13 13)" />
                <rect x="3" y="3" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#agent-zellige)" />
          </svg>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-semibold opacity-85 mb-2">
              <Wrench className="h-3.5 w-3.5" />
              Mes tickets en cours
            </div>
            <div className="text-5xl font-extrabold tracking-tight tabular-nums">{activeCount}</div>
            <p className="text-xs opacity-80 mt-1.5">
              {activeCount === 0 ? 'Aucune intervention en cours' : 'Interventions actives à traiter'}
            </p>
          </div>
        </Link>

        <div className="flex flex-col gap-2">
          {[
            { title: 'À attribuer', value: unassignedCount, icon: Clock, href: '/agent/issues?filter=UNASSIGNED' },
            { title: 'Visites planifiées', value: upcomingVisitsCount, icon: Calendar, href: '/agent/visits' },
            { title: 'Résolus ce mois', value: resolvedCount, icon: CheckCircle2, href: '/agent/issues?filter=RESOLVED' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            const clickable = stat.value > 0;
            const row = (
              <div className={`flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 flex-1 shadow-sm transition-all duration-200 ${clickable ? 'hover:shadow-md hover:-translate-y-0.5' : 'opacity-60'}`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground truncate">{stat.title}</div>
                  <div className="text-lg font-bold text-foreground tabular-nums leading-tight">{stat.value}</div>
                </div>
                {clickable && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            );
            return (
              <Link key={i} href={stat.href} className="flex">
                {row}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Issues Table */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-card border-border shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Dernières réclamations d&apos;intérêt</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">Tickets assignés ou en attente de prise en charge</CardDescription>
            </div>
            <Link href="/agent/issues" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-foreground hover:bg-accent gap-1.5" })}>
              Voir tout <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <IssueTable
              issues={issues}
              basePath="/agent/issues"
              actionLabel={() => 'Gérer'}
              emptyMessage="Aucun ticket d'intervention disponible."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
